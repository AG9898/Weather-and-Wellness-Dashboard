"""Fix active pending invitation uniqueness (T153 follow-up).

The original partial unique index treated any unaccepted/unrevoked invite as
active, so an expired pending invite could block a fresh invite for the same
email. Active invite uniqueness should apply only to rows still marked pending.

Revision ID: 20260513_000001
Revises: 20260512_000001
Create Date: 2026-05-13 00:00:01.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260513_000001"
down_revision = "20260512_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE ra_invitations
        SET status = 'expired', updated_at = now()
        WHERE status = 'pending'
          AND expires_at <= now()
        """
    )
    op.drop_index("uq_ra_invitations_active_pending_email", table_name="ra_invitations")
    op.create_index(
        "uq_ra_invitations_active_pending_email",
        "ra_invitations",
        ["email"],
        unique=True,
        postgresql_where=sa.text(
            "status = 'pending' AND accepted_at IS NULL AND revoked_at IS NULL"
        ),
    )


def downgrade() -> None:
    op.drop_index("uq_ra_invitations_active_pending_email", table_name="ra_invitations")
    op.create_index(
        "uq_ra_invitations_active_pending_email",
        "ra_invitations",
        ["email"],
        unique=True,
        postgresql_where=sa.text("accepted_at IS NULL AND revoked_at IS NULL"),
    )
