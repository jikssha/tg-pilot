from __future__ import annotations

from collections import Counter
from datetime import date
from typing import Any

import backend.scheduler as scheduler_module
from backend.core.database import get_session_local
from backend.models.account import Account
from backend.models.audit_event import AuditEvent
from backend.models.daily_task_run import DailyTaskRun
from backend.services.audit import get_audit_service
from backend.services.sign_tasks import get_sign_task_service
from backend.services.telegram import get_telegram_service


class OperationsService:
    def get_overview(
        self,
        *,
        ready: bool,
        readiness_checks: dict[str, bool],
        readiness_details: dict[str, str],
    ) -> dict[str, Any]:
        db = get_session_local()()
        try:
            latest_audit_at = (
                db.query(AuditEvent.created_at)
                .order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc())
                .limit(1)
                .scalar()
            )

            today = date.today()
            daily_run_rows = (
                db.query(DailyTaskRun)
                .filter(DailyTaskRun.run_date == today)
                .order_by(DailyTaskRun.planned_run_at.desc(), DailyTaskRun.id.desc())
                .all()
            )
            daily_run_counter = Counter(str(row.status or "pending") for row in daily_run_rows)
            latest_planned_at = daily_run_rows[0].planned_run_at if daily_run_rows else None
            latest_finished_times = [row.last_finished_at for row in daily_run_rows if row.last_finished_at is not None]
            latest_finished_at = max(latest_finished_times) if latest_finished_times else None
            recent_daily_runs = [
                {
                    "id": int(row.id),
                    "task_name": row.task_name,
                    "account_name": row.account_name,
                    "planned_run_at": row.planned_run_at.isoformat() + "Z",
                    "status": row.status,
                    "attempt_count": int(row.attempt_count or 0),
                    "max_attempts": int(row.max_attempts or 0),
                    "next_retry_at": row.next_retry_at.isoformat() + "Z" if row.next_retry_at else None,
                    "deadline_at": row.deadline_at.isoformat() + "Z" if row.deadline_at else None,
                    "last_started_at": row.last_started_at.isoformat() + "Z" if row.last_started_at else None,
                    "last_finished_at": row.last_finished_at.isoformat() + "Z" if row.last_finished_at else None,
                    "last_error_code": row.last_error_code,
                    "last_error_message": row.last_error_message,
                }
                for row in daily_run_rows[:10]
            ]
        finally:
            db.close()

        live_accounts = get_telegram_service().list_accounts(force_refresh=True)
        accounts_total = len(live_accounts)
        live_account_names = [str(item.get("name") or "") for item in live_accounts if item.get("name")]
        account_statuses: dict[str, int] = Counter()
        db = get_session_local()()
        try:
            status_rows = (
                db.query(Account.account_name, Account.status)
                .filter(Account.account_name.in_(live_account_names))
                .all()
            )
        finally:
            db.close()
        status_by_name = {str(account_name): str(status or "unknown") for account_name, status in status_rows}
        for account_name in live_account_names:
            account_statuses[status_by_name.get(account_name, "unknown")] += 1

        live_account_name_set = {
            str(account_name)
            for account_name in live_account_names
            if str(account_name).strip()
        }
        all_sign_tasks = get_sign_task_service().list_tasks(force_refresh=True)
        sign_tasks = [
            task
            for task in all_sign_tasks
            if str(task.get("account_name") or "") in live_account_name_set
        ]
        sign_tasks_total = len(sign_tasks)
        sign_tasks_enabled = sum(1 for task in sign_tasks if task.get("enabled", True))
        sign_tasks_disabled = max(int(sign_tasks_total) - int(sign_tasks_enabled), 0)
        last_run_counter = Counter()
        never_run = 0
        for task in sign_tasks:
            last_run = task.get("last_run")
            if not last_run:
                never_run += 1
                continue
            last_run_counter["success" if last_run.get("success") else "failed"] += 1

        active_scheduler = scheduler_module.scheduler
        jobs = []
        if active_scheduler:
            for job in active_scheduler.get_jobs():
                jobs.append(
                    {
                        "id": job.id,
                        "next_run_time": (
                            job.next_run_time.isoformat()
                            if job.next_run_time is not None
                            else None
                        ),
                    }
                )

        recent_audit = get_audit_service().list_events(limit=5)

        return {
            "readiness": {
                "ready": ready,
                "checks": readiness_checks,
                "details": readiness_details,
            },
            "scheduler": {
                "running": bool(active_scheduler),
                "job_count": len(jobs),
                "jobs": jobs[:10],
            },
            "accounts": {
                "total": int(accounts_total),
                "statuses": account_statuses,
            },
            "sign_tasks": {
                "total": int(sign_tasks_total),
                "enabled": int(sign_tasks_enabled),
                "disabled": int(sign_tasks_disabled),
                "last_run_success": int(last_run_counter.get("success", 0)),
                "last_run_failed": int(last_run_counter.get("failed", 0)),
                "never_run": int(never_run),
            },
            "daily_runs": {
                "run_date": today.isoformat(),
                "total": len(daily_run_rows),
                "pending": int(daily_run_counter.get("pending", 0)),
                "running": int(daily_run_counter.get("running", 0)),
                "retry_wait": int(daily_run_counter.get("retry_wait", 0)),
                "success": int(daily_run_counter.get("success", 0)),
                "failed": int(daily_run_counter.get("failed", 0)),
                "blocked": int(daily_run_counter.get("blocked", 0)),
                "expired": int(daily_run_counter.get("expired", 0)),
                "latest_planned_at": latest_planned_at.isoformat() + "Z" if latest_planned_at else None,
                "latest_finished_at": latest_finished_at.isoformat() + "Z" if latest_finished_at else None,
                "recent_runs": recent_daily_runs,
            },
            "recent_audit": recent_audit["items"],
            "latest_audit_at": latest_audit_at.isoformat() + "Z"
            if latest_audit_at is not None
            else None,
        }


_operations_service: OperationsService | None = None


def get_operations_service() -> OperationsService:
    global _operations_service
    if _operations_service is None:
        _operations_service = OperationsService()
    return _operations_service
