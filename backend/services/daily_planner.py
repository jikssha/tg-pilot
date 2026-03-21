from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from hashlib import sha256
from typing import Iterable

from backend.contracts.dtos import SignTaskDefinition
from backend.stores import get_daily_task_run_store, get_sign_task_store

DEFAULT_FIXED_TIME = "06:00"
DEFAULT_RANGE_START = "08:00"
DEFAULT_RANGE_END = "20:00"
DEFAULT_JITTER_RATIO = 0.25
DEFAULT_MAX_ATTEMPTS = 3
DEFAULT_DEADLINE_TIME = "23:00"
DEFAULT_DEADLINE_GRACE_HOURS = 3
PLANNER_SALT = "tg-pilot-daily-plan-v1"


@dataclass(slots=True)
class PlannedTask:
    task_name: str
    account_name: str
    run_date: date
    window_start: str
    window_end: str
    planned_run_at: datetime
    deadline_at: datetime
    max_attempts: int


def _normalize_hhmm(value: str | None, fallback: str) -> str:
    if not value:
        return fallback
    try:
        hour_raw, minute_raw = value.strip().split(":")
        hour = max(0, min(23, int(hour_raw)))
        minute = max(0, min(59, int(minute_raw)))
    except Exception:
        return fallback
    return f"{hour:02d}:{minute:02d}"


def _parse_hhmm(value: str | None, fallback: str) -> time:
    normalized = _normalize_hhmm(value, fallback)
    hour_raw, minute_raw = normalized.split(":")
    return time(hour=int(hour_raw), minute=int(minute_raw))


def _cron_to_hhmm(sign_at: str | None, fallback: str = DEFAULT_FIXED_TIME) -> str:
    if not sign_at:
        return fallback
    parts = sign_at.strip().split()
    if len(parts) != 5:
        return fallback
    try:
        minute = int(parts[0])
        hour = int(parts[1])
    except (TypeError, ValueError):
        return fallback
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        return fallback
    return f"{hour:02d}:{minute:02d}"


def _combine(run_date: date, hhmm: str, fallback: str) -> datetime:
    parsed = _parse_hhmm(hhmm, fallback)
    return datetime.combine(run_date, parsed)


def _end_of_day(run_date: date) -> datetime:
    return datetime.combine(run_date, time(23, 59, 59))


def _compute_deadline(
    *,
    run_date: date,
    planned_run_at: datetime,
    window_end: str,
) -> datetime:
    end_dt = _combine(run_date, window_end, DEFAULT_DEADLINE_TIME)
    deadline_floor = _combine(run_date, DEFAULT_DEADLINE_TIME, DEFAULT_DEADLINE_TIME)
    candidate = max(
        planned_run_at + timedelta(hours=DEFAULT_DEADLINE_GRACE_HOURS),
        end_dt + timedelta(hours=DEFAULT_DEADLINE_GRACE_HOURS),
        deadline_floor,
    )
    return min(candidate, _end_of_day(run_date))


def _stable_order_key(task: SignTaskDefinition, run_date: date) -> str:
    raw = f"{task.account_name}:{task.name}:{run_date.isoformat()}:{PLANNER_SALT}"
    return sha256(raw.encode("utf-8")).hexdigest()


