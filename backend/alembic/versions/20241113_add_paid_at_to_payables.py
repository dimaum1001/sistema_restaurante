"""add paid_at column to payables

Revision ID: 20241113_add_paid_at
Revises: 
Create Date: 2025-11-13 17:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20241113_add_paid_at"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "payables",
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("payables", "paid_at")
