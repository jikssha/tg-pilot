from __future__ import annotations

from types import SimpleNamespace

import pytest
from apscheduler.schedulers.asyncio import AsyncIOScheduler


@pytest.mark.asyncio
async def test_sync_jobs_registers_database_and_sign_tasks(db_session, monkeypatch):
    import backend.scheduler as scheduler_module
    from backend.models.account import Account
    from backend.models.task import Task

    account = Account(
        account_name="alpha",
        api_id="611335",
        api_hash="hash",
        status="idle",
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)

    db_session.add(
        Task(
            name="database_task",
            cron="0 6 * * *",
            enabled=True,
            account_id=account.id,
        )
    )
    db_session.commit()

    dummy_sign_task_service = SimpleNamespace(
        list_tasks=lambda force_refresh=False: [
            {
                "account_name": "alpha",
                "name": "sign_task",
                "sign_at": "0 7 * * *",
                "enabled": True,
                "execution_mode": "fixed",
            }
        ]
    )
    monkeypatch.setattr(
        "backend.services.sign_tasks.get_sign_task_service",
        lambda: dummy_sign_task_service,
    )

    scheduler_module.scheduler = AsyncIOScheduler()
    scheduler_module.scheduler.start(paused=True)

    try:
        await scheduler_module.sync_jobs()
        job_ids = {job.id for job in scheduler_module.scheduler.get_jobs()}
        assert any(job_id.startswith("db-") for job_id in job_ids)
        assert "sign-alpha-sign_task" in job_ids
    finally:
        scheduler_module.scheduler.shutdown(wait=False)
        scheduler_module.scheduler = None
