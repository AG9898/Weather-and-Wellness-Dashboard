"""Tests for backend/app/services/openrouter_client.py."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.config import OpenRouterConfig, OpenRouterConfigError, get_openrouter_config
from app.services.openrouter_client import (
    OpenRouterClient,
    OpenRouterUnavailableError,
    build_chat_completion_payload,
)


def _config() -> OpenRouterConfig:
    return OpenRouterConfig(
        api_key="secret-openrouter-key",
        model="openrouter/test-model",
        require_zdr=True,
        provider_allowlist=("ProviderA", "ProviderB"),
    )


def _mock_response(status_code: int, json_data: object) -> MagicMock:
    response = MagicMock(spec=httpx.Response)
    response.status_code = status_code
    response.json.return_value = json_data
    if status_code >= 400:
        response.raise_for_status.side_effect = httpx.HTTPStatusError(
            f"HTTP {status_code}",
            request=MagicMock(),
            response=response,
        )
    else:
        response.raise_for_status.return_value = None
    return response


class TestOpenRouterConfig:
    def test_env_config_is_backend_only_and_validated(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("OPENROUTER_API_KEY", " secret ")
        monkeypatch.setenv("OPENROUTER_MODEL", " model/free ")
        monkeypatch.setenv("OPENROUTER_REQUIRE_ZDR", "true")
        monkeypatch.setenv("OPENROUTER_PROVIDER_ALLOWLIST", "A, B")
        monkeypatch.setenv("NEXT_PUBLIC_OPENROUTER_API_KEY", "ignored-browser-secret")

        config = get_openrouter_config()

        assert config.api_key == "secret"
        assert config.model == "model/free"
        assert config.require_zdr is True
        assert config.provider_allowlist == ("A", "B")

    def test_missing_key_raises_user_safe_config_error(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
        monkeypatch.setenv("OPENROUTER_MODEL", "model/free")
        monkeypatch.setenv("OPENROUTER_PROVIDER_ALLOWLIST", "A")

        with pytest.raises(OpenRouterConfigError) as exc_info:
            get_openrouter_config()

        assert str(exc_info.value) == exc_info.value.public_message
        assert "OPENROUTER_API_KEY" not in str(exc_info.value)
        assert "OPENROUTER_API_KEY" in exc_info.value.detail

    def test_invalid_privacy_boolean_raises_user_safe_config_error(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("OPENROUTER_API_KEY", "secret")
        monkeypatch.setenv("OPENROUTER_MODEL", "model/free")
        monkeypatch.setenv("OPENROUTER_REQUIRE_ZDR", "sometimes")
        monkeypatch.setenv("OPENROUTER_PROVIDER_ALLOWLIST", "A")

        with pytest.raises(OpenRouterConfigError) as exc_info:
            get_openrouter_config()

        assert str(exc_info.value) == exc_info.value.public_message
        assert "sometimes" not in str(exc_info.value)

    def test_required_zdr_without_provider_allowlist_fails_closed(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("OPENROUTER_API_KEY", "secret")
        monkeypatch.setenv("OPENROUTER_MODEL", "model/free")
        monkeypatch.setenv("OPENROUTER_REQUIRE_ZDR", "true")
        monkeypatch.delenv("OPENROUTER_PROVIDER_ALLOWLIST", raising=False)

        with pytest.raises(OpenRouterConfigError) as exc_info:
            get_openrouter_config()

        assert str(exc_info.value) == exc_info.value.public_message

    def test_duplicate_provider_allowlist_fails_closed(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("OPENROUTER_API_KEY", "secret")
        monkeypatch.setenv("OPENROUTER_MODEL", "model/free")
        monkeypatch.setenv("OPENROUTER_PROVIDER_ALLOWLIST", "A,A")

        with pytest.raises(OpenRouterConfigError):
            get_openrouter_config()


class TestOpenRouterClient:
    def test_payload_includes_privacy_provider_controls(self) -> None:
        payload = build_chat_completion_payload(
            _config(),
            [{"role": "user", "content": "Summarize session counts."}],
            max_tokens=200,
            temperature=0.1,
        )

        assert payload["model"] == "openrouter/test-model"
        assert payload["max_tokens"] == 200
        assert payload["temperature"] == 0.1
        assert payload["provider"] == {
            "allow_fallbacks": False,
            "data_collection": "deny",
            "require_parameters": True,
            "only": ["ProviderA", "ProviderB"],
            "zdr": True,
        }

    def test_from_env_maps_config_error_to_user_safe_unavailable(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
        monkeypatch.setenv("OPENROUTER_MODEL", "model/free")
        monkeypatch.setenv("OPENROUTER_PROVIDER_ALLOWLIST", "A")

        with pytest.raises(OpenRouterUnavailableError) as exc_info:
            OpenRouterClient.from_env()

        assert str(exc_info.value) == exc_info.value.public_message
        assert "OPENROUTER_API_KEY" not in str(exc_info.value)

    def test_create_chat_completion_sends_secret_only_in_authorization_header(
        self,
    ) -> None:
        response = _mock_response(
            200,
            {
                "model": "openrouter/test-model",
                "choices": [{"message": {"content": "There are 12 sessions."}}],
            },
        )
        client = OpenRouterClient(_config())

        with patch("httpx.post", return_value=response) as mock_post:
            result = client.create_chat_completion(
                [{"role": "user", "content": "How many sessions?"}]
            )

        call = mock_post.call_args.kwargs
        assert call["headers"]["Authorization"] == "Bearer secret-openrouter-key"
        assert "secret-openrouter-key" not in repr(call["json"])
        assert result.content == "There are 12 sessions."

    def test_http_error_maps_to_user_safe_unavailable(self) -> None:
        response = _mock_response(400, {"error": "privacy routing unavailable"})
        client = OpenRouterClient(_config())

        with patch("httpx.post", return_value=response):
            with pytest.raises(OpenRouterUnavailableError) as exc_info:
                client.create_chat_completion(
                    [{"role": "user", "content": "Summarize"}]
                )

        assert str(exc_info.value) == exc_info.value.public_message
        assert "privacy routing unavailable" not in str(exc_info.value)
