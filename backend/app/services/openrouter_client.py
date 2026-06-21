"""Server-only OpenRouter client for the RA data chatbot.

This module owns the OpenRouter secret boundary. Frontend code must call the
FastAPI chatbot coordinator, never OpenRouter directly. The client supports
tool/function calling and an optional, owner-approved non-ZDR availability
fallback (see docs/AI_CHAT.md and docs/DECISIONS.md): when a fallback model is
configured, a primary ZDR-required request that fails because of provider
unavailability/upstream error retries once on the fallback model with ZDR and
training/data-collection restrictions relaxed. Misconfiguration always fails
closed and never triggers the fallback; when no fallback model is configured the
primary failure fails closed.
"""
from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.config import OpenRouterConfig, OpenRouterConfigError, get_openrouter_config

_OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"
_APP_TITLE = "UBC Psychology Research Platform"
_USER_SAFE_UNAVAILABLE_MESSAGE = (
    "AI chat is unavailable because its privacy configuration is incomplete."
)

# Observable served-route labels (no secrets). Recorded on the result so the
# coordinator/audit can tell whether the privacy-preserving primary path or the
# deliberately-relaxed non-ZDR fallback served the response.
ROUTE_PRIMARY = "primary"
ROUTE_FALLBACK = "fallback"


class OpenRouterUnavailableError(RuntimeError):
    """User-safe error for unavailable or unsafe OpenRouter chat configuration."""

    def __init__(self, detail: str) -> None:
        self.detail = detail
        self.public_message = _USER_SAFE_UNAVAILABLE_MESSAGE
        super().__init__(self.public_message)


@dataclass(frozen=True)
class OpenRouterChatResult:
    """Small typed result returned by the OpenRouter chat wrapper.

    `served_route` is ROUTE_PRIMARY for the privacy-preserving ZDR path and
    ROUTE_FALLBACK when the non-ZDR availability fallback served the response.
    `served_model` records which model slug answered. Neither field exposes
    secrets, so both are safe to log/audit.
    """

    content: str
    model: str
    served_route: str
    served_model: str
    raw_response: dict[str, Any]
    tool_calls: list[dict[str, Any]] = field(default_factory=list)


def _primary_provider_config(config: OpenRouterConfig) -> dict[str, Any]:
    """Privacy-preserving provider routing for the primary (ZDR) request."""
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


def _fallback_provider_config(config: OpenRouterConfig) -> dict[str, Any]:
    """Deliberately-relaxed provider routing for the non-ZDR fallback request.

    ZDR and training/data-collection restrictions are intentionally not enforced
    here: this path trades the primary privacy route for availability when the
    sole free ZDR provider is down or rate-limited (owner-approved). An optional
    fallback allowlist may scope the route; otherwise OpenRouter routes freely.
    """
    provider: dict[str, Any] = {
        "data_collection": "allow",
    }
    if config.fallback_provider_allowlist:
        provider["only"] = list(config.fallback_provider_allowlist)
        provider["allow_fallbacks"] = False
    else:
        provider["allow_fallbacks"] = True
    return provider


def build_chat_completion_payload(
    config: OpenRouterConfig,
    messages: Sequence[Mapping[str, Any]],
    *,
    max_tokens: int = 800,
    temperature: float = 0.2,
    tools: Sequence[Mapping[str, Any]] | None = None,
    tool_choice: str | Mapping[str, Any] | None = None,
    model: str | None = None,
    use_fallback_provider: bool = False,
) -> dict[str, Any]:
    """Build a privacy-constrained OpenRouter chat-completions payload.

    `model` overrides the configured primary model (used for the fallback
    request). `use_fallback_provider` selects the relaxed non-ZDR provider
    routing instead of the privacy-preserving primary routing. `tools` and
    `tool_choice` enable function/tool calling.
    """
    if not messages:
        raise ValueError("messages must not be empty")

    provider = (
        _fallback_provider_config(config)
        if use_fallback_provider
        else _primary_provider_config(config)
    )

    payload: dict[str, Any] = {
        "model": model or config.model,
        "messages": [dict(message) for message in messages],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "provider": provider,
    }
    if tools:
        payload["tools"] = [dict(tool) for tool in tools]
        if tool_choice is not None:
            payload["tool_choice"] = tool_choice
    return payload


class OpenRouterClient:
    """Minimal server-side OpenRouter wrapper for the RA chatbot."""

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
        """Create a client from validated backend env vars.

        Misconfiguration (including ZDR required without an allowlist) fails
        closed here, before any model call is attempted.
        """
        try:
            config = get_openrouter_config()
        except OpenRouterConfigError as exc:
            raise OpenRouterUnavailableError(exc.detail) from exc
        return cls(config)

    def create_chat_completion(
        self,
        messages: Sequence[Mapping[str, Any]],
        *,
        max_tokens: int = 800,
        temperature: float = 0.2,
        tools: Sequence[Mapping[str, Any]] | None = None,
        tool_choice: str | Mapping[str, Any] | None = None,
    ) -> OpenRouterChatResult:
        """Create a chat completion through OpenRouter.

        Provider/privacy configuration is sent with every request. The primary
        request uses the privacy-preserving ZDR routing. If that request fails
        because of provider unavailability/upstream error AND a fallback model
        is configured, the call retries once on the fallback model with ZDR and
        training/data-collection restrictions relaxed. When no fallback model is
        configured, the primary failure fails closed. HTTP and response-shape
        failures are mapped to the same user-safe unavailable error that routes
        can expose without leaking provider details.
        """
        try:
            return self._request(
                model=self._config.model,
                served_route=ROUTE_PRIMARY,
                use_fallback_provider=False,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                tools=tools,
                tool_choice=tool_choice,
            )
        except OpenRouterUnavailableError:
            if not self._config.has_fallback:
                raise

        # Deliberate, owner-approved relaxed-privacy retry for availability only.
        return self._request(
            model=self._config.fallback_model,
            served_route=ROUTE_FALLBACK,
            use_fallback_provider=True,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            tools=tools,
            tool_choice=tool_choice,
        )

    def _request(
        self,
        *,
        model: str,
        served_route: str,
        use_fallback_provider: bool,
        messages: Sequence[Mapping[str, Any]],
        max_tokens: int,
        temperature: float,
        tools: Sequence[Mapping[str, Any]] | None,
        tool_choice: str | Mapping[str, Any] | None,
    ) -> OpenRouterChatResult:
        payload = build_chat_completion_payload(
            self._config,
            messages,
            max_tokens=max_tokens,
            temperature=temperature,
            tools=tools,
            tool_choice=tool_choice,
            model=model,
            use_fallback_provider=use_fallback_provider,
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
            message = data["choices"][0]["message"]
            content = message.get("content") or ""
            tool_calls = list(message.get("tool_calls") or [])
        except (KeyError, IndexError, TypeError, httpx.HTTPError) as exc:
            raise OpenRouterUnavailableError(
                "OpenRouter request failed or returned an unexpected response."
            ) from exc

        return OpenRouterChatResult(
            content=content,
            model=data.get("model") or model,
            served_route=served_route,
            served_model=model,
            raw_response=data,
            tool_calls=tool_calls,
        )


__all__ = [
    "ROUTE_FALLBACK",
    "ROUTE_PRIMARY",
    "OpenRouterChatResult",
    "OpenRouterClient",
    "OpenRouterUnavailableError",
    "build_chat_completion_payload",
]
