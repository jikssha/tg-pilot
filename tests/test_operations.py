from __future__ import annotations

from datetime import date, datetime


def test_operations_service_builds_lightweight_overview(db_session):
    from backend.models.account import Account
    from backend.models.audit_event import AuditEvent
    from backend.models.daily_task_run import DailyTaskRun
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
            DailyTaskRun(
                task_name="daily-a",
                account_name="main-a",
                run_date=date.today(),
                window_start="08:00",
                window_end="20:00",
                planned_run_at=datetime.utcnow(),
                deadline_at=datetime.utcnow(),
                status="success",
                attempt_count=1,
                max_attempts=3,
                last_finished_at=datetime.utcnow(),
            ),
            DailyTaskRun(
                task_name="daily-b",
                account_name="main-b",
                run_date=date.today(),
                window_start="08:00",
                window_end="20:00",
                planned_run_at=datetime.utcnow(),
                deadline_at=datetime.utcnow(),
                status="retry_wait",
                attempt_count=1,
                max_attempts=3,
                next_retry_at=datetime.utcnow(),
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
    assert overview["daily_runs"]["total"] == 2
    assert overview["daily_runs"]["success"] == 1
    assert overview["daily_runs"]["retry_wait"] == 1
    assert len(overview["daily_runs"]["recent_runs"]) == 2
    assert len(overview["recent_audit"]) >= 1
