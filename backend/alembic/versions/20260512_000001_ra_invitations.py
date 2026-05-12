"""Add ra_invitations table (T150).

App-owned invitation table for admin-managed RA/admin onboarding.
Stores durable invite state and links invite acceptance to Supabase Auth
user creation. Raw invite tokens are never stored; only the hash is kept.

Revision ID: 20260512_000001
Revises: 20260420_000001
Create Date: 2026-05-12 00:00:01.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "20260512_000001"
down_revision = "20260420_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ra_invitations",
        sa.Column("invitation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("lab_name", sa.String(), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column(
            "expires_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now() + interval '7 days'"),
        ),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "revoked_by_lab_member_id", postgresql.UUID(as_uuid=True), nullable=True
        ),
        sa.Column(
            "created_by_lab_member_id", postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column("supabase_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("last_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "send_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("provider_message_id", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("invitation_id", name=op.f("pk_ra_invitations")),
        sa.UniqueConstraint("token_hash", name="uq_ra_invitations_token_hash"),
    )
    op.create_index("ix_ra_invitations_email", "ra_invitations", ["email"])
    op.create_index("ix_ra_invitations_status", "ra_invitations", ["status"])
    op.create_index("ix_ra_invitations_expires_at", "ra_invitations", ["expires_at"])
    # Partial unique index: at most one active pending invite per email address.
    op.create_index(
        "uq_ra_invitations_active_pending_email",
        "ra_invitations",
        ["email"],
        unique=True,
        postgresql_where=sa.text("accepted_at IS NULL AND revoked_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_ra_invitations_active_pending_email", table_name="ra_invitations")
    op.drop_index("ix_ra_invitations_expires_at", table_name="ra_invitations")
    op.drop_index("ix_ra_invitations_status", table_name="ra_invitations")
    op.drop_index("ix_ra_invitations_email", table_name="ra_invitations")
    op.drop_table("ra_invitations")
