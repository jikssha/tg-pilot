from __future__ import annotations

import logging
import sqlite3
from pathlib import Path
from typing import Final

from alembic.config import Config
from alembic.script import ScriptDirectory

from alembic import command
from backend.core.config import get_settings

logger = logging.getLogger("backend.migrations")

BASELINE_REVISION: Final[str] = "202603190001"
PHASE2_REVISION: Final[str] = "202603190002"
PHASE3_REVISION: Final[str] = "202603190003"
DAILY_RUNS_REVISION: Final[str] = "202603210001"
DAILY_RUNS_RETRY_REVISION: Final[str] = "202603210002"

_BASELINE_TABLES: Final[set[str]] = {"accounts", "users", "tasks", "task_logs"}
_PHASE2_TABLES: Final[set[str]] = {"audit_events", "login_session_states"}
_PHASE3_TABLES: Final[set[str]] = {"sign_tasks"}
_DAILY_RUN_TABLES: Final[set[str]] = {"daily_task_runs"}
_DAILY_RUN_RETRY_COLUMNS: Final[set[str]] = {
    "max_attempts",
    "next_retry_at",
    "deadline_at",
}


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def get_alembic_config() -> Config:
    root = _repo_root()
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    config.set_main_option("sqlalchemy.url", get_settings().database_url)
    return config


def _load_known_revisions(config: Config) -> set[str]:
    revisions = {
        BASELINE_REVISION,
        PHASE2_REVISION,
        PHASE3_REVISION,
        DAILY_RUNS_REVISION,
        DAILY_RUNS_RETRY_REVISION,
    }
    try:
        script = ScriptDirectory.from_config(config)
        revisions.update(
            revision.revision
            for revision in script.walk_revisions()
            if getattr(revision, "revision", None)
        )
    except Exception as exc:
        logger.warning("Failed to load alembic revisions dynamically: %s", exc)
    return revisions


def _load_revision_order(config: Config) -> dict[str, int]:
    order = {
        BASELINE_REVISION: 0,
        PHASE2_REVISION: 1,
        PHASE3_REVISION: 2,
        DAILY_RUNS_REVISION: 3,
        DAILY_RUNS_RETRY_REVISION: 4,
    }
    try:
        script = ScriptDirectory.from_config(config)
        revisions = [
            revision.revision
            for revision in reversed(list(script.walk_revisions()))
            if getattr(revision, "revision", None)
        ]
        order = {revision: index for index, revision in enumerate(revisions)}
    except Exception as exc:
        logger.warning("Failed to build alembic revision order dynamically: %s", exc)
    return order


def _load_table_names(connection: sqlite3.Connection) -> set[str]:
    rows = connection.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()
    return {row[0] for row in rows if row and row[0]}


def _load_column_names(connection: sqlite3.Connection, table_name: str) -> set[str]:
    rows = connection.execute(f"PRAGMA table_info('{table_name}')").fetchall()
    return {row[1] for row in rows if len(row) > 1 and row[1]}


def _load_alembic_versions(connection: sqlite3.Connection) -> list[str]:
    rows = connection.execute("SELECT version_num FROM alembic_version").fetchall()
    versions: list[str] = []
    for row in rows:
        if not row:
            continue
        value = row[0]
        if value is None:
            continue
        text = str(value).strip()
        if text:
            versions.append(text)
    return versions


def _infer_schema_revision(connection: sqlite3.Connection, table_names: set[str]) -> str | None:
    if "daily_task_runs" in table_names:
        daily_run_columns = _load_column_names(connection, "daily_task_runs")
        if _DAILY_RUN_RETRY_COLUMNS.issubset(daily_run_columns):
            return DAILY_RUNS_RETRY_REVISION
        return DAILY_RUNS_REVISION

    if "sign_tasks" in table_names:
        return PHASE3_REVISION

    if _PHASE2_TABLES.issubset(table_names):
        return PHASE2_REVISION

    if _BASELINE_TABLES.issubset(table_names):
        return BASELINE_REVISION

    return None


def _detect_legacy_revision(db_path: Path, known_revisions: set[str]) -> str | None:
    if not db_path.exists():
        return None

    with sqlite3.connect(db_path) as connection:
        table_names = _load_table_names(connection)
        if "alembic_version" in table_names:
            versions = _load_alembic_versions(connection)
            valid_versions = [version for version in versions if version in known_revisions]
            if valid_versions:
                return None
            logger.warning(
                "Detected alembic_version table without a valid revision in %s; "
                "stored values=%s. Falling back to legacy schema detection.",
                db_path,
                versions,
            )

        inferred_revision = _infer_schema_revision(connection, table_names)
        if inferred_revision == PHASE3_REVISION:
            account_columns = (
                _load_column_names(connection, "accounts")
                if "accounts" in table_names
                else set()
            )
            missing_account_columns = {
                "remark",
                "session_backend",
                "session_ref",
                "last_status_message",
                "last_checked_at",
            } - account_columns
            if missing_account_columns:
                logger.warning(
                    "Detected sign_tasks table without alembic_version; "
                    "stamping as %s and assuming account columns were already "
                    "migrated. Missing account columns: %s",
                    PHASE3_REVISION,
                    sorted(missing_account_columns),
                )
        if inferred_revision is not None:
            return inferred_revision

        legacy_tables = sorted(
            table_names.intersection(
                _BASELINE_TABLES | _PHASE2_TABLES | _PHASE3_TABLES | _DAILY_RUN_TABLES
            )
        )
        if legacy_tables:
            logger.warning(
                "Detected legacy SQLite tables without alembic_version, but the "
                "schema is incomplete for automatic stamping. Existing tables: %s",
                legacy_tables,
            )
        return None


def _resolve_schema_ahead_revision(
    db_path: Path,
    known_revisions: set[str],
    revision_order: dict[str, int],
) -> str | None:
    if not db_path.exists():
        return None

    with sqlite3.connect(db_path) as connection:
        table_names = _load_table_names(connection)
        if "alembic_version" not in table_names:
            return None

        versions = _load_alembic_versions(connection)
        valid_versions = [version for version in versions if version in known_revisions]
        if not valid_versions:
            return None

        current_revision = max(
            valid_versions,
            key=lambda revision: revision_order.get(revision, -1),
        )
        inferred_revision = _infer_schema_revision(connection, table_names)
        if inferred_revision is None:
            return None

        if revision_order.get(inferred_revision, -1) > revision_order.get(
            current_revision, -1
        ):
            logger.warning(
                "Detected schema ahead of alembic_version in %s; stored=%s inferred=%s. "
                "Stamping forward before upgrade.",
                db_path,
                current_revision,
                inferred_revision,
            )
            return inferred_revision

    return None


def _bootstrap_legacy_alembic_state(config: Config) -> str | None:
    settings = get_settings()
    db_path = settings.resolve_db_path()
    known_revisions = _load_known_revisions(config)
    revision_order = _load_revision_order(config)

    revision = _resolve_schema_ahead_revision(
        db_path,
        known_revisions,
        revision_order,
    )
    if revision is None:
        revision = _detect_legacy_revision(db_path, known_revisions)
    if revision is None:
        return None

    logger.info(
        "Detected SQLite database at %s requiring alembic stamp reconciliation to revision %s before upgrade",
        db_path,
        revision,
    )
    command.stamp(config, revision)
    return revision


def run_migrations() -> None:
    logger.info("Running database migrations")
    config = get_alembic_config()
    _bootstrap_legacy_alembic_state(config)
    command.upgrade(config, "head")
