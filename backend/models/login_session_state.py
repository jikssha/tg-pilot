from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from backend.core.database import Base


class LoginSessionState(Base):
    __tablename__ = "login_session_states"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(128), nullable=False, unique=True, index=True)
    flow_type = Column(String(16), nullable=False, index=True)
    account_name = Column(String(100), nullable=False, index=True)
    phone_number = Column(String(64), nullable=True)
    status = Column(String(64), nullable=False, default="pending", index=True)
    expires_at = Column(DateTime, nullable=True)
    payload = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
