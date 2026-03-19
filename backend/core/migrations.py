from __future__ import annotations

import logging
from pathlib import Path

from alembic.config import Config

from alembic import command
from backend.core.config import get_settings

logger = logging.getLogger("backend.migrations")


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def get_alembic_config() -> Config:
    root = _repo_root()
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    config.set_main_option("sqlalchemy.url", get_settings().database_url)
    return config


def run_migrations() -> None:
    logger.info("Running database migrations")
    command.upgrade(get_alembic_config(), "head")
