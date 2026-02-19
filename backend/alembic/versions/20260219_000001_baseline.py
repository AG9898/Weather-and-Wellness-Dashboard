"""baseline empty migration

Revision ID: 20260219_000001
Revises: 
Create Date: 2026-02-19 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260219_000001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No-op baseline
    pass


def downgrade() -> None:
    # No-op baseline
    pass

