from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

from backend.core.database import Base


class SignTask(Base):
    __tablename__ = "sign_tasks"
    __table_args__ = (
        UniqueConstraint("account_name", "name", name="uq_sign_tasks_account_name_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    account_name = Column(String(100), nullable=False, index=True)
    enabled = Column(Boolean, default=True, nullable=False)
    sign_at = Column(String(64), nullable=False)
    random_seconds = Column(Integer, default=0, nullable=False)
    sign_interval = Column(Integer, default=1, nullable=False)
    execution_mode = Column(String(32), default="fixed", nullable=False)
    range_start = Column(String(16), nullable=True)
    range_end = Column(String(16), nullable=True)
    chats_json = Column(Text, nullable=False, default="[]")
    last_run_at = Column(DateTime, nullable=True)
    last_run_success = Column(Boolean, nullable=True)
    last_run_message = Column(Text, nullable=True)
    source_version = Column(Integer, default=3, nullable=False)
    legacy_path = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
