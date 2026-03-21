from __future__ import annotations

import asyncio
import logging
import os
from datetime import date, datetime, timedelta

from backend.services.sign_tasks import get_sign_task_service
from backend.stores import get_daily_task_run_store

logger = logging.getLogger("backend.daily_dispatcher")

BLOCKED_ERROR_MARKERS = (
    "ACCOUNT_SESSION_INVALID",
    "登录已失效",
    "session_string 不存在",
    "session 文件不存在",
    "session 不存在",
    "AUTH_KEY_UNREGISTERED",
    "AUTH_KEY_INVALID",
)

RETRYABLE_ERROR_MARKERS = (
    "TIMEOUT",
    "TIMED OUT",
    "CONNECTION",
    "NETWORK",
    "TEMPORARY",
    "TEMPORARILY",
    "DATABASE IS LOCKED",
    "FLOODWAIT",
    "FLOOD_WAIT",
    "TRY AGAIN",
    "SERVER DISCONNECTED",
)
RETRY_BACKOFF_SECONDS = (120, 300, 600)
DEFAULT_RETRY_ERROR_CODE = "RETRYABLE_TASK_FAILURE"


def use_daily_run_dispatch() -> bool:
    raw = (os.getenv("SIGN_DISPATCH_MODE") or "daily_run").strip().lower()
    return raw not in {"legacy", "off", "0", "false", "no"}


class DailyDispatcherService:
    def __init__(self):
        self.daily_run_store = get_daily_task_run_store()
        self.sign_task_service = get_sign_task_service()
        self._active_run_ids: set[int] = set()

    def recover_today_runs(self, run_date: date | None = None) -> int:
        target_date = run_date or date.today()
        return self.daily_run_store.reset_running_runs(target_date)

    async def dispatch_due_runs(self, now: datetime | None = None) -> int:
        current = now or datetime.now()
        expired = self.daily_run_store.expire_overdue_runs(current)
        if expired:
            logger.warning("Daily dispatcher expired %s overdue run(s)", expired)
        batch_size = max(1, min(int(os.getenv("SIGN_DAILY_DISPATCH_BATCH", "10")), 100))
        due_runs = self.daily_run_store.list_due_runs(current, limit=batch_size)
        if not due_runs:
            return 0

        launched = 0
        for item in due_runs:
            run_id = int(item["id"])
            if run_id in self._active_run_ids:
                continue
            marked = self.daily_run_store.mark_running(run_id)
            if not marked or marked.get("status") != "running":
                continue
            self._active_run_ids.add(run_id)
            asyncio.create_task(self._execute_run(run_id, marked))
            launched += 1

        return launched

    async def _execute_run(self, run_id: int, snapshot: dict[str, object]) -> None:
        account_name = str(snapshot["account_name"])
        task_name = str(snapshot["task_name"])
        try:
            result = await self.sign_task_service.run_task_with_logs(account_name, task_name)
            if result.get("success"):
                self.daily_run_store.mark_success(run_id)
                return

            error_message = str(result.get("error") or "").strip()
            error_code = "TASK_EXECUTION_FAILED"
            if self._should_block(error_message):
                self.daily_run_store.mark_blocked(
                    run_id,
                    error_code="ACCOUNT_SESSION_INVALID",
                    error_message=error_message,
                )
            elif self._should_retry(snapshot, error_message):
                next_retry_at = self._compute_next_retry_at(snapshot, error_message)
                self.daily_run_store.mark_retry_wait(
                    run_id,
                    next_retry_at=next_retry_at,
                    error_code=DEFAULT_RETRY_ERROR_CODE,
                    error_message=error_message,
                )
            else:
                self.daily_run_store.mark_failed(
                    run_id,
                    error_code=error_code,
                    error_message=error_message,
                )
        except Exception as exc:
            message = str(exc) or type(exc).__name__
            if self._should_block(message):
                self.daily_run_store.mark_blocked(
                    run_id,
                    error_code="ACCOUNT_SESSION_INVALID",
                    error_message=message,
                )
            elif self._should_retry(snapshot, message):
                next_retry_at = self._compute_next_retry_at(snapshot, message)
                self.daily_run_store.mark_retry_wait(
                    run_id,
                    next_retry_at=next_retry_at,
                    error_code=type(exc).__name__.upper() or DEFAULT_RETRY_ERROR_CODE,
                    error_message=message,
                )
            else:
                self.daily_run_store.mark_failed(
                    run_id,
                    error_code=type(exc).__name__.upper(),
                    error_message=message,
                )
            logger.exception("Daily dispatcher failed account=%s task=%s: %s", account_name, task_name, exc)
        finally:
            self._active_run_ids.discard(run_id)

    @staticmethod
    def _should_block(message: str) -> bool:
        upper = message.upper()
        return any(marker in message or marker in upper for marker in BLOCKED_ERROR_MARKERS)

    @staticmethod
    def _parse_datetime(value: object) -> datetime | None:
        if not value:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value)
            except ValueError:
                return None
        return None

    @staticmethod
    def _attempt_count(snapshot: dict[str, object]) -> int:
        try:
            return max(int(snapshot.get("attempt_count") or 0), 0)
        except (TypeError, ValueError):
            return 0

    @staticmethod
    def _max_attempts(snapshot: dict[str, object]) -> int:
        try:
            return max(int(snapshot.get("max_attempts") or 3), 1)
        except (TypeError, ValueError):
            return 3

    @staticmethod
    def _extract_flood_wait_seconds(message: str) -> int | None:
        upper = message.upper()
        if "FLOOD" not in upper:
            return None
        digits = []
        current = []
        for ch in message:
            if ch.isdigit():
                current.append(ch)
            elif current:
                digits.append(int("".join(current)))
                current = []
        if current:
            digits.append(int("".join(current)))
        if not digits:
            return None
        positive = [value for value in digits if value > 0]
        return min(positive) if positive else None

    def _should_retry(self, snapshot: dict[str, object], message: str) -> bool:
        attempts = self._attempt_count(snapshot)
        max_attempts = self._max_attempts(snapshot)
        if attempts >= max_attempts:
            return False

        deadline_at = self._parse_datetime(snapshot.get("deadline_at"))
        if deadline_at and datetime.now() >= deadline_at:
            return False

        upper = message.upper()
        return any(marker in upper for marker in RETRYABLE_ERROR_MARKERS)

    def _compute_next_retry_at(self, snapshot: dict[str, object], message: str) -> datetime:
        now = datetime.now()
        flood_wait_seconds = self._extract_flood_wait_seconds(message)
        if flood_wait_seconds:
            delay = max(flood_wait_seconds + 30, 60)
        else:
            attempts = max(self._attempt_count(snapshot), 1)
            index = min(attempts - 1, len(RETRY_BACKOFF_SECONDS) - 1)
            delay = RETRY_BACKOFF_SECONDS[index]

        next_retry_at = now + timedelta(seconds=delay)
        deadline_at = self._parse_datetime(snapshot.get("deadline_at"))
        if deadline_at and next_retry_at >= deadline_at:
            return deadline_at
        return next_retry_at


_daily_dispatcher_service: DailyDispatcherService | None = None


def get_daily_dispatcher_service() -> DailyDispatcherService:
    global _daily_dispatcher_service
    if _daily_dispatcher_service is None:
        _daily_dispatcher_service = DailyDispatcherService()
    return _daily_dispatcher_service
