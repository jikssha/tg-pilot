from __future__ import annotations

from types import SimpleNamespace

import pytest


class _DummyClient:
    def __init__(self):
        self.is_connected = False

    async def connect(self):
        self.is_connected = True

    async def get_me(self):
        return SimpleNamespace(id=123456)


@pytest.mark.asyncio
async def test_legacy_file_session_accounts_are_valid_in_string_mode(isolated_env, monkeypatch):
    from backend.services.telegram import TelegramService

    session_file = isolated_env / "sessions" / "legacy.session"
    session_file.parent.mkdir(parents=True, exist_ok=True)
    session_file.write_text("legacy-file-session", encoding="utf-8")

    service = TelegramService()
    captured: dict[str, object] = {}

    def fake_get_client(name: str, **kwargs):
        captured["name"] = name
        captured["session_string"] = kwargs.get("session_string")
        captured["in_memory"] = kwargs.get("in_memory")
        captured["workdir"] = kwargs.get("workdir")
        return _DummyClient()

    monkeypatch.setattr(service.telegram_engine, "get_client", fake_get_client)

    accounts = service.list_accounts(force_refresh=True)
    result = await service.check_account_status("legacy", timeout_seconds=2)
    profile = service.account_store.get_profile("legacy")

    assert any(item["name"] == "legacy" for item in accounts)
    assert service.account_exists("legacy") is True
    assert captured["name"] == "legacy"
    assert captured["session_string"] is None
    assert captured["in_memory"] is False
    assert result["status"] == "valid"
    assert result["needs_relogin"] is False
    assert profile["session_backend"] == "file"
    assert profile["session_ref"] == "legacy.session"


@pytest.mark.asyncio
async def test_missing_session_material_reports_invalid(isolated_env):
    from backend.services.telegram import TelegramService

    service = TelegramService()

    result = await service.check_account_status("missing-account", timeout_seconds=2)

    assert result["status"] in {"invalid", "not_found"}
    assert result["needs_relogin"] is True
