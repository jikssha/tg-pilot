from __future__ import annotations

from collections import Counter
from typing import Any

from sqlalchemy import func

import backend.scheduler as scheduler_module
from backend.core.database import get_session_local
from backend.models.account import Account
from backend.models.audit_event import AuditEvent
from backend.models.sign_task import SignTask
from backend.services.audit import get_audit_service


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
            accounts_total = db.query(func.count(Account.id)).scalar() or 0
            account_status_rows = (
                db.query(Account.status, func.count(Account.id))
                .group_by(Account.status)
                .all()
            )
            account_statuses = {
                str(status or "unknown"): int(count)
                for status, count in account_status_rows
            }

            sign_tasks_total = db.query(func.count(SignTask.id)).scalar() or 0
            sign_tasks_enabled = (
                db.query(func.count(SignTask.id))
                .filter(SignTask.enabled.is_(True))
                .scalar()
                or 0
            )
            sign_tasks_disabled = max(int(sign_tasks_total) - int(sign_tasks_enabled), 0)
            last_run_rows = db.query(SignTask.last_run_success).all()
            last_run_counter = Counter()
            never_run = 0
            for (flag,) in last_run_rows:
                if flag is None:
                    never_run += 1
                else:
                    last_run_counter["success" if flag else "failed"] += 1

            latest_audit_at = (
                db.query(AuditEvent.created_at)
                .order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc())
                .limit(1)
                .scalar()
            )
        finally:
            db.close()

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
