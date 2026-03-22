from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest

MODULES_TO_RELOAD = [
    "backend.contracts.dtos",
    "backend.contracts.interfaces",
    "backend.contracts",
    "backend.adapters.tg_signer",
    "backend.adapters",
    "backend.core.config",
    "backend.core.database",
    "backend.core.migrations",
    "backend.models.audit_event",
    "backend.models.account",
    "backend.models.daily_task_run",
    "backend.models.login_session_state",
    "backend.models.sign_task",
    "backend.models.task",
    "backend.models.task_log",
    "backend.models.user",
    "backend.models",
    "backend.services.audit",
    "backend.services.config",
    "backend.services.daily_dispatcher",
    "backend.services.daily_planner",
    "backend.services.login_sessions",
    "backend.services.legacy_migration",
    "backend.services.operations",
    "backend.services.sign_tasks",
    "backend.services.telegram",
    "backend.services.update_check",
    "backend.scheduler",
    "backend.stores.accounts",
    "backend.stores.daily_task_runs",
    "backend.stores.legacy_sign_tasks",
    "backend.stores.run_history",
    "backend.stores.session_store",
    "backend.stores.sign_tasks",
    "backend.stores",
    "backend.api.routes.auth",
    "backend.api.routes.insights",
    "backend.main",
    "backend.services.bot_notify",
    "backend.services.users",
]


@pytest.fixture()
def isolated_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("APP_DATA_DIR", str(data_dir))
    monkeypatch.setenv("APP_SECRET_KEY", "test-secret-key")
    monkeypatch.setenv("ADMIN_PASSWORD", "admin123")
    monkeypatch.setenv("TG_SESSION_MODE", "string")
    monkeypatch.setenv("APP_DATA_DIR_OVERRIDE_FILE", str(tmp_path / ".tg_pilot_data_dir"))

    for module_name in MODULES_TO_RELOAD:
        if module_name in sys.modules:
            importlib.reload(sys.modules[module_name])

    from backend.core.database import reset_engine_state

    reset_engine_state()

    yield data_dir

    for module_name in MODULES_TO_RELOAD:
        if module_name in sys.modules:
            importlib.reload(sys.modules[module_name])

    from backend.core.database import reset_engine_state as reset_database_state

    reset_database_state()


@pytest.fixture()
def db_session(isolated_env: Path):
    import backend.models  # noqa: F401
    from backend.core.database import Base, get_engine, get_session_local, init_engine

    init_engine()
    Base.metadata.create_all(bind=get_engine())
    session = get_session_local()()
    try:
        yield session
    finally:
        session.close()
