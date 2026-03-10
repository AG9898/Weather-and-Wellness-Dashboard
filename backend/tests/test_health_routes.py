from __future__ import annotations

from app.main import health, root


def test_root_returns_ok() -> None:
    assert root() == {
        "status": "ok",
        "service": "Weather & Wellness Backend",
    }


def test_health_returns_ok() -> None:
    assert health() == {"status": "ok"}
