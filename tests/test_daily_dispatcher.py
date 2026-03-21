from __future__ import annotations

from datetime import date, datetime

import pytest


@pytest.mark.asyncio
async def test_daily_dispatcher_marks_success_for_completed_run(db_session):
    from backend.services.daily_dispatcher import DailyDispatcherService
    from backend.stores.daily_task_runs import get_daily_task_run_store

    store = get_daily_task_run_store()
    run = store.ensure_daily_run(
        task_name="success-task",
        account_name="acc-success",
        run_date=date(2026, 3, 21),
        window_start="08:00",
        window_end="20:00",
        planned_run_at=datetime(2026, 3, 21, 9, 0),
    )

    dispatcher = DailyDispatcherService()

    async def fake_run_task_with_logs(account_name: str, task_name: str):
        assert account_name == "acc-success"
        assert task_name == "success-task"
        return {"success": True, "error": "", "output": "done"}

    dispatcher.sign_task_service.run_task_with_logs = fake_run_task_with_logs  # type: ignore[method-assign]

    await dispatcher._execute_run(int(run["id"]), run)

    refreshed = store.get_daily_run(
        task_name="success-task",
        account_name="acc-success",
        run_date=date(2026, 3, 21),
    )
    assert refreshed is not None
    assert refreshed["status"] == "success"
    assert refreshed["attempt_count"] == 0


@pytest.mark.asyncio
async def test_daily_dispatcher_marks_blocked_for_invalid_session(db_session):
    from backend.services.daily_dispatcher import DailyDispatcherService
    from backend.stores.daily_task_runs import get_daily_task_run_store

    store = get_daily_task_run_store()
    run = store.ensure_daily_run(
        task_name="blocked-task",
        account_name="acc-blocked",
        run_date=date(2026, 3, 21),
        window_start="08:00",
        window_end="20:00",
        planned_run_at=datetime(2026, 3, 21, 9, 0),
    )

    dispatcher = DailyDispatcherService()

    async def fake_run_task_with_logs(account_name: str, task_name: str):
        return {
            "success": False,
            "error": "任务执行出错: AUTH_KEY_UNREGISTERED",
            "output": "",
        }

    dispatcher.sign_task_service.run_task_with_logs = fake_run_task_with_logs  # type: ignore[method-assign]

    await dispatcher._execute_run(int(run["id"]), run)

    refreshed = store.get_daily_run(
        task_name="blocked-task",
        account_name="acc-blocked",
        run_date=date(2026, 3, 21),
    )
    assert refreshed is not None
    assert refreshed["status"] == "blocked"
    assert refreshed["last_error_code"] == "ACCOUNT_SESSION_INVALID"


@pytest.mark.asyncio
async def test_dispatch_due_runs_marks_running_before_launch(db_session):
    from backend.services.daily_dispatcher import DailyDispatcherService
    from backend.stores.daily_task_runs import get_daily_task_run_store

    store = get_daily_task_run_store()
    store.ensure_daily_run(
        task_name="pending-task",
        account_name="acc-pending",
        run_date=date(2026, 3, 21),
        window_start="08:00",
        window_end="20:00",
        planned_run_at=datetime(2026, 3, 21, 8, 0),
    )

    dispatcher = DailyDispatcherService()

    async def fake_execute(run_id: int, snapshot: dict[str, object]):
        return None

    dispatcher._execute_run = fake_execute  # type: ignore[method-assign]

    launched = await dispatcher.dispatch_due_runs(now=datetime(2026, 3, 21, 9, 0))

    refreshed = store.get_daily_run(
        task_name="pending-task",
        account_name="acc-pending",
        run_date=date(2026, 3, 21),
    )

    assert launched == 1
    assert refreshed is not None
    assert refreshed["status"] == "running"
    assert int(refreshed["attempt_count"]) == 1