def distribute_window_slots(
    tasks: Iterable[SignTaskDefinition],
    *,
    run_date: date,
    window_start: str,
    window_end: str,
    jitter_ratio: float = DEFAULT_JITTER_RATIO,
) -> list[PlannedTask]:
    ordered_tasks = sorted(tasks, key=lambda item: _stable_order_key(item, run_date))
    if not ordered_tasks:
        return []

    start_dt = _combine(run_date, window_start, DEFAULT_RANGE_START)
    end_dt = _combine(run_date, window_end, DEFAULT_RANGE_END)
    if end_dt <= start_dt:
        end_dt = start_dt + timedelta(hours=1)

    total_seconds = int((end_dt - start_dt).total_seconds())
    slot_seconds = max(total_seconds // len(ordered_tasks), 60)
    max_jitter = int(slot_seconds * max(0.0, min(jitter_ratio, 0.49)))

    plans: list[PlannedTask] = []
    for index, task in enumerate(ordered_tasks):
        slot_start = start_dt + timedelta(seconds=index * slot_seconds)
        slot_end = start_dt + timedelta(seconds=min((index + 1) * slot_seconds, total_seconds))
        slot_range = max(int((slot_end - slot_start).total_seconds()), 1)
        digest = sha256(
            f"{task.account_name}:{task.name}:{run_date.isoformat()}:jitter".encode("utf-8")
        ).digest()
        jitter_seed = int.from_bytes(digest[:8], "big")
        jitter = jitter_seed % max(slot_range, 1)
        if max_jitter > 0:
            jitter = min(jitter, max_jitter)

        planned_at = slot_start + timedelta(seconds=jitter)
        if planned_at >= end_dt:
            planned_at = end_dt - timedelta(seconds=1)

        plans.append(
            PlannedTask(
                task_name=task.name,
                account_name=task.account_name,
                run_date=run_date,
                window_start=_normalize_hhmm(window_start, DEFAULT_RANGE_START),
                window_end=_normalize_hhmm(window_end, DEFAULT_RANGE_END),
                planned_run_at=planned_at,
                deadline_at=_compute_deadline(
                    run_date=run_date,
                    planned_run_at=planned_at,
                    window_end=_normalize_hhmm(window_end, DEFAULT_RANGE_END),
                ),
                max_attempts=DEFAULT_MAX_ATTEMPTS,
            )
        )

    return plans


class DailyPlannerService:
    def __init__(self):
        self.task_store = get_sign_task_store()
        self.daily_run_store = get_daily_task_run_store()

    def _list_enabled_sign_tasks(self) -> list[SignTaskDefinition]:
        tasks = self.task_store.list_tasks(force_refresh=False)
        return [task for task in tasks if task.enabled]

    def _plan_fixed_task(self, task: SignTaskDefinition, run_date: date) -> PlannedTask:
        hhmm = _cron_to_hhmm(task.sign_at, DEFAULT_FIXED_TIME)
        planned_at = _combine(run_date, hhmm, DEFAULT_FIXED_TIME)
        return PlannedTask(
            task_name=task.name,
            account_name=task.account_name,
            run_date=run_date,
            window_start=hhmm,
            window_end=hhmm,
            planned_run_at=planned_at,
            deadline_at=_compute_deadline(
                run_date=run_date,
                planned_run_at=planned_at,
                window_end=hhmm,
            ),
            max_attempts=DEFAULT_MAX_ATTEMPTS,
        )

    def build_daily_plan(self, run_date: date | None = None) -> list[dict[str, object]]:
        target_date = run_date or date.today()
        tasks = self._list_enabled_sign_tasks()
        fixed_tasks: list[SignTaskDefinition] = []
        range_task_groups: dict[tuple[str, str], list[SignTaskDefinition]] = defaultdict(list)

        for task in tasks:
            if task.execution_mode == "range":
                start = task.range_start or DEFAULT_RANGE_START
                end = task.range_end or DEFAULT_RANGE_END
                range_task_groups[(start, end)].append(task)
            else:
                fixed_tasks.append(task)

        planned_tasks: list[PlannedTask] = [
            self._plan_fixed_task(task, target_date) for task in fixed_tasks
        ]

        for (window_start, window_end), grouped_tasks in range_task_groups.items():
            planned_tasks.extend(
                distribute_window_slots(
                    grouped_tasks,
                    run_date=target_date,
                    window_start=window_start,
                    window_end=window_end,
                )
            )

        results: list[dict[str, object]] = []
        valid_task_keys = {(task.account_name, task.name) for task in tasks}
        self.daily_run_store.prune_pending_runs_for_date(target_date, valid_task_keys)
        for planned in planned_tasks:
            results.append(
                self.daily_run_store.ensure_daily_run(
                    task_name=planned.task_name,
                    account_name=planned.account_name,
                    run_date=planned.run_date,
                    window_start=planned.window_start,
                    window_end=planned.window_end,
                    planned_run_at=planned.planned_run_at,
                    deadline_at=planned.deadline_at,
                    max_attempts=planned.max_attempts,
                )
            )
        return sorted(results, key=lambda item: str(item["planned_run_at"]))


_daily_planner_service: DailyPlannerService | None = None


def get_daily_planner_service() -> DailyPlannerService:
    global _daily_planner_service
    if _daily_planner_service is None:
        _daily_planner_service = DailyPlannerService()
    return _daily_planner_service
