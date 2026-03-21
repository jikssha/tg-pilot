from __future__ import annotations

from types import SimpleNamespace

import pytest
from apscheduler.schedulers.asyncio import AsyncIOScheduler


@pytest.mark.asyncio
async def test_sync_jobs_registers_database_and_sign_tasks(db_session, monkeypatch):
    import backend.scheduler as scheduler_module
    from backend.models.account import Account
    from backend.models.task import Task

    monkeypatch.setattr("backend.scheduler.use_daily_run_dispatch", lambda: False)

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

    dummy_sign_task_store = SimpleNamespace(
        list_tasks=lambda force_refresh=False: [
            SimpleNamespace(
                account_name="alpha",
                name="sign_task",
                sign_at="0 7 * * *",
                enabled=True,
                execution_mode="fixed",
                range_start="",
                to_dict=lambda: {
                    "account_name": "alpha",
                    "name": "sign_task",
                    "sign_at": "0 7 * * *",
                    "enabled": True,
                    "execution_mode": "fixed",
                    "range_start": "",
                },
            )
        ]
    )
    monkeypatch.setattr(
        "backend.scheduler.get_sign_task_store",
        lambda: dummy_sign_task_store,
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


@pytest.mark.asyncio
async def test_sync_daily_task_runs_builds_today_plan(db_session, monkeypatch):
    import backend.scheduler as scheduler_module

    planned = [{"task_name": "daily-a"}]

    class _Planner:
        def build_daily_plan(self, run_date=None):
            return planned

    monkeypatch.setattr(
        "backend.services.daily_planner.get_daily_planner_service",
        lambda: _Planner(),
    )

    result = await scheduler_module.sync_daily_task_runs()

    assert result == planned


@pytest.mark.asyncio
async def test_sync_jobs_skips_legacy_sign_jobs_when_daily_dispatch_enabled(db_session, monkeypatch):
    import backend.scheduler as scheduler_module

    dummy_sign_task_store = SimpleNamespace(
        list_tasks=lambda force_refresh=False: [
            SimpleNamespace(
                account_name="alpha",
                name="sign_task",
                sign_at="0 7 * * *",
                enabled=True,
                execution_mode="fixed",
                range_start="",
                to_dict=lambda: {
                    "account_name": "alpha",
                    "name": "sign_task",
                    "sign_at": "0 7 * * *",
                    "enabled": True,
                    "execution_mode": "fixed",
                    "range_start": "",
                },
            )
        ]
    )
    monkeypatch.setattr(
        "backend.scheduler.get_sign_task_store",
        lambda: dummy_sign_task_store,
    )
    monkeypatch.setattr("backend.scheduler.use_daily_run_dispatch", lambda: True)

    planned = []

    async def fake_sync_daily_task_runs(run_date=None):
        planned.append(run_date)
        return []

    monkeypatch.setattr("backend.scheduler.sync_daily_task_runs", fake_sync_daily_task_runs)

    scheduler_module.scheduler = AsyncIOScheduler()
    scheduler_module.scheduler.start(paused=True)

    try:
        await scheduler_module.sync_jobs()
        job_ids = {job.id for job in scheduler_module.scheduler.get_jobs()}
        assert "sign-alpha-sign_task" not in job_ids
        assert planned == [None]
    finally:
        scheduler_module.scheduler.shutdown(wait=False)
        scheduler_module.scheduler = None
