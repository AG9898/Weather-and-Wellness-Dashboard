import os
from typing import AsyncGenerator, Optional

from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase


# Alembic-friendly naming convention for constraints and indexes
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def get_database_url() -> Optional[str]:
    """Return the DATABASE_URL from environment (never hardcoded)."""
    return os.getenv("DATABASE_URL")


def _as_asyncpg_url(url: str) -> str:
    """Ensure a PostgreSQL URL uses the asyncpg driver for async SQLAlchemy.

    Accepts common variants like `postgres://...` or `postgresql://...` or
    `postgresql+psycopg://...` and returns a URL starting with
    `postgresql+asyncpg://`.
    """
    if "+asyncpg" in url:
        return url
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql+psycopg://"):
        return url.replace("postgresql+psycopg://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def create_engine(url: Optional[str] = None) -> AsyncEngine:
    """Create and return the async SQLAlchemy engine.

    The URL is taken from the `DATABASE_URL` env var when not provided.
    """
    db_url = url or get_database_url()
    if not db_url:
        raise RuntimeError(
            "DATABASE_URL is not set; export it in your environment (.env)."
        )
    return create_async_engine(_as_asyncpg_url(db_url), pool_pre_ping=True)


_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = create_engine()
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _session_factory


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an AsyncSession."""
    async with get_session_factory()() as session:
        yield session

# Note: We intentionally avoid creating the engine/session factory at import time
# to ensure this module can be imported without DATABASE_URL being set. Use
# `get_engine()` and `get_session_factory()` to obtain instances at runtime.

# Alias for acceptance criteria: provide an importable name
# `from app.db import Base, async_session_factory`
async_session_factory = get_session_factory  # type: ignore
