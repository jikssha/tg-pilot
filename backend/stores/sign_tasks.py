from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from backend.contracts.dtos import SignTaskDefinition
from backend.core.config import get_settings
from backend.core.database import get_session_local
from backend.models.sign_task import SignTask

logger = logging.getLogger("backend.sign_tasks.store")


class DbBackedSignTaskStore:
    def __init__(self):
        self._tasks_cache: list[SignTaskDefinition] | None = None
        self._chat_cache_root = get_settings().resolve_workdir() / "signs"

    def _session(self) -> Session:
        return get_session_local()()

    @staticmethod
    def _row_to_definition(row: SignTask) -> SignTaskDefinition:
        chats = []
        if row.chats_json:
            try:
                data = json.loads(row.chats_json)
                if isinstance(data, list):
                    chats = data
            except Exception:
                chats = []

        last_run = None
        if row.last_run_at is not None:
            last_run = {
                "time": row.last_run_at.strftime("%Y-%m-%d %H:%M:%S"),
                "success": bool(row.last_run_success),
                "message": row.last_run_message or "",
            }

        return SignTaskDefinition(
            name=row.name,
            account_name=row.account_name,
            sign_at=row.sign_at,
            chats=chats,
            random_seconds=row.random_seconds,
            sign_interval=row.sign_interval,
            enabled=row.enabled,
            last_run=last_run,
            execution_mode=row.execution_mode,
            range_start=row.range_start or "",
            range_end=row.range_end or "",
        )

    @staticmethod
    def _definition_payload(task: SignTaskDefinition) -> dict[str, object]:
        last_run = task.last_run if isinstance(task.last_run, dict) else {}
        last_run_at = None
        if last_run.get("time"):
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
                try:
                    last_run_at = datetime.strptime(str(last_run["time"]), fmt)
                    break
                except ValueError:
                    continue
        return {
            "enabled": task.enabled,
            "sign_at": task.sign_at,
            "random_seconds": task.random_seconds,
            "sign_interval": task.sign_interval,
            "execution_mode": task.execution_mode,
            "range_start": task.range_start,
            "range_end": task.range_end,
            "chats_json": json.dumps(task.chats, ensure_ascii=False),
            "last_run_at": last_run_at,
            "last_run_success": last_run.get("success")
            if isinstance(last_run.get("success"), bool)
            else None,
            "last_run_message": str(last_run.get("message") or ""),
            "source_version": 3,
            # Keep the column in the schema for now, but stop using the removed
            # file-based store as the source of truth for task definitions.
            "legacy_path": None,
        }

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

        db = self._session()
        try:
            query = db.query(SignTask)
            if account_name:
                query = query.filter(SignTask.account_name == account_name)
            rows = query.order_by(SignTask.account_name, SignTask.name).all()
        finally:
            db.close()

        tasks = [self._row_to_definition(row) for row in rows]
        # Only hydrate the shared cache from full-list queries.
        # A filtered account query should never poison the global task list,
        # otherwise later sidebar/overview reads will incorrectly see a subset.
        if account_name is None:
            self._tasks_cache = list(tasks)
        return list(tasks)

    def get_task(
        self, task_name: str, account_name: str | None = None
    ) -> SignTaskDefinition | None:
        db = self._session()
        try:
            query = db.query(SignTask).filter(SignTask.name == task_name)
            if account_name:
                query = query.filter(SignTask.account_name == account_name)
            row = query.first()
        finally:
            db.close()

        return self._row_to_definition(row) if row is not None else None

    def save_task(self, task: SignTaskDefinition) -> SignTaskDefinition:
        if not task.account_name:
            raise ValueError("必须指定账号名称")

        payload = self._definition_payload(task)
        db = self._session()
        try:
            row = (
                db.query(SignTask)
                .filter(
                    SignTask.account_name == task.account_name,
                    SignTask.name == task.name,
                )
                .first()
            )
            if row is None:
                row = SignTask(
                    name=task.name,
                    account_name=task.account_name,
                    **payload,
                )
                db.add(row)
            else:
                for key, value in payload.items():
                    setattr(row, key, value)
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

        self.invalidate_cache()
        return task

    def delete_task(self, task_name: str, account_name: str | None = None) -> bool:
        deleted = False
        db = self._session()
        try:
            query = db.query(SignTask).filter(SignTask.name == task_name)
            if account_name:
                query = query.filter(SignTask.account_name == account_name)
            rows = query.all()
            if rows:
                deleted = True
                for row in rows:
                    db.delete(row)
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

        self.invalidate_cache()
        return deleted

    def _chat_cache_file(self, account_name: str) -> Path:
        return self._chat_cache_root / account_name / "chats_cache.json"

    def load_chat_cache(self, account_name: str) -> list[dict] | None:
        if not account_name:
            return None
        cache_file = self._chat_cache_file(account_name)
        if not cache_file.exists():
            return None
        try:
            data = json.loads(cache_file.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning(
                "Failed to load chat cache account=%s path=%s error=%s",
                account_name,
                cache_file,
                exc,
            )
            return None
        return data if isinstance(data, list) else None

    def save_chat_cache(self, account_name: str, chats: list[dict]) -> None:
        if not account_name:
            return
        cache_file = self._chat_cache_file(account_name)
        try:
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            cache_file.write_text(
                json.dumps(chats, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception as exc:
            logger.warning(
                "Failed to persist chat cache account=%s path=%s error=%s",
                account_name,
                cache_file,
                exc,
            )

    def update_last_run(
        self, task_name: str, account_name: str, last_run: dict[str, object]
    ) -> None:
        task = self.get_task(task_name, account_name)
        if task is None:
            return
        task.last_run = dict(last_run)
        self.save_task(task)


_sign_task_store: DbBackedSignTaskStore | None = None


def get_sign_task_store() -> DbBackedSignTaskStore:
    global _sign_task_store
    if _sign_task_store is None:
        from backend.core.database import ensure_schema

        ensure_schema()
        _sign_task_store = DbBackedSignTaskStore()
    return _sign_task_store
