"""phase 3 unified account and sign task metadata

Revision ID: 202603190003
Revises: 202603190002
Create Date: 2026-03-19 23:55:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202603190003"
down_revision = "202603190002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("remark", sa.String(length=255), nullable=True))
    op.add_column(
        "accounts", sa.Column("session_backend", sa.String(length=32), nullable=True)
    )
    op.add_column("accounts", sa.Column("session_ref", sa.String(length=255), nullable=True))
    op.add_column(
        "accounts", sa.Column("last_status_message", sa.Text(), nullable=True)
    )
    op.add_column("accounts", sa.Column("last_checked_at", sa.DateTime(), nullable=True))

    op.create_table(
        "sign_tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("account_name", sa.String(length=100), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("sign_at", sa.String(length=64), nullable=False),
        sa.Column("random_seconds", sa.Integer(), nullable=False),
        sa.Column("sign_interval", sa.Integer(), nullable=False),
        sa.Column("execution_mode", sa.String(length=32), nullable=False),
        sa.Column("range_start", sa.String(length=16), nullable=True),
        sa.Column("range_end", sa.String(length=16), nullable=True),
        sa.Column("chats_json", sa.Text(), nullable=False),
        sa.Column("last_run_at", sa.DateTime(), nullable=True),
        sa.Column("last_run_success", sa.Boolean(), nullable=True),
        sa.Column("last_run_message", sa.Text(), nullable=True),
        sa.Column("source_version", sa.Integer(), nullable=False),
        sa.Column("legacy_path", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("account_name", "name", name="uq_sign_tasks_account_name_name"),
    )
    op.create_index("ix_sign_tasks_account_name", "sign_tasks", ["account_name"], unique=False)
    op.create_index("ix_sign_tasks_id", "sign_tasks", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_sign_tasks_id", table_name="sign_tasks")
    op.drop_index("ix_sign_tasks_account_name", table_name="sign_tasks")
    op.drop_table("sign_tasks")

    op.drop_column("accounts", "last_checked_at")
    op.drop_column("accounts", "last_status_message")
    op.drop_column("accounts", "session_ref")
    op.drop_column("accounts", "session_backend")
    op.drop_column("accounts", "remark")
