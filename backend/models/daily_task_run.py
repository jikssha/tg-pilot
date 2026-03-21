from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Integer, String, Text, UniqueConstraint

from backend.core.database import Base


class DailyTaskRun(Base):
    __tablename__ = "daily_task_runs"
    __table_args__ = (
        UniqueConstraint(
            "task_name",
            "account_name",
            "run_date",
            name="uq_daily_task_runs_task_account_date",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    task_name = Column(String(100), nullable=False, index=True)
    account_name = Column(String(100), nullable=False, index=True)
    run_date = Column(Date, nullable=False, index=True)
    window_start = Column(String(16), nullable=False, default="")
    window_end = Column(String(16), nullable=False, default="")
    planned_run_at = Column(DateTime, nullable=False, index=True)
    status = Column(String(32), nullable=False, default="pending", index=True)
    attempt_count = Column(Integer, nullable=False, default=0)
    last_error_code = Column(String(64), nullable=True)
    last_error_message = Column(Text, nullable=True)
    last_started_at = Column(DateTime, nullable=True)
    last_finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    @property
    def run_key(self) -> str:
        return f"{self.account_name}:{self.task_name}:{self.run_date.isoformat()}"
