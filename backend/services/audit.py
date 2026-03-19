from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy.orm import Query

from backend.contracts.dtos import AuditEventCreate
from backend.core.database import get_session_local
from backend.models.audit_event import AuditEvent

logger = logging.getLogger("backend.audit")


class AuditService:
    @staticmethod
    def _serialize_event(row: AuditEvent) -> dict[str, Any]:
        parsed_details: dict[str, Any] | None = None
        if row.details:
            try:
                loaded = json.loads(row.details)
                if isinstance(loaded, dict):
                    parsed_details = loaded
            except json.JSONDecodeError:
                parsed_details = {"raw": row.details}

        return {
            "id": row.id,
            "action": row.action,
            "resource_type": row.resource_type,
            "resource_id": row.resource_id,
            "actor": row.actor,
            "status": row.status,
            "details": parsed_details,
            "created_at": row.created_at.isoformat() + "Z",
        }

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

    def list_events(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        action: str | None = None,
        resource_type: str | None = None,
        status: str | None = None,
    ) -> dict[str, Any]:
        db = get_session_local()()
        try:
            query: Query[AuditEvent] = db.query(AuditEvent)
            if action:
                query = query.filter(AuditEvent.action == action)
            if resource_type:
                query = query.filter(AuditEvent.resource_type == resource_type)
            if status:
                query = query.filter(AuditEvent.status == status)

            total = query.count()
            rows = (
                query.order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc())
                .offset(offset)
                .limit(limit)
                .all()
            )
            return {
                "items": [self._serialize_event(row) for row in rows],
                "total": total,
                "limit": limit,
                "offset": offset,
            }
        finally:
            db.close()


_audit_service: AuditService | None = None


def get_audit_service() -> AuditService:
    global _audit_service
    if _audit_service is None:
        _audit_service = AuditService()
    return _audit_service
