"""Drop first_name and last_name from participants (anonymous participants)

Revision ID: 20260227_000006
Revises: 20260226_000005
Create Date: 2026-02-27 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260227_000006"
down_revision = "20260226_000005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("participants", "first_name")
    op.drop_column("participants", "last_name")


def downgrade() -> None:
    # Add with server_default to satisfy NOT NULL on existing rows, then drop the default
    op.add_column(
        "participants",
        sa.Column("last_name", sa.String(), nullable=False, server_default=""),
    )
    op.add_column(
        "participants",
        sa.Column("first_name", sa.String(), nullable=False, server_default=""),
    )
    op.alter_column("participants", "first_name", server_default=None)
    op.alter_column("participants", "last_name", server_default=None)
