"""Server-only OpenRouter client for the planned RA data chatbot.

This module owns the OpenRouter secret boundary. Frontend code must call the
FastAPI chatbot coordinator when it exists, never OpenRouter directly.
"""
from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import OpenRouterConfig, OpenRouterConfigError, get_openrouter_config

_OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"
_APP_TITLE = "UBC Psychology Research Platform"
_USER_SAFE_UNAVAILABLE_MESSAGE = (
    "AI chat is unavailable because its privacy configuration is incomplete."
)


class OpenRouterUnavailableError(RuntimeError):
    """User-safe error for unavailable or unsafe OpenRouter chat configuration."""

    def __init__(self, detail: str) -> None:
        self.detail = detail
        self.public_message = _USER_SAFE_UNAVAILABLE_MESSAGE
        super().__init__(self.public_message)


@dataclass(frozen=True)
class OpenRouterChatResult:
    """Small typed result returned by the OpenRouter chat wrapper."""

    content: str
    model: str
    raw_response: dict[str, Any]


def _privacy_provider_config(config: OpenRouterConfig) -> dict[str, Any]:
    provider: dict[str, Any] = {
        "allow_fallbacks": False,
        "data_collection": "deny",
        "require_parameters": True,
    }
    if config.provider_allowlist:
        provider["only"] = list(config.provider_allowlist)
    if config.require_zdr:
        provider["zdr"] = True
    return provider


def build_chat_completion_payload(
    config: OpenRouterConfig,
    messages: Sequence[Mapping[str, str]],
    *,
    max_tokens: int = 800,
    temperature: float = 0.2,
) -> dict[str, Any]:
    """Build a privacy-constrained OpenRouter chat-completions payload."""
    if not messages:
        raise ValueError("messages must not be empty")

    return {
        "model": config.model,
        "messages": [
            {"role": message["role"], "content": message["content"]}
            for message in messages
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "provider": _privacy_provider_config(config),
    }


class OpenRouterClient:
    """Minimal server-side OpenRouter wrapper for the planned chatbot."""

    def __init__(
        self,
        config: OpenRouterConfig,
        *,
        chat_url: str = _OPENROUTER_CHAT_URL,
    ) -> None:
        self._config = config
        self._chat_url = chat_url

    @classmethod
    def from_env(cls) -> "OpenRouterClient":
        """Create a client from validated backend env vars."""
        try:
            config = get_openrouter_config()
        except OpenRouterConfigError as exc:
            raise OpenRouterUnavailableError(exc.detail) from exc
        return cls(config)

    def create_chat_completion(
        self,
        messages: Sequence[Mapping[str, str]],
        *,
        max_tokens: int = 800,
        temperature: float = 0.2,
    ) -> OpenRouterChatResult:
        """Create a chat completion through OpenRouter.

        Provider/privacy configuration is sent with every request. HTTP and
        response-shape failures are mapped to the same user-safe unavailable
        error that routes can expose without leaking provider details.
        """
        payload = build_chat_completion_payload(
            self._config,
            messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )

        try:
            response = httpx.post(
                self._chat_url,
                headers={
                    "Authorization": f"Bearer {self._config.api_key}",
                    "Content-Type": "application/json",
                    "X-Title": _APP_TITLE,
                },
                json=payload,
                timeout=30,
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError, httpx.HTTPError) as exc:
            raise OpenRouterUnavailableError(
                "OpenRouter request failed or returned an unexpected response."
            ) from exc

        return OpenRouterChatResult(
            content=content,
            model=data.get("model") or self._config.model,
            raw_response=data,
        )


__all__ = [
    "OpenRouterChatResult",
    "OpenRouterClient",
    "OpenRouterUnavailableError",
    "build_chat_completion_payload",
]
