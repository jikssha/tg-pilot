from __future__ import annotations

from datetime import date, datetime


def test_ensure_daily_run_is_idempotent(db_session):
    from backend.stores.daily_task_runs import get_daily_task_run_store

    store = get_daily_task_run_store()
    run_date = date(2026, 3, 21)
    planned_at = datetime(2026, 3, 21, 9, 15)

    first = store.ensure_daily_run(
        task_name="daily-a",
        account_name="acc-1",
        run_date=run_date,
        window_start="08:00",
        window_end="20:00",
        planned_run_at=planned_at,
        deadline_at=datetime(2026, 3, 21, 23, 0),
        max_attempts=4,
    )
    second = store.ensure_daily_run(
        task_name="daily-a",
        account_name="acc-1",
        run_date=run_date,
        window_start="08:00",
        window_end="20:00",
        planned_run_at=planned_at,
        deadline_at=datetime(2026, 3, 21, 23, 0),
        max_attempts=4,
    )

    runs = store.list_runs_for_date(run_date)
    assert first["id"] == second["id"]
    assert len(runs) == 1
    assert runs[0]["task_name"] == "daily-a"
    assert runs[0]["status"] == "pending"
    assert runs[0]["max_attempts"] == 4
    assert runs[0]["deadline_at"].startswith("2026-03-21T23:00:")


def test_retry_wait_run_becomes_due_by_next_retry_at(db_session):
    from backend.stores.daily_task_runs import get_daily_task_run_store

    store = get_daily_task_run_store()
    run = store.ensure_daily_run(
        task_name="retry-a",
        account_name="acc-retry",
        run_date=date(2026, 3, 21),
        window_start="08:00",
        window_end="20:00",
        planned_run_at=datetime(2026, 3, 21, 9, 0),
        deadline_at=datetime(2026, 3, 21, 23, 0),
        max_attempts=3,
    )

    store.mark_running(int(run["id"]))
    store.mark_retry_wait(
        int(run["id"]),
        next_retry_at=datetime(2026, 3, 21, 9, 5),
        error_code="TIMEOUT",
        error_message="timed out",
    )

    due = store.list_due_runs(datetime(2026, 3, 21, 9, 6))

    assert len(due) == 1
    assert due[0]["status"] == "retry_wait"
    assert due[0]["task_name"] == "retry-a"


def test_expire_overdue_runs_marks_retry_wait_as_expired(db_session):
    from backend.stores.daily_task_runs import get_daily_task_run_store

    store = get_daily_task_run_store()
    run = store.ensure_daily_run(
        task_name="expired-a",
        account_name="acc-expired",
        run_date=date(2026, 3, 21),
        window_start="08:00",
        window_end="20:00",
        planned_run_at=datetime(2026, 3, 21, 9, 0),
        deadline_at=datetime(2026, 3, 21, 9, 10),
        max_attempts=3,
    )

    store.mark_running(int(run["id"]))
    store.mark_retry_wait(
        int(run["id"]),
        next_retry_at=datetime(2026, 3, 21, 9, 12),
        error_code="TIMEOUT",
        error_message="timed out",
    )

    expired = store.expire_overdue_runs(datetime(2026, 3, 21, 9, 15))
    refreshed = store.get_daily_run(
        task_name="expired-a",
        account_name="acc-expired",
        run_date=date(2026, 3, 21),
    )

    assert expired == 1
    assert refreshed is not None
    assert refreshed["status"] == "expired"
    assert refreshed["last_error_code"] == "DEADLINE_EXCEEDED"
