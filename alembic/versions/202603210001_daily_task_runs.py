"""add daily task runs for daily scheduling mvp

Revision ID: 202603210001
Revises: 202603190003
Create Date: 2026-03-21 10:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202603210001"
down_revision = "202603190003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "daily_task_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("task_name", sa.String(length=100), nullable=False),
        sa.Column("account_name", sa.String(length=100), nullable=False),
        sa.Column("run_date", sa.Date(), nullable=False),
        sa.Column("window_start", sa.String(length=16), nullable=False),
        sa.Column("window_end", sa.String(length=16), nullable=False),
        sa.Column("planned_run_at", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column("last_error_code", sa.String(length=64), nullable=True),
        sa.Column("last_error_message", sa.Text(), nullable=True),
        sa.Column("last_started_at", sa.DateTime(), nullable=True),
        sa.Column("last_finished_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "task_name",
            "account_name",
            "run_date",
            name="uq_daily_task_runs_task_account_date",
        ),
    )
    op.create_index("ix_daily_task_runs_id", "daily_task_runs", ["id"], unique=False)
    op.create_index(
        "ix_daily_task_runs_run_date",
        "daily_task_runs",
        ["run_date"],
        unique=False,
    )
    op.create_index(
        "ix_daily_task_runs_planned_run_at",
        "daily_task_runs",
        ["planned_run_at"],
        unique=False,
    )
    op.create_index(
        "ix_daily_task_runs_status",
        "daily_task_runs",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_daily_task_runs_account_name",
        "daily_task_runs",
        ["account_name"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_daily_task_runs_account_name", table_name="daily_task_runs")
    op.drop_index("ix_daily_task_runs_status", table_name="daily_task_runs")
    op.drop_index("ix_daily_task_runs_planned_run_at", table_name="daily_task_runs")
    op.drop_index("ix_daily_task_runs_run_date", table_name="daily_task_runs")
    op.drop_index("ix_daily_task_runs_id", table_name="daily_task_runs")
    op.drop_table("daily_task_runs")
