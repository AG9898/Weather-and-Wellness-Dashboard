"""Tests for backend/app/services/openrouter_client.py."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.config import OpenRouterConfig, OpenRouterConfigError, get_openrouter_config
from app.services.openrouter_client import (
    ROUTE_FALLBACK,
    ROUTE_PRIMARY,
    OpenRouterClient,
    OpenRouterUnavailableError,
    build_chat_completion_payload,
)


def _config(**overrides: object) -> OpenRouterConfig:
    base = dict(
        api_key="secret-openrouter-key",
        model="openrouter/test-model",
        require_zdr=True,
        provider_allowlist=("ProviderA", "ProviderB"),
    )
    base.update(overrides)
    return OpenRouterConfig(**base)  # type: ignore[arg-type]


def _fallback_config(**overrides: object) -> OpenRouterConfig:
    return _config(
        fallback_model="nvidia/nemotron-3-super-120b-a12b:free",
        **overrides,
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

    def test_fallback_unset_means_no_fallback(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("OPENROUTER_API_KEY", "secret")
        monkeypatch.setenv("OPENROUTER_MODEL", "model/free")
        monkeypatch.setenv("OPENROUTER_PROVIDER_ALLOWLIST", "A")
        monkeypatch.delenv("OPENROUTER_FALLBACK_MODEL", raising=False)
        monkeypatch.delenv("OPENROUTER_FALLBACK_PROVIDER_ALLOWLIST", raising=False)

        config = get_openrouter_config()

        assert config.fallback_model == ""
        assert config.fallback_provider_allowlist == ()
        assert config.has_fallback is False

    def test_fallback_config_is_parsed_when_set(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("OPENROUTER_API_KEY", "secret")
        monkeypatch.setenv("OPENROUTER_MODEL", "model/free")
        monkeypatch.setenv("OPENROUTER_PROVIDER_ALLOWLIST", "A")
        monkeypatch.setenv("OPENROUTER_FALLBACK_MODEL", " vendor/fallback:free ")
        monkeypatch.setenv("OPENROUTER_FALLBACK_PROVIDER_ALLOWLIST", "X, Y")

        config = get_openrouter_config()

        assert config.fallback_model == "vendor/fallback:free"
        assert config.fallback_provider_allowlist == ("X", "Y")
        assert config.has_fallback is True


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

    def test_successful_primary_call_records_served_route(self) -> None:
        response = _mock_response(
            200,
            {
                "model": "openrouter/test-model",
                "choices": [{"message": {"content": "ok"}}],
            },
        )
        client = OpenRouterClient(_config())

        with patch("httpx.post", return_value=response):
            result = client.create_chat_completion(
                [{"role": "user", "content": "Hi"}]
            )

        assert result.served_route == ROUTE_PRIMARY
        assert result.served_model == "openrouter/test-model"
        assert result.tool_calls == []


class TestOpenRouterToolCalling:
    _TOOLS = [
        {
            "type": "function",
            "function": {
                "name": "get_data_coverage",
                "description": "Return participant counts and data date range.",
                "parameters": {"type": "object", "properties": {}},
            },
        }
    ]

    def test_payload_includes_tools_and_tool_choice(self) -> None:
        payload = build_chat_completion_payload(
            _config(),
            [{"role": "user", "content": "How many participants?"}],
            tools=self._TOOLS,
            tool_choice="auto",
        )

        assert payload["tools"] == self._TOOLS
        assert payload["tool_choice"] == "auto"

    def test_payload_omits_tools_when_not_provided(self) -> None:
        payload = build_chat_completion_payload(
            _config(),
            [{"role": "user", "content": "Hi"}],
        )

        assert "tools" not in payload
        assert "tool_choice" not in payload

    def test_client_returns_requested_tool_calls(self) -> None:
        tool_calls = [
            {
                "id": "call_1",
                "type": "function",
                "function": {"name": "get_data_coverage", "arguments": "{}"},
            }
        ]
        response = _mock_response(
            200,
            {
                "model": "openrouter/test-model",
                "choices": [
                    {"message": {"content": None, "tool_calls": tool_calls}}
                ],
            },
        )
        client = OpenRouterClient(_config())

        with patch("httpx.post", return_value=response):
            result = client.create_chat_completion(
                [{"role": "user", "content": "How many participants?"}],
                tools=self._TOOLS,
                tool_choice="auto",
            )

        assert result.tool_calls == tool_calls
        assert result.content == ""


class TestOpenRouterAvailabilityFallback:
    def test_no_fallback_when_unset_fails_closed(self) -> None:
        primary = _mock_response(503, {"error": "venice down"})
        client = OpenRouterClient(_config())  # no fallback_model

        with patch("httpx.post", return_value=primary) as mock_post:
            with pytest.raises(OpenRouterUnavailableError):
                client.create_chat_completion(
                    [{"role": "user", "content": "Hi"}]
                )

        # Exactly one call: the failed ZDR-required primary. No non-ZDR retry.
        assert mock_post.call_count == 1
        assert mock_post.call_args.kwargs["json"]["provider"]["zdr"] is True

    def test_unavailable_primary_retries_once_on_fallback(self) -> None:
        primary = _mock_response(503, {"error": "venice down"})
        fallback = _mock_response(
            200,
            {
                "model": "nvidia/nemotron-3-super-120b-a12b:free",
                "choices": [{"message": {"content": "fallback answer"}}],
            },
        )
        client = OpenRouterClient(_fallback_config())

        with patch("httpx.post", side_effect=[primary, fallback]) as mock_post:
            result = client.create_chat_completion(
                [{"role": "user", "content": "Hi"}]
            )

        assert mock_post.call_count == 2
        # Primary used ZDR routing; fallback relaxed it (no zdr key) and used
        # the fallback model.
        primary_payload = mock_post.call_args_list[0].kwargs["json"]
        fallback_payload = mock_post.call_args_list[1].kwargs["json"]
        assert primary_payload["provider"].get("zdr") is True
        assert "zdr" not in fallback_payload["provider"]
        assert fallback_payload["model"] == "nvidia/nemotron-3-super-120b-a12b:free"

        assert result.served_route == ROUTE_FALLBACK
        assert result.served_model == "nvidia/nemotron-3-super-120b-a12b:free"
        assert result.content == "fallback answer"

    def test_fallback_provider_allowlist_scopes_retry(self) -> None:
        primary = _mock_response(503, {"error": "down"})
        fallback = _mock_response(
            200,
            {"choices": [{"message": {"content": "ok"}}]},
        )
        client = OpenRouterClient(
            _fallback_config(fallback_provider_allowlist=("Nvidia",))
        )

        with patch("httpx.post", side_effect=[primary, fallback]) as mock_post:
            client.create_chat_completion([{"role": "user", "content": "Hi"}])

        fallback_provider = mock_post.call_args_list[1].kwargs["json"]["provider"]
        assert fallback_provider["only"] == ["Nvidia"]
        assert fallback_provider["allow_fallbacks"] is False
        assert "zdr" not in fallback_provider

    def test_fallback_also_failing_raises_user_safe_unavailable(self) -> None:
        primary = _mock_response(503, {"error": "down"})
        fallback = _mock_response(503, {"error": "also down"})
        client = OpenRouterClient(_fallback_config())

        with patch("httpx.post", side_effect=[primary, fallback]) as mock_post:
            with pytest.raises(OpenRouterUnavailableError) as exc_info:
                client.create_chat_completion(
                    [{"role": "user", "content": "Hi"}]
                )

        assert mock_post.call_count == 2
        assert str(exc_info.value) == exc_info.value.public_message
        assert "also down" not in str(exc_info.value)

    def test_misconfiguration_fails_closed_without_fallback_call(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # ZDR required without an allowlist is misconfiguration: it must fail
        # closed at config time and never attempt any model call (primary or
        # fallback), even though a fallback model is configured.
        monkeypatch.setenv("OPENROUTER_API_KEY", "secret")
        monkeypatch.setenv("OPENROUTER_MODEL", "model/free")
        monkeypatch.setenv("OPENROUTER_REQUIRE_ZDR", "true")
        monkeypatch.delenv("OPENROUTER_PROVIDER_ALLOWLIST", raising=False)
        monkeypatch.setenv("OPENROUTER_FALLBACK_MODEL", "vendor/fallback:free")

        with patch("httpx.post") as mock_post:
            with pytest.raises(OpenRouterUnavailableError):
                OpenRouterClient.from_env()

        assert mock_post.call_count == 0
