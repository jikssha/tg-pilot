from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass(slots=True)
class SignTaskDefinition:
    name: str
    account_name: str
    sign_at: str
    chats: list[dict[str, Any]] = field(default_factory=list)
    random_seconds: int = 0
    sign_interval: int = 1
    enabled: bool = True
    last_run: dict[str, Any] | None = None
    execution_mode: str = "fixed"
    range_start: str = ""
    range_end: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "account_name": self.account_name,
            "sign_at": self.sign_at,
            "chats": self.chats,
            "random_seconds": self.random_seconds,
            "sign_interval": self.sign_interval,
            "enabled": self.enabled,
            "last_run": self.last_run,
            "execution_mode": self.execution_mode,
            "range_start": self.range_start,
            "range_end": self.range_end,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "SignTaskDefinition":
        return cls(
            name=str(payload.get("name") or ""),
            account_name=str(payload.get("account_name") or ""),
            sign_at=str(payload.get("sign_at") or ""),
            chats=list(payload.get("chats") or []),
            random_seconds=int(payload.get("random_seconds") or 0),
            sign_interval=int(payload.get("sign_interval") or 1),
            enabled=bool(payload.get("enabled", True)),
            last_run=payload.get("last_run"),
            execution_mode=str(payload.get("execution_mode") or "fixed"),
            range_start=str(payload.get("range_start") or ""),
            range_end=str(payload.get("range_end") or ""),
        )


@dataclass(slots=True)
class TaskRunRecord:
    time: str
    success: bool
    message: str = ""
    flow_logs: list[str] = field(default_factory=list)
    flow_truncated: bool = False
    flow_line_count: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "time": self.time,
            "success": self.success,
            "message": self.message,
            "flow_logs": self.flow_logs,
            "flow_truncated": self.flow_truncated,
            "flow_line_count": self.flow_line_count,
        }


@dataclass(slots=True)
class AuditEventCreate:
    action: str
    resource_type: str
    resource_id: str | None = None
    actor: str | None = None
    status: str = "success"
    details: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class LoginSessionSnapshot:
    session_id: str
    flow_type: str
    account_name: str
    status: str
    phone_number: str | None = None
    expires_at: datetime | None = None
    payload: dict[str, Any] = field(default_factory=dict)
