from __future__ import annotations

from pathlib import Path
from typing import Any, Protocol

from backend.contracts.dtos import SignTaskDefinition, TaskRunRecord


class TelegramEngine(Protocol):
    def get_client(self, **kwargs: Any) -> Any: ...

    async def close_client(self, account_name: str, workdir: Path) -> None: ...

    def create_signer(self, **kwargs: Any) -> Any: ...


class SessionStore(Protocol):
    def list_account_names(self) -> list[str]: ...

    def list_session_files(self, session_dir: Path) -> list[Path]: ...

    def get_account_profile(self, account_name: str) -> dict[str, Any]: ...

    def get_account_proxy(self, account_name: str) -> str | None: ...

    def get_session_string(self, session_dir: Path, account_name: str) -> str | None: ...

    def save_session_string(
        self, session_dir: Path, account_name: str, session_string: str
    ) -> None: ...

    def delete_account_session(self, session_dir: Path, account_name: str) -> None: ...

    def set_account_profile(
        self,
        account_name: str,
        *,
        remark: str | None = None,
        proxy: str | None = None,
    ) -> None: ...


class SignTaskStore(Protocol):
    def list_tasks(
        self, account_name: str | None = None, force_refresh: bool = False
    ) -> list[SignTaskDefinition]: ...

    def get_task(
        self, task_name: str, account_name: str | None = None
    ) -> SignTaskDefinition | None: ...

    def save_task(self, task: SignTaskDefinition) -> SignTaskDefinition: ...

    def delete_task(self, task_name: str, account_name: str | None = None) -> bool: ...

    def invalidate_cache(self) -> None: ...

    def load_chat_cache(self, account_name: str) -> list[dict[str, Any]] | None: ...

    def save_chat_cache(self, account_name: str, chats: list[dict[str, Any]]) -> None: ...

    def update_last_run(
        self,
        task_name: str,
        account_name: str,
        last_run: dict[str, Any],
    ) -> None: ...


class RunHistoryStore(Protocol):
    def cleanup_old_logs(self) -> None: ...

    def get_task_history_logs(
        self, task_name: str, account_name: str, limit: int = 20
    ) -> list[TaskRunRecord]: ...

    def get_account_history_logs(self, account_name: str) -> list[dict[str, Any]]: ...

    def get_last_run_info(
        self, task_name: str, account_name: str = ""
    ) -> dict[str, Any] | None: ...

    def save_run_info(
        self,
        task_name: str,
        success: bool,
        message: str = "",
        account_name: str = "",
        flow_logs: list[str] | None = None,
    ) -> dict[str, Any]: ...
