"""add retry scheduling fields to daily task runs

Revision ID: 202603210002
Revises: 202603210001
Create Date: 2026-03-21 22:40:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202603210002"
down_revision = "202603210001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "daily_task_runs",
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="3"),
    )
    op.add_column(
        "daily_task_runs",
        sa.Column("next_retry_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "daily_task_runs",
        sa.Column("deadline_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_daily_task_runs_next_retry_at",
        "daily_task_runs",
        ["next_retry_at"],
        unique=False,
    )
    op.create_index(
        "ix_daily_task_runs_deadline_at",
        "daily_task_runs",
        ["deadline_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_daily_task_runs_deadline_at", table_name="daily_task_runs")
    op.drop_index("ix_daily_task_runs_next_retry_at", table_name="daily_task_runs")
    op.drop_column("daily_task_runs", "deadline_at")
    op.drop_column("daily_task_runs", "next_retry_at")
    op.drop_column("daily_task_runs", "max_attempts")
