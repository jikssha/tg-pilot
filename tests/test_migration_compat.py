from __future__ import annotations

import json
import sqlite3
from pathlib import Path


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_run_migrations_upgrades_empty_sqlite_and_preserves_configs(isolated_env):
    from backend.core.config import get_settings
    from backend.core.migrations import run_migrations
    from backend.services.bot_notify import BotNotifyService
    from backend.services.config import get_config_service

    settings = get_settings()
    db_path = settings.resolve_db_path()
    workdir = settings.resolve_workdir()
    workdir.mkdir(parents=True, exist_ok=True)

    telegram_config = {"api_id": "777777", "api_hash": "hash-777"}
    global_settings = {"sign_interval": 33, "log_retention_days": 9}
    ai_config = {"api_key": "sk-test", "base_url": "https://example.invalid/v1"}
    bot_config = {"bot_token": "123:token", "chat_id": "456", "enabled": True}

    telegram_path = workdir / ".telegram_api.json"
    global_path = workdir / ".global_settings.json"
    ai_path = workdir / ".openai_config.json"
    bot_path = workdir / ".bot_notify.json"

    telegram_path.write_text(json.dumps(telegram_config), encoding="utf-8")
    global_path.write_text(json.dumps(global_settings), encoding="utf-8")
    ai_path.write_text(json.dumps(ai_config), encoding="utf-8")
    bot_path.write_text(json.dumps(bot_config), encoding="utf-8")

    before_contents = {
        "telegram": _read_text(telegram_path),
        "global": _read_text(global_path),
        "ai": _read_text(ai_path),
        "bot": _read_text(bot_path),
    }

    run_migrations()

    connection = sqlite3.connect(db_path)
    try:
        revision = connection.execute(
            "SELECT version_num FROM alembic_version"
        ).fetchone()[0]
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
    finally:
        connection.close()

    assert revision == "202603210002"
    assert {"accounts", "audit_events", "sign_tasks", "daily_task_runs"}.issubset(tables)

    assert _read_text(telegram_path) == before_contents["telegram"]
    assert _read_text(global_path) == before_contents["global"]
    assert _read_text(ai_path) == before_contents["ai"]
    assert _read_text(bot_path) == before_contents["bot"]

    assert get_config_service().get_telegram_config()["api_id"] == "777777"
    assert get_config_service().get_global_settings()["sign_interval"] == 33
    assert get_config_service().get_ai_config()["api_key"] == "sk-test"
    assert BotNotifyService().get_config()["chat_id"] == "456"


def test_run_migrations_is_idempotent_at_head(isolated_env):
    from backend.core.config import get_settings
    from backend.core.migrations import run_migrations

    settings = get_settings()
    db_path = settings.resolve_db_path()

    run_migrations()
    run_migrations()

    connection = sqlite3.connect(db_path)
    try:
        revision = connection.execute(
            "SELECT version_num FROM alembic_version"
        ).fetchall()
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
    finally:
        connection.close()

    assert revision == [("202603210002",)]
    assert {"daily_task_runs", "sign_tasks", "audit_events"}.issubset(tables)
