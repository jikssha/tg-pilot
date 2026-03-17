"""
Telegram Bot 通知服务
通过 Telegram Bot API 发送任务执行结果通知
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

from backend.core.config import get_settings

logger = logging.getLogger("backend.bot_notify")

settings = get_settings()


class BotNotifyService:
    """Bot 通知服务"""

    def __init__(self):
        self.workdir = settings.resolve_workdir()
        self._config_cache: Optional[Dict] = None

    def _get_config_file(self) -> Path:
        """配置文件路径"""
        return self.workdir / ".bot_notify.json"

    def get_config(self) -> Optional[Dict]:
        """获取通知配置"""
        if self._config_cache is not None:
            return self._config_cache

        config_file = self._get_config_file()
        if not config_file.exists():
            return None

        try:
            with open(config_file, "r", encoding="utf-8") as f:
                self._config_cache = json.load(f)
                return self._config_cache
        except (json.JSONDecodeError, OSError):
            return None

    def save_config(
        self,
        bot_token: Optional[str] = None,
        chat_id: Optional[str] = None,
        enabled: bool = True,
        notify_on_success: bool = True,
        notify_on_failure: bool = True,
        daily_summary: bool = True,
        daily_summary_hour: int = 22,
        daily_summary_minute: int = 0,
    ) -> bool:
        """保存通知配置"""
        existing = self.get_config() or {}

        # 保留现有 token（如果新值为空）
        final_token = (bot_token or "").strip() or existing.get("bot_token", "")
        final_chat_id = (chat_id or "").strip() or existing.get("chat_id", "")

        if not final_token:
            raise ValueError("Bot Token 不能为空")
        if not final_chat_id:
            raise ValueError("Chat ID 不能为空")

        config = {
            "bot_token": final_token,
            "chat_id": final_chat_id,
            "enabled": enabled,
            "notify_on_success": notify_on_success,
            "notify_on_failure": notify_on_failure,
            "daily_summary": daily_summary,
            "daily_summary_hour": max(0, min(23, daily_summary_hour)),
            "daily_summary_minute": max(0, min(59, daily_summary_minute)),
        }

        config_file = self._get_config_file()
        try:
            with open(config_file, "w", encoding="utf-8") as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
            self._config_cache = config
            return True
        except OSError:
            return False

    def delete_config(self) -> bool:
        """删除通知配置"""
        config_file = self._get_config_file()
        self._config_cache = None
        if not config_file.exists():
            return True
        try:
            config_file.unlink()
            return True
        except OSError:
            return False

    async def _send_message(self, bot_token: str, chat_id: str, text: str) -> Dict:
        """调用 Telegram Bot API 发送消息"""
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
            result = resp.json()

            if not result.get("ok"):
                error_desc = result.get("description", "Unknown error")
                raise RuntimeError(f"Telegram API 错误: {error_desc}")

            return result

    async def test_notify(self) -> Dict:
        """发送测试消息"""
        config = self.get_config()
        if not config:
            return {"success": False, "message": "未配置 Bot 通知"}

        bot_token = config.get("bot_token", "")
        chat_id = config.get("chat_id", "")

        if not bot_token or not chat_id:
            return {"success": False, "message": "Bot Token 或 Chat ID 为空"}

        try:
            text = (
                "🔔 <b>TG-Pilot 通知测试</b>\n\n"
                f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
                "✅ 连接成功！通知功能已就绪。"
            )
            await self._send_message(bot_token, chat_id, text)
            return {"success": True, "message": "测试消息已发送"}
        except Exception as e:
            return {"success": False, "message": f"发送失败: {str(e)}"}

    async def send_task_result(
        self,
        task_name: str,
        success: bool,
        message: str = "",
        account_name: str = "",
    ):
        """发送单任务执行结果通知"""
        try:
            config = self.get_config()
            if not config or not config.get("enabled"):
                return

            # 根据配置判断是否需要发送
            if success and not config.get("notify_on_success", True):
                return
            if not success and not config.get("notify_on_failure", True):
                return

            bot_token = config.get("bot_token", "")
            chat_id = config.get("chat_id", "")
            if not bot_token or not chat_id:
                return

            icon = "✅" if success else "❌"
            status_text = "成功" if success else "失败"
            time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            text = (
                f"{icon} <b>签到{status_text}</b> | {account_name} / {task_name}\n"
                f"⏰ {time_str}"
            )
            if message:
                # 截断过长的消息
                msg_display = message[:200] + "..." if len(message) > 200 else message
                text += f"\n📝 {msg_display}"

            await self._send_message(bot_token, chat_id, text)
        except Exception as e:
            logger.warning("Bot 通知发送失败: %s", e)

    async def send_daily_summary(self):
        """发送每日汇总报告"""
        try:
            config = self.get_config()
            if not config or not config.get("enabled") or not config.get("daily_summary"):
                return

            bot_token = config.get("bot_token", "")
            chat_id = config.get("chat_id", "")
            if not bot_token or not chat_id:
                return

            # 收集当日所有任务执行结果
            from backend.services.sign_tasks import get_sign_task_service

            service = get_sign_task_service()
            tasks = service.list_tasks()
            today = datetime.now().strftime("%Y-%m-%d")

            # 按账号分组
            account_results: Dict[str, List[Dict]] = {}
            total_success = 0
            total_failure = 0

            for task in tasks:
                task_name = task.get("name", "")
                account_name = task.get("account_name", "")

                if not task_name or not account_name:
                    continue

                # 获取最近一次执行记录
                last_run = task.get("last_run")
                if not last_run:
                    continue

                run_time = last_run.get("time", "")
                if not run_time or not run_time.startswith(today):
                    continue

                run_success = last_run.get("success", False)
                run_message = last_run.get("message", "")

                if account_name not in account_results:
                    account_results[account_name] = []

                account_results[account_name].append({
                    "task_name": task_name,
                    "success": run_success,
                    "message": run_message,
                })

                if run_success:
                    total_success += 1
                else:
                    total_failure += 1

            total = total_success + total_failure

            if total == 0:
                logger.info("今日没有任务执行结果，跳过发送汇总报告")
                return

            # 构建汇总消息
            text = (
                f"📊 <b>每日签到报告</b> | {today}\n\n"
                f"✅ 成功: {total_success} | ❌ 失败: {total_failure} | 📋 总计: {total}\n"
            )

            for account, results in account_results.items():
                text += f"\n🔹 <b>{account}</b> ({len(results)} 任务)\n"
                for r in results:
                    icon = "✅" if r["success"] else "❌"
                    msg = ""
                    if r["message"]:
                        msg_short = r["message"][:50] + "..." if len(r["message"]) > 50 else r["message"]
                        msg = f" — {msg_short}"
                    text += f"  {icon} {r['task_name']}{msg}\n"

            await self._send_message(bot_token, chat_id, text)
            logger.info("每日汇总报告已发送")
        except Exception as e:
            logger.warning("每日汇总报告发送失败: %s", e)


# 全局单例
_bot_notify_service: Optional[BotNotifyService] = None


def get_bot_notify_service() -> BotNotifyService:
    global _bot_notify_service
    if _bot_notify_service is None:
        _bot_notify_service = BotNotifyService()
    return _bot_notify_service
