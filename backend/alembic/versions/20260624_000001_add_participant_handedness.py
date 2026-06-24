"""Add participant handedness for IHTT Poffenberger demographics.

Revision ID: 20260624_000001
Revises: 20260621_000001
Create Date: 2026-06-24 00:00:01.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260624_000001"
down_revision = "20260621_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("participants", sa.Column("handedness", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("participants", "handedness")
