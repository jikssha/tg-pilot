from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.orm import relationship

from backend.core.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    account_name = Column(String(100), unique=True, nullable=False, index=True)
    api_id = Column(String(64), nullable=False)
    api_hash = Column(String(128), nullable=False)
    remark = Column(String(255), nullable=True)
    proxy = Column(Text, nullable=True)  # store JSON string for proxy config
    session_backend = Column(String(32), nullable=True)
    session_ref = Column(String(255), nullable=True)
    status = Column(String(32), default="idle", nullable=False)
    last_status_message = Column(Text, nullable=True)
    last_checked_at = Column(DateTime, nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    tasks = relationship("Task", back_populates="account", cascade="all,delete")
