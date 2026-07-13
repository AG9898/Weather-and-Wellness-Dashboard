"""add flagged session metadata

Revision ID: 20260712_000001
Revises: 20260624_000001
Create Date: 2026-07-12 22:14:33.127368

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260712_000001'
down_revision: Union[str, Sequence[str], None] = '20260624_000001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "sessions", sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "sessions", sa.Column("voided_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("sessions", sa.Column("void_reason", sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("sessions", "void_reason")
    op.drop_column("sessions", "voided_at")
    op.drop_column("sessions", "activated_at")
