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
    )
    second = store.ensure_daily_run(
        task_name="daily-a",
        account_name="acc-1",
        run_date=run_date,
        window_start="08:00",
        window_end="20:00",
        planned_run_at=planned_at,
    )

    runs = store.list_runs_for_date(run_date)
    assert first["id"] == second["id"]
    assert len(runs) == 1
    assert runs[0]["task_name"] == "daily-a"
    assert runs[0]["status"] == "pending"
