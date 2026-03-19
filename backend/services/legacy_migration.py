from __future__ import annotations

from pathlib import Path
from typing import Any

from backend.core.config import get_settings
from backend.stores import get_account_store, get_sign_task_store
from backend.utils.tg_session import get_account_profile, list_account_names


class LegacyMigrationService:
    def __init__(self):
        self.settings = get_settings()
        self.session_dir = self.settings.resolve_session_dir()
        self.account_store = get_account_store()
        self.sign_task_store = get_sign_task_store()

    def _detect_session_ref(self, account_name: str) -> tuple[str | None, Path | None]:
        string_file = self.session_dir / f"{account_name}.session_string"
        if string_file.exists():
            return "string", string_file

        file_session = self.session_dir / f"{account_name}.session"
        if file_session.exists():
            return "file", file_session

        return None, None

    def migrate_accounts(self, dry_run: bool = False) -> dict[str, Any]:
        account_names = set(list_account_names())
        for path in self.session_dir.glob("*.session"):
            account_names.add(path.stem)
        for path in self.session_dir.glob("*.session_string"):
            account_names.add(path.stem)

        migrated: list[dict[str, Any]] = []
        for account_name in sorted(account_names):
            session_backend, session_file = self._detect_session_ref(account_name)
            entry = {
                "account_name": account_name,
                "session_backend": session_backend,
                "session_ref": session_file.name if session_file else None,
                "legacy_profile": get_account_profile(account_name),
            }
            migrated.append(entry)
            if not dry_run:
                self.account_store.ensure_account(
                    account_name,
                    legacy_profile=entry["legacy_profile"],
                    session_backend=session_backend,
                    session_ref=entry["session_ref"],
                )

        return {
            "accounts": migrated,
            "migrated_count": len(migrated),
            "dry_run": dry_run,
        }

    def migrate_sign_tasks(
        self, dry_run: bool = False, overwrite: bool = False
    ) -> dict[str, Any]:
        result = self.sign_task_store.sync_legacy_to_db(
            dry_run=dry_run,
            overwrite=overwrite,
        )
        result["dry_run"] = dry_run
        result["overwrite"] = overwrite
        return result

    def migrate_all(
        self, dry_run: bool = False, overwrite: bool = False
    ) -> dict[str, Any]:
        account_result = self.migrate_accounts(dry_run=dry_run)
        sign_task_result = self.migrate_sign_tasks(
            dry_run=dry_run,
            overwrite=overwrite,
        )
        return {
            "accounts": account_result,
            "sign_tasks": sign_task_result,
            "rollback_hint": "如需回滚，请恢复数据库文件与 signs/session 目录备份。",
        }


_legacy_migration_service: LegacyMigrationService | None = None


def get_legacy_migration_service() -> LegacyMigrationService:
    global _legacy_migration_service
    if _legacy_migration_service is None:
        _legacy_migration_service = LegacyMigrationService()
    return _legacy_migration_service
