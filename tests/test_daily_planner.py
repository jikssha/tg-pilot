from __future__ import annotations

from datetime import date


def test_distribute_window_slots_spreads_tasks_within_window():
    from backend.contracts.dtos import SignTaskDefinition
    from backend.services.daily_planner import distribute_window_slots

    tasks = [
        SignTaskDefinition(
            name=f"task-{index}",
            account_name=f"acc-{index}",
            sign_at="0 8 * * *",
            execution_mode="range",
            range_start="08:00",
            range_end="20:00",
        )
        for index in range(15)
    ]

    plans = distribute_window_slots(
        tasks,
        run_date=date(2026, 3, 21),
        window_start="08:00",
        window_end="20:00",
    )

    assert len(plans) == 15
    planned_times = [plan.planned_run_at for plan in plans]
    assert planned_times == sorted(planned_times)
    assert planned_times[0].strftime("%H:%M") >= "08:00"
    assert planned_times[-1].strftime("%H:%M") <= "19:59"

    unique_hours = {planned.hour for planned in planned_times}
    assert len(unique_hours) >= 8


def test_build_daily_plan_creates_fixed_and_range_runs(db_session, monkeypatch):
    from backend.contracts.dtos import SignTaskDefinition
    from backend.services.daily_planner import DailyPlannerService

    tasks = [
        SignTaskDefinition(
            name="fixed-task",
            account_name="acc-fixed",
            sign_at="30 9 * * *",
            execution_mode="fixed",
        ),
        SignTaskDefinition(
            name="range-task",
            account_name="acc-range",
            sign_at="0 8 * * *",
            execution_mode="range",
            range_start="08:00",
            range_end="20:00",
        ),
    ]

    service = DailyPlannerService()
    monkeypatch.setattr(service, "_list_enabled_sign_tasks", lambda: tasks)

    plans = service.build_daily_plan(date(2026, 3, 21))

    assert len(plans) == 2
    fixed = next(item for item in plans if item["task_name"] == "fixed-task")
    ranged = next(item for item in plans if item["task_name"] == "range-task")

    assert fixed["planned_run_at"].startswith("2026-03-21T09:30:")
    assert fixed["window_start"] == "09:30"
    assert fixed["window_end"] == "09:30"
    assert ranged["window_start"] == "08:00"
    assert ranged["window_end"] == "20:00"


def test_build_daily_plan_is_idempotent_for_same_day(db_session, monkeypatch):
    from backend.contracts.dtos import SignTaskDefinition
    from backend.services.daily_planner import DailyPlannerService

    tasks = [
        SignTaskDefinition(
            name="repeatable",
            account_name="acc-repeat",
            sign_at="0 10 * * *",
            execution_mode="fixed",
        )
    ]

    service = DailyPlannerService()
    monkeypatch.setattr(service, "_list_enabled_sign_tasks", lambda: tasks)

    first = service.build_daily_plan(date(2026, 3, 21))
    second = service.build_daily_plan(date(2026, 3, 21))

    assert len(first) == 1
    assert len(second) == 1
    assert first[0]["id"] == second[0]["id"]
