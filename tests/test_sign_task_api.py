from __future__ import annotations

from types import SimpleNamespace

import pytest


@pytest.mark.asyncio
async def test_create_sign_task_returns_success_even_if_scheduler_sync_fails(monkeypatch):
    from backend.api.routes.sign_tasks import (
        ChatConfig,
        SignTaskCreate,
        create_sign_task,
    )

    created = {
        "name": "daily-a",
        "account_name": "V1",
        "sign_at": "0 8 * * *",
        "chats": [{"chat_id": 1, "name": "room", "actions": [{"action": 1, "text": "hi"}]}],
        "random_seconds": 0,
        "sign_interval": 10,
        "enabled": True,
        "execution_mode": "fixed",
        "range_start": None,
        "range_end": None,
    }

    monkeypatch.setattr(
        "backend.api.routes.sign_tasks.get_sign_task_service",
        lambda: SimpleNamespace(
            create_task=lambda **kwargs: created,
        ),
    )

    async def _failing_sync_jobs():
        raise RuntimeError("scheduler unavailable")

    monkeypatch.setattr("backend.scheduler.sync_jobs", _failing_sync_jobs)

    payload = SignTaskCreate(
        name="daily-a",
        account_name="V1",
        sign_at="0 8 * * *",
        chats=[ChatConfig(chat_id=1, name="room", actions=[{"action": 1, "text": "hi"}])],
    )

    result = await create_sign_task(payload, current_user=SimpleNamespace(username="admin"))

    assert result["name"] == "daily-a"
    assert result["account_name"] == "V1"


def test_list_sign_tasks_forwards_force_refresh(monkeypatch):
    from backend.api.routes.sign_tasks import list_sign_tasks

    captured: dict[str, object] = {}

    monkeypatch.setattr(
        "backend.api.routes.sign_tasks.get_sign_task_service",
        lambda: SimpleNamespace(
            list_tasks=lambda **kwargs: captured.update(kwargs) or [],
        ),
    )

    list_sign_tasks(account_name="V1", force_refresh=True, current_user=SimpleNamespace(username="admin"))

    assert captured == {"account_name": "V1", "force_refresh": True}
