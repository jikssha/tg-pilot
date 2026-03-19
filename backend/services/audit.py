from __future__ import annotations

import json
import logging
from typing import Any

from backend.contracts.dtos import AuditEventCreate
from backend.core.database import get_session_local
from backend.models.audit_event import AuditEvent

logger = logging.getLogger("backend.audit")


class AuditService:
    def record(self, event: AuditEventCreate) -> None:
        db = get_session_local()()
        try:
            db.add(
                AuditEvent(
                    action=event.action,
                    resource_type=event.resource_type,
                    resource_id=event.resource_id,
                    actor=event.actor,
                    status=event.status,
                    details=json.dumps(event.details, ensure_ascii=False, default=str)
                    if event.details
                    else None,
                )
            )
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.warning(
                "Failed to persist audit event action=%s resource=%s/%s: %s",
                event.action,
                event.resource_type,
                event.resource_id,
                exc,
            )
        finally:
            db.close()

    def record_action(
        self,
        *,
        action: str,
        resource_type: str,
        resource_id: str | None = None,
        actor: str | None = None,
        status: str = "success",
        details: dict[str, Any] | None = None,
    ) -> None:
        self.record(
            AuditEventCreate(
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                actor=actor,
                status=status,
                details=details or {},
            )
        )


_audit_service: AuditService | None = None


def get_audit_service() -> AuditService:
    global _audit_service
    if _audit_service is None:
        _audit_service = AuditService()
    return _audit_service