@pytest.mark.asyncio
async def test_daily_dispatcher_marks_retry_wait_for_retryable_error(db_session):
    from backend.services.daily_dispatcher import DailyDispatcherService
    from backend.stores.daily_task_runs import get_daily_task_run_store

    store = get_daily_task_run_store()
    run = store.ensure_daily_run(
        task_name="retry-task",
        account_name="acc-retry",
        run_date=date(2026, 3, 21),
        window_start="08:00",
        window_end="20:00",
        planned_run_at=datetime(2026, 3, 21, 9, 0),
        deadline_at=datetime(2026, 3, 21, 23, 0),
        max_attempts=3,
    )
    running = store.mark_running(int(run["id"]))
    assert running is not None

    dispatcher = DailyDispatcherService()

    async def fake_run_task_with_logs(account_name: str, task_name: str):
        return {
            "success": False,
            "error": "任务执行出错: connection timeout",
            "output": "",
        }

    dispatcher.sign_task_service.run_task_with_logs = fake_run_task_with_logs  # type: ignore[method-assign]

    await dispatcher._execute_run(int(run["id"]), running)

    refreshed = store.get_daily_run(
        task_name="retry-task",
        account_name="acc-retry",
        run_date=date(2026, 3, 21),
    )
    assert refreshed is not None
    assert refreshed["status"] == "retry_wait"
    assert refreshed["next_retry_at"] is not None
    assert refreshed["last_error_code"] == "RETRYABLE_TASK_FAILURE"


@pytest.mark.asyncio
async def test_daily_dispatcher_marks_failed_after_max_attempts(db_session):
    from backend.services.daily_dispatcher import DailyDispatcherService
    from backend.stores.daily_task_runs import get_daily_task_run_store

    store = get_daily_task_run_store()
    run = store.ensure_daily_run(
        task_name="failed-task",
        account_name="acc-failed",
        run_date=date(2026, 3, 21),
        window_start="08:00",
        window_end="20:00",
        planned_run_at=datetime(2026, 3, 21, 9, 0),
        deadline_at=datetime(2026, 3, 21, 23, 0),
        max_attempts=1,
    )
    running = store.mark_running(int(run["id"]))
    assert running is not None

    dispatcher = DailyDispatcherService()

    async def fake_run_task_with_logs(account_name: str, task_name: str):
        return {
            "success": False,
            "error": "任务执行出错: connection timeout",
            "output": "",
        }

    dispatcher.sign_task_service.run_task_with_logs = fake_run_task_with_logs  # type: ignore[method-assign]

    await dispatcher._execute_run(int(run["id"]), running)

    refreshed = store.get_daily_run(
        task_name="failed-task",
        account_name="acc-failed",
        run_date=date(2026, 3, 21),
    )
    assert refreshed is not None
    assert refreshed["status"] == "failed"
    assert refreshed["next_retry_at"] is None


@pytest.mark.asyncio
async def test_dispatch_due_runs_expires_overdue_retry_wait_runs(db_session):
    from backend.services.daily_dispatcher import DailyDispatcherService
    from backend.stores.daily_task_runs import get_daily_task_run_store

    store = get_daily_task_run_store()
    run = store.ensure_daily_run(
        task_name="expired-task",
        account_name="acc-expired",
        run_date=date(2026, 3, 21),
        window_start="08:00",
        window_end="20:00",
        planned_run_at=datetime(2026, 3, 21, 9, 0),
        deadline_at=datetime(2026, 3, 21, 9, 5),
        max_attempts=3,
    )
    store.mark_running(int(run["id"]))
    store.mark_retry_wait(
        int(run["id"]),
        next_retry_at=datetime(2026, 3, 21, 9, 10),
        error_code="TIMEOUT",
        error_message="timed out",
    )

    dispatcher = DailyDispatcherService()
    launched = await dispatcher.dispatch_due_runs(now=datetime(2026, 3, 21, 9, 15))

    refreshed = store.get_daily_run(
        task_name="expired-task",
        account_name="acc-expired",
        run_date=date(2026, 3, 21),
    )
    assert launched == 0
    assert refreshed is not None
    assert refreshed["status"] == "expired"
