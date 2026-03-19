from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta
from pathlib import Path

from backend.contracts.dtos import TaskRunRecord
from backend.core.config import get_settings

logger = logging.getLogger("backend.sign_tasks.history")


class FileRunHistoryStore:
    def __init__(self):
        settings = get_settings()
        self.workdir = settings.resolve_workdir()
        self.run_history_dir = self.workdir / "history"
        self.run_history_dir.mkdir(parents=True, exist_ok=True)
        self._history_max_entries = self._read_positive_int_env(
            "SIGN_TASK_HISTORY_MAX_ENTRIES", 100, 10
        )
        self._history_max_flow_lines = self._read_positive_int_env(
            "SIGN_TASK_HISTORY_MAX_FLOW_LINES", 200, 20
        )
        self._history_max_line_chars = self._read_positive_int_env(
            "SIGN_TASK_HISTORY_MAX_LINE_CHARS", 500, 80
        )

    @staticmethod
    def _read_positive_int_env(name: str, default: int, minimum: int = 1) -> int:
        raw = os.getenv(name)
        if raw is None:
            return default
        try:
            return max(int(raw), minimum)
        except (TypeError, ValueError):
            return default

    def cleanup_old_logs(self) -> None:
        if not self.run_history_dir.exists():
            return
        limit = datetime.now() - timedelta(days=3)
        for log_file in self.run_history_dir.glob("*.json"):
            try:
                if log_file.stat().st_mtime < limit.timestamp():
                    log_file.unlink()
            except Exception:
                continue

    def _safe_history_key(self, name: str) -> str:
        return name.replace("/", "_").replace("\\", "_")

    def _history_file_path(self, task_name: str, account_name: str = "") -> Path:
        if account_name:
            safe_account = self._safe_history_key(account_name)
            safe_task = self._safe_history_key(task_name)
            return self.run_history_dir / f"{safe_account}__{safe_task}.json"
        return self.run_history_dir / f"{self._safe_history_key(task_name)}.json"

    def _normalize_flow_logs(
        self, flow_logs: list[str] | None
    ) -> tuple[list[str], bool, int]:
        if not isinstance(flow_logs, list):
            return [], False, 0

        total = len(flow_logs)
        trimmed: list[str] = []
        for line in flow_logs[: self._history_max_flow_lines]:
            text = str(line).replace("\r", "").rstrip("\n")
            if len(text) > self._history_max_line_chars:
                text = text[: self._history_max_line_chars] + "..."
            trimmed.append(text)
        return trimmed, total > len(trimmed), total

    def _load_history_entries(
        self, task_name: str, account_name: str = ""
    ) -> list[dict[str, object]]:
        history_file = self._history_file_path(task_name, account_name)
        legacy_file = self.run_history_dir / f"{self._safe_history_key(task_name)}.json"

        if not history_file.exists():
            if account_name and legacy_file.exists():
                history_file = legacy_file
            elif not account_name and legacy_file.exists():
                history_file = legacy_file
            else:
                return []

        try:
            with open(history_file, "r", encoding="utf-8") as handle:
                data = json.load(handle)
        except Exception:
            return []

        if isinstance(data, dict):
            data_list = [data]
        elif isinstance(data, list):
            data_list = data
        else:
            return []

        entries: list[dict[str, object]] = []
        for item in data_list:
            if not isinstance(item, dict):
                continue
            item_account = item.get("account_name")
            if account_name and item_account and item_account != account_name:
                continue
            entries.append(item)

        entries.sort(key=lambda item: str(item.get("time", "")), reverse=True)
        return entries

    def get_task_history_logs(
        self, task_name: str, account_name: str, limit: int = 20
    ) -> list[TaskRunRecord]:
        limit = max(1, min(limit, 200))
        history = self._load_history_entries(task_name, account_name)
        return [
            TaskRunRecord(
                time=str(item.get("time", "")),
                success=bool(item.get("success", False)),
                message=str(item.get("message", "") or ""),
                flow_logs=[str(line) for line in item.get("flow_logs", []) or []],
                flow_truncated=bool(item.get("flow_truncated", False)),
                flow_line_count=int(
                    item.get("flow_line_count", len(item.get("flow_logs", []) or []))
                ),
            )
            for item in history[:limit]
        ]

    def get_account_history_logs(self, account_name: str) -> list[dict[str, object]]:
        entries: list[dict[str, object]] = []
        for history_file in self.run_history_dir.glob(
            f"{self._safe_history_key(account_name)}__*.json"
        ):
            try:
                task_name = history_file.stem.split("__", 1)[1]
            except Exception:
                continue
            task_entries = self._load_history_entries(task_name, account_name)
            for item in task_entries:
                current = dict(item)
                current["task_name"] = task_name
                entries.append(current)

        entries.sort(key=lambda item: str(item.get("time", "")), reverse=True)
        return entries

    def clear_account_history(
        self, account_name: str, task_names: list[str]
    ) -> dict[str, int]:
        removed_files = 0
        removed_entries = 0

        def _count_entries(data: object) -> int:
            if isinstance(data, list):
                return len(data)
            if isinstance(data, dict):
                return 1
            return 0

        for task_name in task_names:
            if not task_name:
                continue

            history_file = self._history_file_path(task_name, account_name)
            if history_file.exists():
                try:
                    with open(history_file, "r", encoding="utf-8") as handle:
                        removed_entries += _count_entries(json.load(handle))
                except Exception:
                    pass
                try:
                    history_file.unlink()
                    removed_files += 1
                except Exception:
                    pass
                continue

            legacy_file = self.run_history_dir / f"{self._safe_history_key(task_name)}.json"
            if not legacy_file.exists():
                continue

            try:
                with open(legacy_file, "r", encoding="utf-8") as handle:
                    data = json.load(handle)
                if isinstance(data, dict):
                    data_list = [data]
                elif isinstance(data, list):
                    data_list = data
                else:
                    data_list = []
            except Exception:
                continue

            if not data_list:
                try:
                    legacy_file.unlink()
                    removed_files += 1
                except Exception:
                    pass
                continue

            has_account_field = any(
                isinstance(item, dict) and "account_name" in item for item in data_list
            )
            if not has_account_field:
                removed_entries += len(data_list)
                try:
                    legacy_file.unlink()
                    removed_files += 1
                except Exception:
                    pass
                continue

            kept: list[dict[str, object]] = []
            for item in data_list:
                if not isinstance(item, dict):
                    continue
                if item.get("account_name") == account_name:
                    removed_entries += 1
                else:
                    kept.append(item)

            if not kept:
                try:
                    legacy_file.unlink()
                    removed_files += 1
                except Exception:
                    pass
            else:
                try:
                    with open(legacy_file, "w", encoding="utf-8") as handle:
                        json.dump(kept, handle, ensure_ascii=False, indent=2)
                except Exception:
                    pass

        return {"removed_files": removed_files, "removed_entries": removed_entries}

    def get_last_run_info(
        self, task_name: str, account_name: str = ""
    ) -> dict[str, object] | None:
        history = self._load_history_entries(task_name, account_name)
        if not history:
            return None
        item = history[0]
        return {
            "time": item.get("time", ""),
            "success": bool(item.get("success", False)),
            "message": item.get("message", "") or "",
        }

    def save_run_info(
        self,
        task_name: str,
        success: bool,
        message: str = "",
        account_name: str = "",
        flow_logs: list[str] | None = None,
    ) -> dict[str, object]:
        new_entry = {
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "success": success,
            "message": message,
            "account_name": account_name,
        }

        normalized_logs, flow_truncated, flow_line_count = self._normalize_flow_logs(
            flow_logs
        )
        if normalized_logs:
            new_entry["flow_logs"] = normalized_logs
            new_entry["flow_truncated"] = flow_truncated
            new_entry["flow_line_count"] = flow_line_count

        history = self._load_history_entries(task_name, account_name)
        history.insert(0, new_entry)
        history = history[: self._history_max_entries]

        history_file = self._history_file_path(task_name, account_name)
        with open(history_file, "w", encoding="utf-8") as handle:
            json.dump(history, handle, ensure_ascii=False, indent=2)

        return new_entry


_run_history_store: FileRunHistoryStore | None = None


def get_run_history_store() -> FileRunHistoryStore:
    global _run_history_store
    if _run_history_store is None:
        _run_history_store = FileRunHistoryStore()
    return _run_history_store
