from __future__ import annotations

from datetime import date, datetime

from sqlalchemy.orm import Session

from backend.core.database import get_session_local
from backend.models.daily_task_run import DailyTaskRun


class DailyTaskRunStore:
    def _session(self) -> Session:
        return get_session_local()()

    @staticmethod
    def _row_to_dict(row: DailyTaskRun) -> dict[str, object]:
        return {
            "id": row.id,
            "task_name": row.task_name,
            "account_name": row.account_name,
            "run_date": row.run_date.isoformat(),
            "window_start": row.window_start,
            "window_end": row.window_end,
            "planned_run_at": row.planned_run_at.isoformat(),
            "status": row.status,
            "attempt_count": row.attempt_count,
            "last_error_code": row.last_error_code,
            "last_error_message": row.last_error_message,
            "last_started_at": row.last_started_at.isoformat() if row.last_started_at else None,
            "last_finished_at": row.last_finished_at.isoformat() if row.last_finished_at else None,
        }

    def ensure_daily_run(
        self,
        *,
        task_name: str,
        account_name: str,
        run_date: date,
        window_start: str,
        window_end: str,
        planned_run_at: datetime,
    ) -> dict[str, object]:
        db = self._session()
        try:
            existing = (
                db.query(DailyTaskRun)
                .filter(
                    DailyTaskRun.task_name == task_name,
                    DailyTaskRun.account_name == account_name,
                    DailyTaskRun.run_date == run_date,
                )
                .first()
            )
            if existing is None:
                existing = DailyTaskRun(
                    task_name=task_name,
                    account_name=account_name,
                    run_date=run_date,
                    window_start=window_start,
                    window_end=window_end,
                    planned_run_at=planned_run_at,
                    status="pending",
                )
                db.add(existing)
                db.commit()
                db.refresh(existing)
            elif existing.status == "pending":
                existing.window_start = window_start
                existing.window_end = window_end
                existing.planned_run_at = planned_run_at
                db.commit()
                db.refresh(existing)
            return self._row_to_dict(existing)
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def get_daily_run(
        self, *, task_name: str, account_name: str, run_date: date
    ) -> dict[str, object] | None:
        db = self._session()
        try:
            row = (
                db.query(DailyTaskRun)
                .filter(
                    DailyTaskRun.task_name == task_name,
                    DailyTaskRun.account_name == account_name,
                    DailyTaskRun.run_date == run_date,
                )
                .first()
            )
            return self._row_to_dict(row) if row else None
        finally:
            db.close()

    def list_runs_for_date(self, run_date: date) -> list[dict[str, object]]:
        db = self._session()
        try:
            rows = (
                db.query(DailyTaskRun)
                .filter(DailyTaskRun.run_date == run_date)
                .order_by(DailyTaskRun.planned_run_at, DailyTaskRun.account_name, DailyTaskRun.task_name)
                .all()
            )
            return [self._row_to_dict(row) for row in rows]
        finally:
            db.close()

    def list_pending_for_date(self, run_date: date) -> list[dict[str, object]]:
        db = self._session()
        try:
            rows = (
                db.query(DailyTaskRun)
                .filter(
                    DailyTaskRun.run_date == run_date,
                    DailyTaskRun.status == "pending",
                )
                .order_by(DailyTaskRun.planned_run_at, DailyTaskRun.account_name, DailyTaskRun.task_name)
                .all()
            )
            return [self._row_to_dict(row) for row in rows]
        finally:
            db.close()

    def prune_pending_runs_for_date(
        self, run_date: date, valid_task_keys: set[tuple[str, str]]
    ) -> int:
        db = self._session()
        try:
            rows = (
                db.query(DailyTaskRun)
                .filter(
                    DailyTaskRun.run_date == run_date,
                    DailyTaskRun.status == "pending",
                )
                .all()
            )
            removed = 0
            for row in rows:
                key = (row.account_name, row.task_name)
                if key in valid_task_keys:
                    continue
                db.delete(row)
                removed += 1
            if removed:
                db.commit()
            return removed
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def list_due_runs(
        self, now: datetime, *, limit: int = 20
    ) -> list[dict[str, object]]:
        db = self._session()
        try:
            rows = (
                db.query(DailyTaskRun)
                .filter(
                    DailyTaskRun.run_date == now.date(),
                    DailyTaskRun.status == "pending",
                    DailyTaskRun.planned_run_at <= now,
                )
                .order_by(DailyTaskRun.planned_run_at, DailyTaskRun.account_name, DailyTaskRun.task_name)
                .limit(limit)
                .all()
            )
            return [self._row_to_dict(row) for row in rows]
        finally:
            db.close()

    def mark_running(self, run_id: int) -> dict[str, object] | None:
        db = self._session()
        try:
            row = db.query(DailyTaskRun).filter(DailyTaskRun.id == run_id).first()
            if row is None:
                return None
            if row.status != "pending":
                return self._row_to_dict(row)
            row.status = "running"
            row.attempt_count = int(row.attempt_count or 0) + 1
            row.last_started_at = datetime.utcnow()
            row.last_error_code = None
            row.last_error_message = None
            db.commit()
            db.refresh(row)
            return self._row_to_dict(row)
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def mark_success(self, run_id: int) -> dict[str, object] | None:
        db = self._session()
        try:
            row = db.query(DailyTaskRun).filter(DailyTaskRun.id == run_id).first()
            if row is None:
                return None
            row.status = "success"
            row.last_finished_at = datetime.utcnow()
            row.last_error_code = None
            row.last_error_message = None
            db.commit()
            db.refresh(row)
            return self._row_to_dict(row)
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def mark_failed(
        self, run_id: int, *, error_code: str | None = None, error_message: str = ""
    ) -> dict[str, object] | None:
        db = self._session()
        try:
            row = db.query(DailyTaskRun).filter(DailyTaskRun.id == run_id).first()
            if row is None:
                return None
            row.status = "failed"
            row.last_finished_at = datetime.utcnow()
            row.last_error_code = error_code
            row.last_error_message = error_message
            db.commit()
            db.refresh(row)
            return self._row_to_dict(row)
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def mark_blocked(
        self, run_id: int, *, error_code: str | None = None, error_message: str = ""
    ) -> dict[str, object] | None:
        db = self._session()
        try:
            row = db.query(DailyTaskRun).filter(DailyTaskRun.id == run_id).first()
            if row is None:
                return None
            row.status = "blocked"
            row.last_finished_at = datetime.utcnow()
            row.last_error_code = error_code
            row.last_error_message = error_message
            db.commit()
            db.refresh(row)
            return self._row_to_dict(row)
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def reset_running_runs(self, run_date: date) -> int:
        db = self._session()
        try:
            rows = (
                db.query(DailyTaskRun)
                .filter(
                    DailyTaskRun.run_date == run_date,
                    DailyTaskRun.status == "running",
                )
                .all()
            )
            if not rows:
                return 0
            for row in rows:
                row.status = "pending"
            db.commit()
            return len(rows)
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()


_daily_task_run_store: DailyTaskRunStore | None = None


def get_daily_task_run_store() -> DailyTaskRunStore:
    global _daily_task_run_store
    if _daily_task_run_store is None:
        from backend.core.database import ensure_schema

        ensure_schema()
        _daily_task_run_store = DailyTaskRunStore()
    return _daily_task_run_store
