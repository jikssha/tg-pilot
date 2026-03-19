from __future__ import annotations


def test_operations_service_builds_lightweight_overview(db_session):
    from backend.models.account import Account
    from backend.models.audit_event import AuditEvent
    from backend.models.sign_task import SignTask
    from backend.services.operations import OperationsService

    db_session.add_all(
        [
            Account(account_name="main-a", api_id="1", api_hash="hash", status="valid"),
            Account(account_name="main-b", api_id="1", api_hash="hash", status="invalid"),
            SignTask(
                name="daily-a",
                account_name="main-a",
                enabled=True,
                sign_at="0 6 * * *",
                chats_json="[]",
                last_run_success=True,
            ),
            SignTask(
                name="daily-b",
                account_name="main-b",
                enabled=False,
                sign_at="0 8 * * *",
                chats_json="[]",
                last_run_success=False,
            ),
            AuditEvent(
                action="import_all_configs",
                resource_type="config_bundle",
                resource_id="all",
                actor="admin",
                status="success",
            ),
        ]
    )
    db_session.commit()

    overview = OperationsService().get_overview(
        ready=True,
        readiness_checks={"storage": True, "database": True},
        readiness_details={},
    )

    assert overview["readiness"]["ready"] is True
    assert overview["accounts"]["total"] == 2
    assert overview["accounts"]["statuses"]["valid"] == 1
    assert overview["accounts"]["statuses"]["invalid"] == 1
    assert overview["sign_tasks"]["total"] == 2
    assert overview["sign_tasks"]["enabled"] == 1
    assert overview["sign_tasks"]["disabled"] == 1
    assert overview["sign_tasks"]["last_run_success"] == 1
    assert overview["sign_tasks"]["last_run_failed"] == 1
    assert len(overview["recent_audit"]) >= 1
