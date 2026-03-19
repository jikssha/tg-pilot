from __future__ import annotations

import json


def test_audit_service_persists_event(db_session):
    from backend.models.audit_event import AuditEvent
    from backend.services.audit import AuditService

    service = AuditService()
    service.record_action(
        action="export_sessions_zip",
        resource_type="session_bundle",
        resource_id="all",
        actor="admin",
        details={"filename": "tg_pilot_sessions.zip"},
    )

    row = db_session.query(AuditEvent).order_by(AuditEvent.id.desc()).first()
    assert row is not None
    assert row.action == "export_sessions_zip"
    assert row.actor == "admin"
    assert json.loads(row.details)["filename"] == "tg_pilot_sessions.zip"
