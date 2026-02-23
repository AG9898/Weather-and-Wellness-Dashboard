from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt, jwk
from pydantic import BaseModel
from uuid import UUID


class LabMember(BaseModel):
    id: UUID
    email: str


_bearer_scheme = HTTPBearer(auto_error=False)

# Cache for JWKS keys
_jwks_cache: dict[str, Any] | None = None


def _get_supabase_url() -> str:
    url = os.getenv("SUPABASE_URL")
    if not url:
        raise RuntimeError("SUPABASE_URL is not set; export it in your environment (.env).")
    return url


def _get_jwt_secret() -> str | None:
    """Return the legacy HS256 JWT secret, if configured."""
    return os.getenv("SUPABASE_JWT_SECRET")


def _fetch_jwks() -> dict[str, Any]:
    """Fetch JWKS from Supabase's well-known endpoint (cached)."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    url = f"{_get_supabase_url()}/auth/v1/.well-known/jwks.json"
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    _jwks_cache = resp.json()
    return _jwks_cache


def _get_es256_key(kid: str) -> Any:
    """Find the ES256 public key matching the given key ID from JWKS."""
    jwks_data = _fetch_jwks()
    for key_data in jwks_data.get("keys", []):
        if key_data.get("kid") == kid:
            return jwk.construct(key_data, algorithm="ES256")
    raise ValueError(f"No JWKS key found for kid={kid}")


def _decode_token(token: str) -> dict[str, Any]:
    """Decode a Supabase JWT, supporting both ES256 (JWKS) and HS256 (legacy)."""
    # Peek at the header to determine algorithm
    try:
        header = jwt.get_unverified_header(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token header",
        )

    alg = header.get("alg", "")

    if alg == "ES256":
        kid = header.get("kid", "")
        try:
            key = _get_es256_key(kid)
        except (ValueError, httpx.HTTPError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unable to verify token signing key",
            )
        return jwt.decode(
            token,
            key,
            algorithms=["ES256"],
            options={"verify_aud": False},
        )

    # Fallback: legacy HS256
    secret = _get_jwt_secret()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No HS256 secret configured and token is not ES256",
        )
    return jwt.decode(
        token,
        secret,
        algorithms=["HS256"],
        options={"verify_aud": False},
    )


def get_current_lab_member(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> LabMember:
    """Validate a Supabase JWT and return the lab member's id and email.

    Supports both ES256 (new Supabase signing keys via JWKS) and
    HS256 (legacy JWT secret).
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
        )

    token = credentials.credentials

    try:
        payload = _decode_token(token)
    except HTTPException:
        raise
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    sub = payload.get("sub")
    email = payload.get("email")

    if not sub or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing required claims",
        )

    return LabMember(id=UUID(sub), email=email)


__all__ = ["LabMember", "get_current_lab_member"]
