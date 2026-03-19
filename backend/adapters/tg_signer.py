from __future__ import annotations

from pathlib import Path
from typing import Any

from tg_signer.core import UserSigner, close_client_by_name, get_client


class BackendUserSigner(UserSigner):
    @property
    def task_dir(self):
        return self.tasks_dir / self._account / self.task_name

    def ask_for_config(self):
        raise ValueError(
            f"任务配置文件不存在: {self.config_file},且后端模式下禁止交互式输入。"
        )

    def reconfig(self):
        raise ValueError(
            f"任务配置文件不存在: {self.config_file},且后端模式下禁止交互式输入。"
        )

    def ask_one(self):
        raise ValueError("后端模式下禁止交互式输入")


class TgSignerAdapter:
    def get_client(self, **kwargs: Any) -> Any:
        return get_client(**kwargs)

    async def close_client(self, account_name: str, workdir: Path) -> None:
        await close_client_by_name(account_name, workdir=workdir)

    def create_signer(self, **kwargs: Any) -> BackendUserSigner:
        return BackendUserSigner(**kwargs)


_adapter: TgSignerAdapter | None = None


def get_tg_signer_adapter() -> TgSignerAdapter:
    global _adapter
    if _adapter is None:
        _adapter = TgSignerAdapter()
    return _adapter
