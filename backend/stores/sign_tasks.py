from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy.orm import Session

from backend.contracts.dtos import SignTaskDefinition
from backend.core.database import get_session_local
from backend.models.sign_task import SignTask
from backend.stores.legacy_sign_tasks import LegacySignTaskFileStore


class DbBackedSignTaskStore:
    def __init__(self):
        self.legacy_store = LegacySignTaskFileStore()
        self.signs_dir = self.legacy_store.signs_dir
        self._tasks_cache: list[SignTaskDefinition] | None = None

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
            "legacy_path": f"signs/{task.account_name}/{task.name}/config.json",
        }

    def invalidate_cache(self) -> None:
        self._tasks_cache = None
        self.legacy_store.invalidate_cache()

    def _sync_legacy_tasks_to_db(
        self, *, dry_run: bool = False, overwrite: bool = False
    ) -> dict[str, object]:
        imported = 0
        skipped = 0
        errors: list[str] = []

        legacy_tasks = self.legacy_store.list_tasks(force_refresh=True)
        if dry_run:
            return {
                "imported": len(legacy_tasks),
                "skipped": 0,
                "errors": [],
                "tasks": [task.to_dict() for task in legacy_tasks],
            }

        db = self._session()
        try:
            for task in legacy_tasks:
                existing = (
                    db.query(SignTask)
                    .filter(
                        SignTask.account_name == task.account_name,
                        SignTask.name == task.name,
                    )
                    .first()
                )
                if existing is not None and not overwrite:
                    skipped += 1
                    continue

                payload = self._definition_payload(task)
                if existing is None:
                    db.add(
                        SignTask(
                            name=task.name,
                            account_name=task.account_name,
                            **payload,
                        )
                    )
                else:
                    for key, value in payload.items():
                        setattr(existing, key, value)
                imported += 1
            db.commit()
        except Exception as exc:
            db.rollback()
            errors.append(str(exc))
        finally:
            db.close()

        self.invalidate_cache()
        return {"imported": imported, "skipped": skipped, "errors": errors}

    def sync_legacy_to_db(
        self, *, dry_run: bool = False, overwrite: bool = False
    ) -> dict[str, object]:
        return self._sync_legacy_tasks_to_db(dry_run=dry_run, overwrite=overwrite)

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

        if not rows:
            self._sync_legacy_tasks_to_db()
            db = self._session()
            try:
                query = db.query(SignTask)
                if account_name:
                    query = query.filter(SignTask.account_name == account_name)
                rows = query.order_by(SignTask.account_name, SignTask.name).all()
            finally:
                db.close()

        tasks = [self._row_to_definition(row) for row in rows]
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

        if row is None:
            legacy_task = self.legacy_store.get_task(task_name, account_name)
            if legacy_task is not None:
                self.save_task(legacy_task)
                return legacy_task
            return None

        return self._row_to_definition(row)

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

        self.legacy_store.save_task(task)
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

        legacy_deleted = self.legacy_store.delete_task(task_name, account_name)
        self.invalidate_cache()
        return deleted or legacy_deleted

    def load_chat_cache(self, account_name: str) -> list[dict] | None:
        return self.legacy_store.load_chat_cache(account_name)

    def save_chat_cache(self, account_name: str, chats: list[dict]) -> None:
        self.legacy_store.save_chat_cache(account_name, chats)

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
