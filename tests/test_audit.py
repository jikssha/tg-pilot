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


def test_audit_service_lists_serialized_events(db_session):
    from backend.services.audit import AuditService

    service = AuditService()
    service.record_action(
        action="import_all_configs",
        resource_type="config_bundle",
        resource_id="all",
        actor="admin",
        status="success",
        details={"overwrite": True, "signs_imported": 2},
    )

    result = service.list_events(limit=10, action="import_all_configs")

    assert result["total"] >= 1
    item = result["items"][0]
    assert item["action"] == "import_all_configs"
    assert item["details"]["overwrite"] is True
    assert item["status"] == "success"
