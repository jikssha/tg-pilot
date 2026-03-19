"""baseline schema

Revision ID: 202603190001
Revises:
Create Date: 2026-03-19 21:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202603190001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_name", sa.String(length=100), nullable=False),
        sa.Column("api_id", sa.String(length=64), nullable=False),
        sa.Column("api_hash", sa.String(length=128), nullable=False),
        sa.Column("proxy", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("last_login_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_accounts_account_name", "accounts", ["account_name"], unique=True)
    op.create_index("ix_accounts_id", "accounts", ["id"], unique=False)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("totp_secret", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("cron", sa.String(length=64), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("last_run_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tasks_account_id", "tasks", ["account_id"], unique=False)
    op.create_index("ix_tasks_id", "tasks", ["id"], unique=False)

    op.create_table(
        "task_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("log_path", sa.String(length=255), nullable=True),
        sa.Column("output", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_task_logs_id", "task_logs", ["id"], unique=False)
    op.create_index("ix_task_logs_task_id", "task_logs", ["task_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_task_logs_task_id", table_name="task_logs")
    op.drop_index("ix_task_logs_id", table_name="task_logs")
    op.drop_table("task_logs")

    op.drop_index("ix_tasks_id", table_name="tasks")
    op.drop_index("ix_tasks_account_id", table_name="tasks")
    op.drop_table("tasks")

    op.drop_index("ix_users_username", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")

    op.drop_index("ix_accounts_id", table_name="accounts")
    op.drop_index("ix_accounts_account_name", table_name="accounts")
    op.drop_table("accounts")
