from __future__ import annotations

import json
import logging
from pathlib import Path

from backend.contracts.dtos import SignTaskDefinition
from backend.core.config import get_settings

logger = logging.getLogger("backend.sign_tasks.store")


class FileSignTaskStore:
    def __init__(self):
        settings = get_settings()
        self.workdir = settings.resolve_workdir()
        self.signs_dir = self.workdir / "signs"
        self.signs_dir.mkdir(parents=True, exist_ok=True)
        self._tasks_cache: list[SignTaskDefinition] | None = None

    def invalidate_cache(self) -> None:
        self._tasks_cache = None

    def list_tasks(
        self, account_name: str | None = None, force_refresh: bool = False
    ) -> list[SignTaskDefinition]:
        if self._tasks_cache is not None and not force_refresh:
            if account_name:
                return [
                    task for task in self._tasks_cache if task.account_name == account_name
                ]
            return list(self._tasks_cache)

        tasks: list[SignTaskDefinition] = []
        try:
            for account_path in self.signs_dir.iterdir():
                if not account_path.is_dir():
                    continue
                if (account_path / "config.json").exists():
                    task = self._load_task_config(account_path)
                    if task is not None:
                        tasks.append(task)
                    continue
                for task_dir in account_path.iterdir():
                    if not task_dir.is_dir():
                        continue
                    task = self._load_task_config(task_dir)
                    if task is not None:
                        tasks.append(task)
        except Exception as exc:
            logger.warning(
                "Failed to scan sign task directory %s: %s", self.signs_dir, exc
            )
            return []

        self._tasks_cache = sorted(tasks, key=lambda item: (item.account_name, item.name))
        if account_name:
            return [task for task in self._tasks_cache if task.account_name == account_name]
        return list(self._tasks_cache)

    def _load_task_config(self, task_dir: Path) -> SignTaskDefinition | None:
        config_file = task_dir / "config.json"
        if not config_file.exists():
            return None

        try:
            with open(config_file, "r", encoding="utf-8") as handle:
                config = json.load(handle)
        except Exception:
            return None

        return SignTaskDefinition(
            name=task_dir.name,
            account_name=str(config.get("account_name") or ""),
            sign_at=str(config.get("sign_at") or ""),
            chats=list(config.get("chats") or []),
            random_seconds=int(config.get("random_seconds") or 0),
            sign_interval=int(config.get("sign_interval") or 1),
            enabled=bool(config.get("enabled", True)),
            last_run=config.get("last_run"),
            execution_mode=str(config.get("execution_mode") or "fixed"),
            range_start=str(config.get("range_start") or ""),
            range_end=str(config.get("range_end") or ""),
        )

    def get_task(
        self, task_name: str, account_name: str | None = None
    ) -> SignTaskDefinition | None:
        if account_name:
            task_dir = self.signs_dir / account_name / task_name
            return self._load_task_config(task_dir)

        root_task = self._load_task_config(self.signs_dir / task_name)
        if root_task is not None:
            return root_task

        for task in self.list_tasks(force_refresh=False):
            if task.name == task_name:
                return task
        return None

    def save_task(self, task: SignTaskDefinition) -> SignTaskDefinition:
        if not task.account_name:
            raise ValueError("必须指定账号名称")

        task_dir = self.signs_dir / task.account_name / task.name
        task_dir.mkdir(parents=True, exist_ok=True)
        config_file = task_dir / "config.json"
        payload = {
            "_version": 3,
            "account_name": task.account_name,
            "sign_at": task.sign_at,
            "random_seconds": task.random_seconds,
            "sign_interval": task.sign_interval,
            "chats": task.chats,
            "execution_mode": task.execution_mode,
            "range_start": task.range_start,
            "range_end": task.range_end,
        }
        if task.last_run:
            payload["last_run"] = task.last_run

        with open(config_file, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)

        self.invalidate_cache()
        return task

    def delete_task(self, task_name: str, account_name: str | None = None) -> bool:
        task_dir: Path | None = None
        if account_name:
            candidate = self.signs_dir / account_name / task_name
            if candidate.exists():
                task_dir = candidate
        else:
            task = self.get_task(task_name, account_name=None)
            if task:
                task_dir = self.signs_dir / task.account_name / task.name

        if task_dir is None or not task_dir.exists():
            return False

        import shutil

        shutil.rmtree(task_dir)
        self.invalidate_cache()
        return True

    def load_chat_cache(self, account_name: str) -> list[dict] | None:
        cache_file = self.signs_dir / account_name / "chats_cache.json"
        if not cache_file.exists():
            return None
        try:
            with open(cache_file, "r", encoding="utf-8") as handle:
                data = json.load(handle)
        except Exception:
            return None
        return data if isinstance(data, list) else None

    def save_chat_cache(self, account_name: str, chats: list[dict]) -> None:
        cache_file = self.signs_dir / account_name / "chats_cache.json"
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        with open(cache_file, "w", encoding="utf-8") as handle:
            json.dump(chats, handle, ensure_ascii=False, indent=2)

    def update_last_run(
        self, task_name: str, account_name: str, last_run: dict[str, object]
    ) -> None:
        task = self.get_task(task_name, account_name)
        if task is None:
            return
        task.last_run = last_run
        self.save_task(task)


_sign_task_store: FileSignTaskStore | None = None


def get_sign_task_store() -> FileSignTaskStore:
    global _sign_task_store
    if _sign_task_store is None:
        _sign_task_store = FileSignTaskStore()
    return _sign_task_store
