from __future__ import annotations

import json
import logging
import sqlite3
from pathlib import Path


def _create_pre_alembic_legacy_db(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    try:
        connection.executescript(
            """
            CREATE TABLE accounts (
                id INTEGER PRIMARY KEY,
                account_name VARCHAR(100) NOT NULL,
                api_id VARCHAR(64) NOT NULL,
                api_hash VARCHAR(128) NOT NULL,
                proxy TEXT,
                status VARCHAR(32) NOT NULL,
                last_login_at DATETIME,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            );
            CREATE UNIQUE INDEX ix_accounts_account_name ON accounts (account_name);
            CREATE INDEX ix_accounts_id ON accounts (id);

            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                totp_secret VARCHAR(64),
                created_at DATETIME NOT NULL
            );
            CREATE UNIQUE INDEX ix_users_username ON users (username);
            CREATE INDEX ix_users_id ON users (id);

            CREATE TABLE tasks (
                id INTEGER PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                cron VARCHAR(64) NOT NULL,
                enabled BOOLEAN NOT NULL,
                account_id INTEGER NOT NULL,
                last_run_at DATETIME,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                FOREIGN KEY(account_id) REFERENCES accounts(id)
            );
            CREATE INDEX ix_tasks_account_id ON tasks (account_id);
            CREATE INDEX ix_tasks_id ON tasks (id);

            CREATE TABLE task_logs (
                id INTEGER PRIMARY KEY,
                task_id INTEGER NOT NULL,
                status VARCHAR(32) NOT NULL,
                log_path VARCHAR(255),
                output TEXT,
                started_at DATETIME NOT NULL,
                finished_at DATETIME,
                FOREIGN KEY(task_id) REFERENCES tasks(id)
            );
            CREATE INDEX ix_task_logs_task_id ON task_logs (task_id);
            CREATE INDEX ix_task_logs_id ON task_logs (id);
            """
        )
        connection.execute(
            """
            INSERT INTO accounts (
                id, account_name, api_id, api_hash, proxy, status, last_login_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                1,
                "legacy-alpha",
                "611335",
                "legacy-hash",
                "socks5://127.0.0.1:1080",
                "idle",
                None,
                "2026-03-01T00:00:00",
                "2026-03-01T00:00:00",
            ),
        )
        connection.commit()
    finally:
        connection.close()


def _create_legacy_db_with_empty_alembic_version(db_path: Path) -> None:
    _create_pre_alembic_legacy_db(db_path)
    connection = sqlite3.connect(db_path)
    try:
        connection.execute("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
        connection.commit()
    finally:
        connection.close()


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_run_migrations_bootstraps_pre_alembic_sqlite_and_preserves_configs(
    isolated_env,
):
    from backend.core.config import get_settings
    from backend.core.migrations import run_migrations
    from backend.services.bot_notify import BotNotifyService
    from backend.services.config import get_config_service

    settings = get_settings()
    db_path = settings.resolve_db_path()
    workdir = settings.resolve_workdir()
    workdir.mkdir(parents=True, exist_ok=True)

    _create_pre_alembic_legacy_db(db_path)

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
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        revision = connection.execute(
            "SELECT version_num FROM alembic_version"
        ).fetchone()[0]
        account_columns = {
            row[1] for row in connection.execute("PRAGMA table_info('accounts')").fetchall()
        }
        row = connection.execute(
            "SELECT account_name, api_id, api_hash FROM accounts WHERE id = 1"
        ).fetchone()
    finally:
        connection.close()

    assert revision == "202603210002"
    assert {"audit_events", "login_session_states", "sign_tasks", "daily_task_runs"}.issubset(tables)
    assert {"remark", "session_backend", "session_ref", "last_status_message", "last_checked_at"}.issubset(
        account_columns
    )
    assert row == ("legacy-alpha", "611335", "legacy-hash")

    assert _read_text(telegram_path) == before_contents["telegram"]
    assert _read_text(global_path) == before_contents["global"]
    assert _read_text(ai_path) == before_contents["ai"]
    assert _read_text(bot_path) == before_contents["bot"]

    assert get_config_service().get_telegram_config()["api_id"] == "777777"
    assert get_config_service().get_global_settings()["sign_interval"] == 33
    assert get_config_service().get_ai_config()["api_key"] == "sk-test"
    assert BotNotifyService().get_config()["chat_id"] == "456"


def test_run_migrations_recovers_when_alembic_table_exists_but_is_empty(isolated_env):
    from backend.core.config import get_settings
    from backend.core.migrations import run_migrations

    settings = get_settings()
    db_path = settings.resolve_db_path()
    _create_legacy_db_with_empty_alembic_version(db_path)

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
    assert {"audit_events", "login_session_states", "sign_tasks", "daily_task_runs"}.issubset(tables)


def test_run_migrations_is_idempotent_after_daily_run_revisions_exist(isolated_env):
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


def test_run_migrations_reconciles_when_schema_is_ahead_of_stored_revision(isolated_env):
    from backend.core.config import get_settings
    from backend.core.migrations import run_migrations

    settings = get_settings()
    db_path = settings.resolve_db_path()

    run_migrations()

    connection = sqlite3.connect(db_path)
    try:
        connection.execute("DELETE FROM alembic_version")
        connection.execute(
            "INSERT INTO alembic_version (version_num) VALUES (?)",
            ("202603190003",),
        )
        connection.commit()
    finally:
        connection.close()

    run_migrations()

    connection = sqlite3.connect(db_path)
    try:
        revision = connection.execute(
            "SELECT version_num FROM alembic_version"
        ).fetchall()
        daily_run_columns = {
            row[1]
            for row in connection.execute(
                "PRAGMA table_info('daily_task_runs')"
            ).fetchall()
        }
    finally:
        connection.close()

    assert revision == [("202603210002",)]
    assert {"max_attempts", "next_retry_at", "deadline_at"}.issubset(
        daily_run_columns
    )


def test_startup_legacy_bootstrap_reconciles_accounts_and_sign_tasks(isolated_env):
    from backend.contracts import SignTaskDefinition
    from backend.core.database import get_session_local
    from backend.core.migrations import run_migrations
    from backend.main import _bootstrap_legacy_metadata
    from backend.models.account import Account
    from backend.models.sign_task import SignTask
    from backend.stores.legacy_sign_tasks import LegacySignTaskFileStore
    from backend.utils.tg_session import save_session_string_file, set_account_profile

    run_migrations()

    session_dir = isolated_env / "sessions"
    session_dir.mkdir(parents=True, exist_ok=True)
    set_account_profile("legacy", remark="old remark", proxy="socks5://1.2.3.4:1080")
    save_session_string_file(session_dir, "legacy", "legacy-session")

    LegacySignTaskFileStore().save_task(
        SignTaskDefinition(
            name="legacy-task",
            account_name="legacy",
            sign_at="0 8 * * *",
            chats=[{"chat_id": 1, "actions": [{"action": 1, "text": "legacy"}]}],
        )
    )

    _bootstrap_legacy_metadata(logging.getLogger("tests.migration"))

    session = get_session_local()()
    try:
        account = (
            session.query(Account)
            .filter(Account.account_name == "legacy")
            .first()
        )
        sign_task = (
            session.query(SignTask)
            .filter(SignTask.account_name == "legacy", SignTask.name == "legacy-task")
            .first()
        )
    finally:
        session.close()

    assert account is not None
    assert account.remark == "old remark"
    assert account.session_ref == "legacy.session_string"
    assert sign_task is not None
