"""
签到任务服务层
提供签到任务的 CRUD 操作和执行功能
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.adapters import get_tg_signer_adapter
from backend.contracts import SignTaskDefinition
from backend.core.config import get_settings
from backend.stores import (
    get_run_history_store,
    get_session_store,
    get_sign_task_store,
)
from backend.utils.account_locks import get_account_lock
from backend.utils.proxy import build_proxy_dict
from backend.utils.tg_session import get_global_semaphore, get_session_mode

settings = get_settings()
logger = logging.getLogger("backend.sign_tasks")


class TaskLogHandler(logging.Handler):
    """
    自定义日志处理器,将日志实时写入到内存列表中
    """

    def __init__(self, log_list: List[str]):
        super().__init__()
        self.log_list = log_list

    def emit(self, record):
        try:
            msg = self.format(record)
            self.log_list.append(msg)
            # 保持日志长度,避免内存占用过大
            if len(self.log_list) > 1000:
                self.log_list.pop(0)
        except Exception:
            self.handleError(record)

class SignTaskService:
    """签到任务服务类"""

    @staticmethod
    def _read_positive_int_env(name: str, default: int, minimum: int = 1) -> int:
        raw = os.getenv(name)
        if raw is None:
            return default
        try:
            return max(int(raw), minimum)
        except (TypeError, ValueError):
            return default

    def __init__(self):
        settings = get_settings()
        self.workdir = settings.resolve_workdir()
        self.task_store = get_sign_task_store()
        self.history_store = get_run_history_store()
        self.session_store = get_session_store()
        self.telegram_engine = get_tg_signer_adapter()
        self.signs_dir = self.workdir / "signs"
        self.run_history_dir = self.history_store.run_history_dir
        logger.debug(
            "Initialized SignTaskService signs_dir=%s exists=%s",
            self.signs_dir,
            self.signs_dir.exists(),
        )
        self._active_logs: Dict[tuple[str, str], List[str]] = {}  # (account, task) -> logs
        self._active_tasks: Dict[tuple[str, str], bool] = {}  # (account, task) -> running
        self._cleanup_tasks: Dict[tuple[str, str], asyncio.Task] = {}
        self._account_locks: Dict[str, asyncio.Lock] = {}  # 账号锁
        self._account_last_run_end: Dict[str, float] = {}  # 账号最后一次结束时间
        self._account_cooldown_seconds = int(
            os.getenv("SIGN_TASK_ACCOUNT_COOLDOWN", "5")
        )
        self.cleanup_old_logs()

    @staticmethod
    def _task_requires_updates(task_config: Optional[Dict[str, Any]]) -> bool:
        """
        判断任务是否依赖 update handlers。
        """
        if not isinstance(task_config, dict):
            return True
        chats = task_config.get("chats")
        if not isinstance(chats, list):
            return True
        response_actions = {3, 4, 5, 6, 7}
        for chat in chats:
            if not isinstance(chat, dict):
                continue
            actions = chat.get("actions")
            if not isinstance(actions, list):
                continue
            for action in actions:
                if not isinstance(action, dict):
                    continue
                try:
                    action_id = int(action.get("action"))
                except (TypeError, ValueError):
                    continue
                if action_id in response_actions:
                    return True
        return False

    def cleanup_old_logs(self) -> None:
        self.history_store.cleanup_old_logs()

    def _cleanup_old_logs(self) -> None:
        self.cleanup_old_logs()

    def get_task_history_logs(
        self, task_name: str, account_name: str, limit: int = 20
    ) -> List[Dict[str, Any]]:
        return [
            entry.to_dict()
            for entry in self.history_store.get_task_history_logs(
                task_name, account_name, limit=limit
            )
        ]

    def get_account_history_logs(self, account_name: str) -> List[Dict[str, Any]]:
        return [
            dict(item) for item in self.history_store.get_account_history_logs(account_name)
        ]

    def clear_account_history_logs(self, account_name: str) -> Dict[str, int]:
        tasks = self.list_tasks(account_name=account_name)
        task_names = [task.get("name") or "" for task in tasks]
        for task in tasks:
            existing = self.task_store.get_task(task.get("name") or "", account_name)
            if existing is None:
                continue
            existing.last_run = None
            self.task_store.save_task(existing)
        return self.history_store.clear_account_history(account_name, task_names)

    def _get_last_run_info(
        self, task_dir: Path, account_name: str = ""
    ) -> Optional[Dict[str, Any]]:
        task_name = task_dir.name if hasattr(task_dir, "name") else str(task_dir)
        return self.history_store.get_last_run_info(task_name, account_name)

    def _save_run_info(
        self,
        task_name: str,
        success: bool,
        message: str = "",
        account_name: str = "",
        flow_logs: Optional[List[str]] = None,
    ):
        try:
            new_entry = self.history_store.save_run_info(
                task_name,
                success,
                message,
                account_name,
                flow_logs=list(flow_logs or []),
            )
            self.task_store.update_last_run(task_name, account_name, new_entry)
        except Exception as e:
            logger.warning("Failed to persist task run info: %s", e)

    def _append_scheduler_log(self, filename: str, message: str) -> None:
        try:
            logs_dir = settings.resolve_logs_dir()
            logs_dir.mkdir(parents=True, exist_ok=True)
            log_path = logs_dir / filename
            with open(log_path, 'a', encoding='utf-8') as f:
                f.write(f'{message}\n')
        except Exception as e:
            logging.getLogger('backend.sign_tasks').warning(
                'Failed to write scheduler log %s: %s', filename, e
            )

    def list_tasks(
        self, account_name: Optional[str] = None, force_refresh: bool = False
    ) -> List[Dict[str, Any]]:
        task_definitions = self.task_store.list_tasks(
            account_name=account_name, force_refresh=force_refresh
        )
        result: list[dict[str, Any]] = []
        for task in task_definitions:
            payload = task.to_dict()
            if not payload.get("last_run"):
                payload["last_run"] = self.history_store.get_last_run_info(
                    task.name, task.account_name
                )
            result.append(payload)
        return result

    def get_task(
        self, task_name: str, account_name: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        task = self.task_store.get_task(task_name, account_name)
        if task is None:
            return None
        payload = task.to_dict()
        if not payload.get("last_run"):
            payload["last_run"] = self.history_store.get_last_run_info(
                task.name, task.account_name
            )
        return payload

    def create_task(
        self,
        task_name: str,
        sign_at: str,
        chats: List[Dict[str, Any]],
        random_seconds: int = 0,
        sign_interval: Optional[int] = None,
        account_name: str = "",
        execution_mode: str = "fixed",
        range_start: str = "",
        range_end: str = "",
    ) -> Dict[str, Any]:
        import random

        from backend.services.config import get_config_service

        if not account_name:
            raise ValueError("必须指定账号名称")

        if sign_interval is None:
            config_service = get_config_service()
            global_settings = config_service.get_global_settings()
            sign_interval = global_settings.get("sign_interval")

        if sign_interval is None:
            sign_interval = random.randint(1, 120)

        task = SignTaskDefinition(
            name=task_name,
            account_name=account_name,
            sign_at=sign_at,
            chats=chats,
            random_seconds=random_seconds,
            sign_interval=sign_interval,
            enabled=True,
            execution_mode=execution_mode,
            range_start=range_start,
            range_end=range_end,
        )
        self.task_store.save_task(task)

        try:
            from backend.scheduler import add_or_update_sign_task_job

            add_or_update_sign_task_job(
                account_name,
                task_name,
                range_start if execution_mode == "range" else sign_at,
                enabled=True,
            )
        except Exception as e:
            logger.warning(
                "Failed to update scheduler job for %s/%s: %s",
                account_name,
                task_name,
                e,
            )

        return task.to_dict()

    def update_task(
        self,
        task_name: str,
        sign_at: Optional[str] = None,
        chats: Optional[List[Dict[str, Any]]] = None,
        random_seconds: Optional[int] = None,
        sign_interval: Optional[int] = None,
        account_name: Optional[str] = None,
        execution_mode: Optional[str] = None,
        range_start: Optional[str] = None,
        range_end: Optional[str] = None,
    ) -> Dict[str, Any]:
        existing = self.get_task(task_name, account_name)
        if not existing:
            raise ValueError(f"任务 {task_name} 不存在")

        acc_name = (
            account_name
            if account_name is not None
            else existing.get("account_name", "")
        )

        task = SignTaskDefinition(
            name=task_name,
            account_name=acc_name,
            sign_at=sign_at if sign_at is not None else existing["sign_at"],
            random_seconds=(
                random_seconds
                if random_seconds is not None
                else existing["random_seconds"]
            ),
            sign_interval=(
                sign_interval if sign_interval is not None else existing["sign_interval"]
            ),
            chats=chats if chats is not None else existing["chats"],
            enabled=bool(existing.get("enabled", True)),
            last_run=existing.get("last_run"),
            execution_mode=(
                execution_mode
                if execution_mode is not None
                else existing.get("execution_mode", "fixed")
            ),
            range_start=(
                range_start
                if range_start is not None
                else existing.get("range_start", "")
            ),
            range_end=range_end if range_end is not None else existing.get("range_end", ""),
        )
        self.task_store.save_task(task)

        try:
            from backend.scheduler import add_or_update_sign_task_job

            add_or_update_sign_task_job(
                task.account_name,
                task_name,
                task.range_start if task.execution_mode == "range" else task.sign_at,
                enabled=True,
            )
        except Exception as e:
            msg = f"更新调度任务失败: {e}"
            logger.warning(
                "Failed to update scheduler job for %s/%s: %s",
                task.account_name,
                task_name,
                e,
            )
            self._append_scheduler_log(
                "scheduler_error.log", f"{datetime.now()}: {msg}"
            )
        else:
            self._append_scheduler_log(
                "scheduler_update.log",
                f"{datetime.now()}: Updated task {task_name} with cron {task.range_start if task.execution_mode == 'range' else task.sign_at}",
            )

        return task.to_dict()

    def delete_task(self, task_name: str, account_name: Optional[str] = None) -> bool:
        existing = self.task_store.get_task(task_name, account_name)
        if existing is None:
            return False

        if not self.task_store.delete_task(task_name, existing.account_name):
            return False

        try:
            from backend.scheduler import remove_sign_task_job

            remove_sign_task_job(existing.account_name, task_name)
        except Exception as e:
            logger.warning(
                "Failed to remove scheduler job for %s/%s: %s",
                existing.account_name,
                task_name,
                e,
            )
        return True

    async def get_account_chats(
        self, account_name: str, force_refresh: bool = False
    ) -> List[Dict[str, Any]]:
        if not force_refresh:
            cached = self.task_store.load_chat_cache(account_name)
            if cached is not None:
                return cached

        return await self.refresh_account_chats(account_name)

    def search_account_chats(
        self,
        account_name: str,
        query: str,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        通过缓存搜索账号的 Chat 列表(不触发全量 get_dialogs)
        """
        if limit < 1:
            limit = 1
        if limit > 200:
            limit = 200
        if offset < 0:
            offset = 0

        data = self.task_store.load_chat_cache(account_name)
        if data is None:
            return {"items": [], "total": 0, "limit": limit, "offset": offset}

        q = (query or "").strip()
        if not q:
            total = len(data)
            return {
                "items": data[offset : offset + limit],
                "total": total,
                "limit": limit,
                "offset": offset,
            }

        is_numeric = q.lstrip("-").isdigit()
        if is_numeric or q.startswith("-100"):
            def match(chat: Dict[str, Any]) -> bool:
                chat_id = chat.get("id")
                if chat_id is None:
                    return False
                return q in str(chat_id)
        else:
            q_lower = q.lower()

            def match(chat: Dict[str, Any]) -> bool:
                title = (chat.get("title") or "").lower()
                username = (chat.get("username") or "").lower()
                return q_lower in title or q_lower in username

        filtered = [c for c in data if match(c)]
        total = len(filtered)
        return {
            "items": filtered[offset : offset + limit],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    @staticmethod
    def _is_invalid_session_error(err: Exception) -> bool:
        msg = str(err)
        if not msg:
            return False
        upper = msg.upper()
        return (
            "AUTH_KEY_UNREGISTERED" in upper
            or "AUTH_KEY_INVALID" in upper
            or "SESSION_REVOKED" in upper
            or "SESSION_EXPIRED" in upper
            or "USER_DEACTIVATED" in upper
        )

    async def _cleanup_invalid_session(self, account_name: str) -> None:
        try:
            from backend.services.telegram import get_telegram_service

            await get_telegram_service().delete_account(account_name)
        except Exception as e:
            logger.warning("Failed to cleanup invalid session for %s: %s", account_name, e)

        # 清理 chats 缓存,避免后续误用旧数据
        try:
            cache_file = self.signs_dir / account_name / "chats_cache.json"
            if cache_file.exists():
                cache_file.unlink()
        except Exception:
            pass

    async def refresh_account_chats(self, account_name: str) -> List[Dict[str, Any]]:
        """
        连接 Telegram 并刷新 Chat 列表
        """
        from pyrogram.enums import ChatType

        # 获取 session 文件路径
        from backend.core.config import get_settings
        from backend.services.config import get_config_service

        settings = get_settings()
        session_dir = settings.resolve_session_dir()
        session_mode = get_session_mode()
        session_string = None
        fallback_session_string = None
        used_fallback_session = False
        session_file = session_dir / f"{account_name}.session"

        if session_mode == "string":
            session_string = self.session_store.get_session_string(
                session_dir, account_name
            )
            if not session_string:
                raise ValueError(f"账号 {account_name} 登录已失效,请重新登录")
        else:
            fallback_session_string = self.session_store.get_session_string(
                session_dir, account_name
            )
            if not session_file.exists():
                if fallback_session_string:
                    session_string = fallback_session_string
                    used_fallback_session = True
                else:
                    raise ValueError(f"账号 {account_name} 登录已失效,请重新登录")

        config_service = get_config_service()
        tg_config = config_service.get_telegram_config()
        api_id = os.getenv("TG_API_ID") or tg_config.get("api_id")
        api_hash = os.getenv("TG_API_HASH") or tg_config.get("api_hash")

        try:
            api_id = int(api_id) if api_id is not None else None
        except (TypeError, ValueError):
            api_id = None

        if isinstance(api_hash, str):
            api_hash = api_hash.strip()

        if not api_id or not api_hash:
            raise ValueError("未配置 Telegram API ID 或 API Hash")

        # 使用 get_client 获取(可能共享的)客户端实例
        proxy_dict = None
        proxy_value = self.session_store.get_account_proxy(account_name)
        if proxy_value:
            proxy_dict = build_proxy_dict(proxy_value)
        client_kwargs = {
            "name": account_name,
            "workdir": session_dir,
            "api_id": api_id,
            "api_hash": api_hash,
            "session_string": session_string,
            "in_memory": session_mode == "string",
            "proxy": proxy_dict,
            "no_updates": True,
        }
        client = self.telegram_engine.get_client(**client_kwargs)

        chats: List[Dict[str, Any]] = []
        logger = logging.getLogger("backend")
        try:
            # 初始化账号锁(跨服务共享)
            if account_name not in self._account_locks:
                self._account_locks[account_name] = get_account_lock(account_name)

            account_lock = self._account_locks[account_name]

            async def _fetch_chats(active_client) -> List[Dict[str, Any]]:
                local_chats: List[Dict[str, Any]] = []
                # 带超时获取账号锁,避免无限等待
                try:
                    await asyncio.wait_for(account_lock.acquire(), timeout=30.0)
                except asyncio.TimeoutError:
                    raise RuntimeError(f"账号 {account_name} 锁等待超时,可能有其他任务正在执行")
                try:
                    async with get_global_semaphore():
                        async with active_client:
                            # 尝试获取用户信息,如果失败说明 session 无效
                            await active_client.get_me()

                            try:
                                async for dialog in active_client.get_dialogs():
                                    try:
                                        chat = getattr(dialog, "chat", None)
                                        if chat is None:
                                            logger.warning(
                                                "get_dialogs 返回空 chat,已跳过"
                                            )
                                            continue
                                        chat_id = getattr(chat, "id", None)
                                        if chat_id is None:
                                            logger.warning(
                                                "get_dialogs 返回 chat.id 为空,已跳过"
                                            )
                                            continue

                                        chat_info = {
                                            "id": chat_id,
                                            "title": chat.title
                                            or chat.first_name
                                            or chat.username
                                            or str(chat_id),
                                            "username": chat.username,
                                            "type": chat.type.name.lower(),
                                        }

                                        # 特殊处理机器人和私聊
                                        if chat.type == ChatType.BOT:
                                            chat_info["title"] = f"🤖 {chat_info['title']}"

                                        local_chats.append(chat_info)
                                    except Exception as e:
                                        logger.warning(
                                            f"处理 dialog 失败,已跳过: {type(e).__name__}: {e}"
                                        )
                                        continue
                            except Exception as e:
                                # Pyrogram 边界异常:保留已获取结果
                                logger.warning(
                                    f"get_dialogs 中断,返回已获取结果: {type(e).__name__}: {e}"
                                )
                    return local_chats
                finally:
                    account_lock.release()

            try:
                chats = await _fetch_chats(client)
            except Exception as e:
                if self._is_invalid_session_error(e):
                    if fallback_session_string and not used_fallback_session:
                        logger.warning(
                            "Session invalid for %s, retry with session_string: %s",
                            account_name,
                            e,
                        )
                        try:
                            await self.telegram_engine.close_client(
                                account_name, workdir=session_dir
                            )
                        except Exception:
                            pass
                        used_fallback_session = True
                        retry_kwargs = dict(client_kwargs)
                        retry_kwargs["session_string"] = fallback_session_string
                        retry_kwargs["in_memory"] = True
                        retry_kwargs["no_updates"] = True
                        client = self.telegram_engine.get_client(**retry_kwargs)
                        chats = await _fetch_chats(client)
                    else:
                        logger.warning(
                            "Session invalid for %s: %s",
                            account_name,
                            e,
                        )
                        await self._cleanup_invalid_session(account_name)
                        raise ValueError(f"账号 {account_name} 登录已失效,请重新登录")
                else:
                    raise

            # 保存到缓存
            try:
                self.task_store.save_chat_cache(account_name, chats)
            except Exception as e:
                logger.warning("Failed to persist chats cache for %s: %s", account_name, e)

            return chats

        except Exception as e:
            # client 上下文管理器会自动处理 disconnect/stop,这里只需要处理业务异常
            raise e

    async def run_task(self, account_name: str, task_name: str) -> Dict[str, Any]:
        """
        运行签到任务 (兼容接口,内部调用 run_task_with_logs)
        """
        return await self.run_task_with_logs(account_name, task_name)

    def invalidate_cache(self) -> None:
        self.task_store.invalidate_cache()

    def list_task_definitions(
        self, account_name: Optional[str] = None, force_refresh: bool = False
    ) -> List[SignTaskDefinition]:
        return self.task_store.list_tasks(
            account_name=account_name, force_refresh=force_refresh
        )

    def _task_key(self, account_name: str, task_name: str) -> tuple[str, str]:
        return account_name, task_name

    def _find_task_keys(self, task_name: str) -> List[tuple[str, str]]:
        return [key for key in self._active_logs.keys() if key[1] == task_name]

    def get_active_logs(
        self, task_name: str, account_name: Optional[str] = None
    ) -> List[str]:
        """获取正在运行任务的日志"""
        if account_name:
            return self._active_logs.get(self._task_key(account_name, task_name), [])
        # 兼容旧接口:返回第一个同名任务的日志
        for key in self._find_task_keys(task_name):
            return self._active_logs.get(key, [])
        return []

    def is_task_running(self, task_name: str, account_name: Optional[str] = None) -> bool:
        """检查任务是否正在运行"""
        if account_name:
            return self._active_tasks.get(self._task_key(account_name, task_name), False)
        return any(key[1] == task_name for key, running in self._active_tasks.items() if running)

    async def run_task_with_logs(
        self, account_name: str, task_name: str
    ) -> Dict[str, Any]:
        """运行任务并实时捕获日志 (In-Process)"""

        if self.is_task_running(task_name, account_name):
            return {"success": False, "error": "任务已经在运行中", "output": ""}

        # 初始化账号锁(跨服务共享)
        if account_name not in self._account_locks:
            self._account_locks[account_name] = get_account_lock(account_name)

        account_lock = self._account_locks[account_name]

        # 检查是否能获取锁 (非阻塞检查,如果已被锁定则说明该账号有其他任务在运行)
        # 这里我们希望排队等待,还是直接报错?
        # 考虑到定时任务同时触发,应该排队执行。
        logger.debug("Waiting for account lock account=%s task=%s", account_name, task_name)

        task_key = self._task_key(account_name, task_name)
        self._active_tasks[task_key] = True
        self._active_logs[task_key] = []

        # 获取 logger 实例
        tg_logger = logging.getLogger("tg-signer")
        log_handler = TaskLogHandler(self._active_logs[task_key])
        log_handler.setLevel(logging.INFO)
        log_handler.setFormatter(logging.Formatter("%(asctime)s - %(message)s"))
        tg_logger.addHandler(log_handler)

        success = False
        error_msg = ""
        output_str = ""

        try:
            async with account_lock:
                last_end = self._account_last_run_end.get(account_name)
                if last_end:
                    gap = time.time() - last_end
                    wait_seconds = self._account_cooldown_seconds - gap
                    if wait_seconds > 0:
                        self._active_logs[task_key].append(
                            f"等待账号冷却 {int(wait_seconds)} 秒"
                        )
                        await asyncio.sleep(wait_seconds)

                logger.debug("Acquired account lock account=%s task=%s", account_name, task_name)
                self._active_logs[task_key].append(
                    f"开始执行任务: {task_name} (账号: {account_name})"
                )

                # 配置 API 凭据
                from backend.services.config import get_config_service

                config_service = get_config_service()
                tg_config = config_service.get_telegram_config()
                api_id = os.getenv("TG_API_ID") or tg_config.get("api_id")
                api_hash = os.getenv("TG_API_HASH") or tg_config.get("api_hash")

                try:
                    api_id = int(api_id) if api_id is not None else None
                except (TypeError, ValueError):
                    api_id = None

                if isinstance(api_hash, str):
                    api_hash = api_hash.strip()

                if not api_id or not api_hash:
                    raise ValueError("未配置 Telegram API ID 或 API Hash")

                session_dir = settings.resolve_session_dir()
                session_mode = get_session_mode()
                session_string = None
                use_in_memory = False
                proxy_dict = None
                proxy_value = self.session_store.get_account_proxy(account_name)
                if proxy_value:
                    proxy_dict = build_proxy_dict(proxy_value)

                if session_mode == "string":
                    session_string = self.session_store.get_session_string(
                        session_dir, account_name
                    )
                    if not session_string:
                        raise ValueError(f"账号 {account_name} 的 session_string 不存在")
                    use_in_memory = True
                else:
                    session_string = self.session_store.get_session_string(
                        session_dir, account_name
                    )
                    use_in_memory = bool(session_string)

                    if os.getenv("SIGN_TASK_FORCE_IN_MEMORY") == "1":
                        use_in_memory = True

                task_cfg = self.get_task(task_name, account_name=account_name)
                requires_updates = self._task_requires_updates(task_cfg)
                signer_no_updates = not requires_updates
                self._active_logs[task_key].append(
                    f"消息更新监听: {'开启' if requires_updates else '关闭'}"
                )

                # 实例化 UserSigner (使用 BackendUserSigner)
                # 注意: UserSigner 内部会使用 get_client 复用 client
                signer = self.telegram_engine.create_signer(
                    task_name=task_name,
                    session_dir=str(session_dir),
                    account=account_name,
                    workdir=self.workdir,
                    proxy=proxy_dict,
                    session_string=session_string,
                    in_memory=use_in_memory,
                    api_id=api_id,
                    api_hash=api_hash,
                    no_updates=signer_no_updates,
                )

                # 执行任务(数据库锁冲突时重试,含指数退避和随机抖动)
                async with get_global_semaphore():
                    import random as _rnd
                    max_retries = 5
                    for attempt in range(max_retries):
                        try:
                            await signer.run_once(num_of_dialogs=20)
                            break
                        except Exception as e:
                            if "database is locked" in str(e).lower():
                                if attempt < max_retries - 1:
                                    delay = min((attempt + 1) * 3, 12) + _rnd.uniform(0, 1.5)
                                    self._active_logs[task_key].append(
                                        f"Session 被锁定,{delay:.0f} 秒后重试... ({attempt + 1}/{max_retries})"
                                    )
                                    await asyncio.sleep(delay)
                                    continue
                            raise

                success = True
                self._active_logs[task_key].append("任务执行完成")

                # 增加缓冲时间,防止同账号连续执行任务时,Session文件锁尚未完全释放导致 "database is locked"
                await asyncio.sleep(2)

        except Exception as e:
            error_msg = f"任务执行出错: {str(e)}"
            self._active_logs[task_key].append(error_msg)
            logger.exception(
                "Task execution failed account=%s task=%s: %s",
                account_name,
                task_name,
                e,
            )
        finally:
            self._account_last_run_end[account_name] = time.time()
            self._active_tasks[task_key] = False
            tg_logger.removeHandler(log_handler)

            # 保存执行记录
            final_logs = list(self._active_logs.get(task_key, []))
            output_str = "\n".join(final_logs)
            msg = error_msg if not success else ""
            self._save_run_info(
                task_name,
                success,
                msg,
                account_name,
                flow_logs=final_logs,
            )

            # 触发 Bot 通知(异步,不阻塞主流程)
            try:
                from backend.services.bot_notify import get_bot_notify_service

                asyncio.create_task(
                    get_bot_notify_service().send_task_result(
                        task_name, success, msg, account_name
                    )
                )
            except Exception:
                pass

            # 延迟清理日志(同一 task_key 仅保留一个 cleanup 协程)
            old_cleanup_task = self._cleanup_tasks.get(task_key)
            if old_cleanup_task and not old_cleanup_task.done():
                old_cleanup_task.cancel()

            async def cleanup():
                try:
                    await asyncio.sleep(60)
                    if not self._active_tasks.get(task_key):
                        self._active_logs.pop(task_key, None)
                finally:
                    self._cleanup_tasks.pop(task_key, None)

            self._cleanup_tasks[task_key] = asyncio.create_task(cleanup())

        return {
            "success": success,
            "output": output_str,
            "error": error_msg,
        }


# 创建全局实例
_sign_task_service: Optional[SignTaskService] = None


def get_sign_task_service() -> SignTaskService:
    global _sign_task_service
    if _sign_task_service is None:
        _sign_task_service = SignTaskService()
    return _sign_task_service
