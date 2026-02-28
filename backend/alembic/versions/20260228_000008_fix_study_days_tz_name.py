"""Fix study_days.tz_name: Edmonton → Vancouver (T47a)

The study timezone is America/Vancouver (Pacific Time). The original migration
(20260226_000005) incorrectly used America/Edmonton (Mountain Time) as the
server_default and the weather ingest code wrote that value to all rows.

This migration:
1. Updates all existing study_days rows from 'America/Edmonton' to 'America/Vancouver'.
2. Changes the server_default to 'America/Vancouver' so new rows are correct.

Revision ID: 20260228_000008
Revises: 20260228_000007
Create Date: 2026-02-28 00:00:00.000000

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260228_000008"
down_revision = "20260228_000007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Fix existing rows that were written with the wrong timezone
    op.execute(
        sa.text(
            "UPDATE study_days SET tz_name = 'America/Vancouver' "
            "WHERE tz_name = 'America/Edmonton'"
        )
    )
    # Change server_default to America/Vancouver for new rows
    op.alter_column(
        "study_days",
        "tz_name",
        server_default="America/Vancouver",
        existing_type=sa.String(),
        existing_nullable=False,
    )


def downgrade() -> None:
    # Revert server_default
    op.alter_column(
        "study_days",
        "tz_name",
        server_default="America/Edmonton",
        existing_type=sa.String(),
        existing_nullable=False,
    )
    # Revert data rows that were changed
    op.execute(
        sa.text(
            "UPDATE study_days SET tz_name = 'America/Edmonton' "
            "WHERE tz_name = 'America/Vancouver'"
        )
    )
