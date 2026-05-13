"""No-op placeholder for historical clear-all-test-data revision.

This revision id is part of the existing Alembic chain:
20260228_000008 -> 20260228_000009 -> 20260301_000010.

The original 20260228_000009 migration was a one-off destructive demo-data
wipe and was referenced by later migrations, docs, and the repeatable
`app.scripts.clear_all_test_data` helper, but the revision file was missing
from the repository. Keep this migration non-destructive so fresh and existing
environments can traverse the revision graph without wiping data.

Revision ID: 20260228_000009
Revises: 20260228_000008
Create Date: 2026-02-28 00:00:09.000000
"""
from __future__ import annotations


revision = "20260228_000009"
down_revision = "20260228_000008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
