from __future__ import annotations

from pathlib import Path
from typing import Any

from backend.utils.tg_session import (
    delete_account_session_string,
    delete_session_string_file,
    get_account_session_string,
    get_session_mode,
    load_session_string_file,
    save_session_string_file,
    set_account_session_string,
)


class FileSessionStore:
    def list_account_names(self) -> list[str]:
        try:
            from backend.stores.accounts import get_account_store

            return get_account_store().list_account_names()
        except Exception:
            return []

    def list_session_files(self, session_dir: Path) -> list[Path]:
        pattern = "*.session_string" if get_session_mode() == "string" else "*.session"
        return sorted(session_dir.glob(pattern))

    def get_account_profile(self, account_name: str) -> dict[str, Any]:
        try:
            from backend.stores.accounts import get_account_store

            return get_account_store().get_profile(account_name)
        except Exception:
            return {}

    def get_account_proxy(self, account_name: str) -> str | None:
        profile = self.get_account_profile(account_name)
        proxy = profile.get("proxy")
        if isinstance(proxy, str) and proxy.strip():
            return proxy.strip()
        return None

    def get_session_string(self, session_dir: Path, account_name: str) -> str | None:
        return get_account_session_string(account_name) or load_session_string_file(
            session_dir, account_name
        )

    def save_session_string(
        self, session_dir: Path, account_name: str, session_string: str
    ) -> None:
        set_account_session_string(account_name, session_string)
        save_session_string_file(session_dir, account_name, session_string)
        try:
            from backend.stores.accounts import get_account_store

            get_account_store().upsert_profile(
                account_name,
                session_backend="string",
                session_ref=f"{account_name}.session_string",
            )
        except Exception:
            pass

    def delete_account_session(self, session_dir: Path, account_name: str) -> None:
        delete_account_session_string(account_name)
        delete_session_string_file(session_dir, account_name)

    def set_account_profile(
        self,
        account_name: str,
        *,
        remark: str | None = None,
        proxy: str | None = None,
    ) -> None:
        try:
            from backend.stores.accounts import get_account_store

            get_account_store().upsert_profile(
                account_name,
                remark=remark,
                proxy=proxy,
            )
        except Exception:
            pass


_session_store: FileSessionStore | None = None


def get_session_store() -> FileSessionStore:
    global _session_store
    if _session_store is None:
        _session_store = FileSessionStore()
    return _session_store
