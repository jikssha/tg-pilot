"""phase 2 transient state and audit tables

Revision ID: 202603190002
Revises: 202603190001
Create Date: 2026-03-19 23:10:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202603190002"
down_revision = "202603190001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("resource_type", sa.String(length=64), nullable=False),
        sa.Column("resource_id", sa.String(length=255), nullable=True),
        sa.Column("actor", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_events_action", "audit_events", ["action"], unique=False)
    op.create_index("ix_audit_events_created_at", "audit_events", ["created_at"], unique=False)
    op.create_index("ix_audit_events_id", "audit_events", ["id"], unique=False)
    op.create_index(
        "ix_audit_events_resource_type",
        "audit_events",
        ["resource_type"],
        unique=False,
    )

    op.create_table(
        "login_session_states",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.String(length=128), nullable=False),
        sa.Column("flow_type", sa.String(length=16), nullable=False),
        sa.Column("account_name", sa.String(length=100), nullable=False),
        sa.Column("phone_number", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("payload", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_login_session_states_account_name",
        "login_session_states",
        ["account_name"],
        unique=False,
    )
    op.create_index(
        "ix_login_session_states_flow_type",
        "login_session_states",
        ["flow_type"],
        unique=False,
    )
    op.create_index("ix_login_session_states_id", "login_session_states", ["id"], unique=False)
    op.create_index(
        "ix_login_session_states_session_id",
        "login_session_states",
        ["session_id"],
        unique=True,
    )
    op.create_index(
        "ix_login_session_states_status",
        "login_session_states",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_login_session_states_status", table_name="login_session_states")
    op.drop_index("ix_login_session_states_session_id", table_name="login_session_states")
    op.drop_index("ix_login_session_states_id", table_name="login_session_states")
    op.drop_index("ix_login_session_states_flow_type", table_name="login_session_states")
    op.drop_index("ix_login_session_states_account_name", table_name="login_session_states")
    op.drop_table("login_session_states")

    op.drop_index("ix_audit_events_resource_type", table_name="audit_events")
    op.drop_index("ix_audit_events_id", table_name="audit_events")
    op.drop_index("ix_audit_events_created_at", table_name="audit_events")
    op.drop_index("ix_audit_events_action", table_name="audit_events")
    op.drop_table("audit_events")
