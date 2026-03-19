"""
配置管理服务
提供任务配置的导入导出功能
"""

from __future__ import annotations

import io
import json
import logging
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.contracts import SignTaskDefinition
from backend.core.config import get_settings
from backend.stores import get_sign_task_store
from backend.utils.storage import (
    clear_data_dir_override,
    is_writable_dir,
    load_data_dir_override,
    save_data_dir_override,
)

settings = get_settings()
logger = logging.getLogger("backend.config")


class ConfigService:
    """配置管理服务类"""

    EXPORT_SCHEMA_VERSION = 1
    EXPORT_SOURCE = "tg-pilot"

    def __init__(self):
        self.workdir = settings.resolve_workdir()
        self.signs_dir = self.workdir / "signs"
        self.monitors_dir = self.workdir / "monitors"
        self.sign_task_store = get_sign_task_store()

        # 确保目录存在
        self.signs_dir.mkdir(parents=True, exist_ok=True)
        self.monitors_dir.mkdir(parents=True, exist_ok=True)

    @classmethod
    def _export_metadata(cls, payload_type: str) -> dict[str, Any]:
        return {
            "schema_version": cls.EXPORT_SCHEMA_VERSION,
            "payload_type": payload_type,
            "source": cls.EXPORT_SOURCE,
            "exported_at": datetime.utcnow().isoformat() + "Z",
        }

    @staticmethod
    def _is_versioned_payload(data: Any, payload_type: str | None = None) -> bool:
        if not isinstance(data, dict):
            return False
        if "schema_version" not in data:
            return False
        if payload_type is None:
            return True
        return data.get("payload_type") == payload_type

    def list_sign_tasks(self) -> List[str]:
        """获取所有签到任务名称列表"""
        return sorted(
            {
                task.name
                for task in self.sign_task_store.list_tasks(force_refresh=True)
            }
        )

    def list_monitor_tasks(self) -> List[str]:
        """获取所有监控任务名称列表"""
        tasks = []

        if self.monitors_dir.exists():
            for task_dir in self.monitors_dir.iterdir():
                if task_dir.is_dir():
                    config_file = task_dir / "config.json"
                    if config_file.exists():
                        tasks.append(task_dir.name)

        return sorted(tasks)

    def _find_sign_task_dirs(self, task_name: str) -> List[Path]:
        matches = []
        if not self.signs_dir.exists():
            return matches

        # 1. 旧版结构: signs/task
        direct_dir = self.signs_dir / task_name
        if (direct_dir / "config.json").exists():
            matches.append(direct_dir)

        # 2. 新版结构: signs/account/task
        for acc_dir in self.signs_dir.iterdir():
            if acc_dir.is_dir():
                nested_task_dir = acc_dir / task_name
                if (nested_task_dir / "config.json").exists():
                    matches.append(nested_task_dir)

        return matches

    def get_sign_config(
        self, task_name: str, account_name: Optional[str] = None
    ) -> Optional[Dict]:
        """
        获取签到任务配置

        Args:
            task_name: 任务名称
            account_name: 账号名称(可选)

        Returns:
            配置字典,如果不存在则返回 None
        """
        task = self.sign_task_store.get_task(task_name, account_name=account_name)
        if task is None:
            return None
        payload = task.to_dict()
        payload.pop("name", None)
        payload.pop("enabled", None)
        return payload

    def save_sign_config(self, task_name: str, config: Dict) -> bool:
        """
        保存签到任务配置

        Args:
            task_name: 任务名称
            config: 配置字典

        Returns:
            是否成功保存
        """
        try:
            definition = SignTaskDefinition(
                name=task_name,
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
            self.sign_task_store.save_task(definition)
            return True
        except Exception:
            return False

    def delete_sign_config(
        self, task_name: str, account_name: Optional[str] = None
    ) -> bool:
        """
        删除签到任务配置

        Args:
            task_name: 任务名称
            account_name: 账号名称(可选)

        Returns:
            是否成功删除
        """
        task = self.sign_task_store.get_task(task_name, account_name=account_name)
        if task is None:
            return False
        return self.sign_task_store.delete_task(task_name, task.account_name)

    def export_sign_task(
        self, task_name: str, account_name: Optional[str] = None
    ) -> Optional[str]:
        """
        导出签到任务配置为 JSON 字符串

        Args:
            task_name: 任务名称
            account_name: 账号名称(可选)

        Returns:
            JSON 字符串,如果任务不存在则返回 None
        """
        config = self.get_sign_config(task_name, account_name=account_name)

        if config is None:
            return None

        config = dict(config)
        config.pop("last_run", None)
        # Keep exported payload account-agnostic for cross-account imports.
        config.pop("account_name", None)

        # 添加元数据
        export_data = {
            **self._export_metadata("sign_task"),
            "task_name": task_name,
            "task_type": "sign",
            "config": config,
        }

        return json.dumps(export_data, ensure_ascii=False, indent=2)

    def import_sign_task(
        self,
        json_str: str,
        task_name: Optional[str] = None,
        account_name: Optional[str] = None,
    ) -> bool:
        """
        导入签到任务配置

        Args:
            json_str: JSON 字符串
            task_name: 新任务名称(可选,如果不提供则使用原名称)
            account_name: 新账号名称(可选,如果不提供则使用原名称)

        Returns:
            是否成功导入
        """
        try:
            data = json.loads(json_str)
            if self._is_versioned_payload(data, "sign_task"):
                data = {
                    "task_name": data.get("task_name"),
                    "config": data.get("config"),
                }

            # 兼容性处理：如果数据是包装好的格式则解包，否则视为直接的配置对象
            if isinstance(data, dict):
                if "config" in data and isinstance(data["config"], dict):
                    config = data["config"]
                    source_task_name = data.get("task_name")
                else:
                    config = data
                    source_task_name = config.get("name")
            else:
                return False

            # 确定任务名称
            final_task_name = task_name or source_task_name or "imported_task"

            if account_name:
                config["account_name"] = account_name

            # 保存配置
            return self.save_sign_config(final_task_name, config)

        except (json.JSONDecodeError, KeyError):
            return False

    def export_all_configs(self) -> str:
        """
        导出所有配置
        Returns:
            包含所有配置的 JSON 字符串
        """
        all_configs = {
            **self._export_metadata("config_bundle"),
            "signs": {},
            "monitors": {},
            "settings": {}, # 新增 settings 字段
        }

        # 导出所有签到任务
        for task in self.sign_task_store.list_tasks(force_refresh=True):
            config = task.to_dict()
            config.pop("name", None)
            config.pop("enabled", None)
            config.pop("last_run", None)
            key = f"{task.name}@{task.account_name}" if task.account_name else task.name
            all_configs["signs"][key] = config

        # 导出所有监控任务
        for task_name in self.list_monitor_tasks():
            config_file = self.monitors_dir / task_name / "config.json"
            if config_file.exists():
                try:
                    with open(config_file, "r", encoding="utf-8") as f:
                        config = json.load(f)
                        config.pop("last_run", None)
                        all_configs["monitors"][task_name] = config
                except (json.JSONDecodeError, OSError):
                    pass

        # 导出设置 (新增)
        all_configs["settings"] = {
            "global": self.get_global_settings(),
            "ai": self.get_ai_config(),
            "telegram": self.get_telegram_config(),
        }

        return json.dumps(all_configs, ensure_ascii=False, indent=2)

    def import_all_configs(
        self, json_str: str, overwrite: bool = False
    ) -> Dict[str, Any]:
        """
        导入所有配置
        """
        result = {
            "signs_imported": 0,
            "signs_skipped": 0,
            "monitors_imported": 0,
            "monitors_skipped": 0,
            "settings_imported": 0,
            "errors": [],
        }

        try:
            data = json.loads(json_str)
            if self._is_versioned_payload(data, "config_bundle"):
                payload = data
            else:
                payload = data

            # 导入签到任务
            for key, config in payload.get("signs", {}).items():
                task_name = config.get("name")
                if not task_name:
                    task_name = key.split("@")[0]

                if not overwrite:
                    account_name = config.get("account_name")
                    if self.sign_task_store.get_task(task_name, account_name=account_name):
                        result["signs_skipped"] += 1
                        continue

                if self.save_sign_config(task_name, config):
                    result["signs_imported"] += 1
                else:
                    result["errors"].append(f"Failed to import sign task: {task_name}")

            # 导入监控任务
            for task_name, config in payload.get("monitors", {}).items():
                task_dir = self.monitors_dir / task_name
                config_file = task_dir / "config.json"

                if not overwrite and config_file.exists():
                    result["monitors_skipped"] += 1
                    continue

                task_dir.mkdir(parents=True, exist_ok=True)
                try:
                    with open(config_file, "w", encoding="utf-8") as f:
                        json.dump(config, f, ensure_ascii=False, indent=2)
                    result["monitors_imported"] += 1
                except OSError:
                    result["errors"].append(
                        f"Failed to import monitor task: {task_name}"
                    )

            # 导入设置 (新增)
            settings_data = payload.get("settings", {})

            # 导入全局设置
            if "global" in settings_data:
                try:
                    self.save_global_settings(settings_data["global"])
                    result["settings_imported"] += 1
                except Exception as e:
                    result["errors"].append(f"Failed to import global settings: {e}")

            # 导入 AI 配置
            if "ai" in settings_data and settings_data["ai"]:
                try:
                    ai_conf = settings_data["ai"]
                    # 注意:如果 masking 处理过 api_key (e.g. ****),这里需要处理吗?
                    # 当前 export_ai_config 直接读取文件,应该包含完整 key(文件里是明文)。前端展示才 mask。
                    # 所以这里导出的是完整 key,可以直接导入。
                    if ai_conf.get("api_key"):
                        self.save_ai_config(ai_conf["api_key"], ai_conf.get("base_url"), ai_conf.get("model"))
                        result["settings_imported"] += 1
                except Exception as e:
                    result["errors"].append(f"Failed to import AI config: {e}")

            # 导入 Telegram 配置
            if "telegram" in settings_data:
                try:
                    tg_conf = settings_data["telegram"]
                    if tg_conf.get("is_custom") and tg_conf.get("api_id") and tg_conf.get("api_hash"):
                         self.save_telegram_config(str(tg_conf["api_id"]), tg_conf["api_hash"])
                         result["settings_imported"] += 1
                except Exception as e:
                    result["errors"].append(f"Failed to import Telegram config: {e}")

            # 关键修复:清除 SignTaskService 缓存,否则前端刷新也看不到新任务
            try:
                from backend.services.sign_tasks import get_sign_task_service
                get_sign_task_service().invalidate_cache()

                # 可选:触发调度同步?
                # 如果导入了新任务,调度器并不知道。
                # 只有刷新任务 store 缓存后,下次调用 list_tasks 才会读文件,但调度器是内存常驻的。
                # 我们应该调用 sync_jobs!

                # 由于 sync_jobs 是 async 的,而这里是同步方法,可能不太好直接调。
                # 但 FastAPI 路由是 async 的,我们可以在路由层调用 sync_jobs。
                # 这里的职责主要是文件操作。清理 cache 是必须的。
                pass
            except Exception as e:
                logger.warning("Failed to clear sign task cache after import: %s", e)

        except (json.JSONDecodeError, KeyError) as e:
            result["errors"].append(f"Invalid JSON format: {str(e)}")

        return result

    def preview_all_configs(
        self, json_str: str, overwrite: bool = False
    ) -> Dict[str, Any]:
        data = json.loads(json_str)
        payload = data if isinstance(data, dict) else {}
        metadata = {
            "schema_version": payload.get("schema_version"),
            "payload_type": payload.get("payload_type"),
            "source": payload.get("source"),
            "exported_at": payload.get("exported_at"),
        }

        signs = payload.get("signs", {}) if isinstance(payload.get("signs"), dict) else {}
        monitors = (
            payload.get("monitors", {})
            if isinstance(payload.get("monitors"), dict)
            else {}
        )
        settings_data = (
            payload.get("settings", {})
            if isinstance(payload.get("settings"), dict)
            else {}
        )

        sign_conflicts: list[str] = []
        sign_samples: list[str] = []
        for key, config in signs.items():
            if not isinstance(config, dict):
                continue
            task_name = str(config.get("name") or key.split("@")[0])
            account_name = config.get("account_name")
            if account_name is None and "@" in key:
                account_name = key.split("@", 1)[1]
            display_name = (
                f"{task_name}@{account_name}" if account_name else task_name
            )
            if len(sign_samples) < 5:
                sign_samples.append(display_name)
            if self.sign_task_store.get_task(task_name, account_name=account_name):
                sign_conflicts.append(display_name)

        monitor_conflicts: list[str] = []
        monitor_samples: list[str] = []
        for task_name in monitors.keys():
            display_name = str(task_name)
            if len(monitor_samples) < 5:
                monitor_samples.append(display_name)
            if (self.monitors_dir / display_name / "config.json").exists():
                monitor_conflicts.append(display_name)

        settings_sections = [key for key, value in settings_data.items() if value]

        return {
            "valid": True,
            "metadata": metadata,
            "overwrite": overwrite,
            "sign_tasks": {
                "total": len(signs),
                "conflicts": len(sign_conflicts),
                "importable": len(signs) if overwrite else max(len(signs) - len(sign_conflicts), 0),
                "sample_names": sign_samples,
                "conflict_names": sign_conflicts[:10],
            },
            "monitor_tasks": {
                "total": len(monitors),
                "conflicts": len(monitor_conflicts),
                "importable": len(monitors) if overwrite else max(len(monitors) - len(monitor_conflicts), 0),
                "sample_names": monitor_samples,
                "conflict_names": monitor_conflicts[:10],
            },
            "settings": {
                "sections": settings_sections,
                "count": len(settings_sections),
            },
            "warnings": [],
        }

    # ============ AI 配置 ============

    def _get_ai_config_file(self) -> Path:
        """获取 AI 配置文件路径"""
        return self.workdir / ".openai_config.json"

    def get_ai_config(self) -> Optional[Dict]:
        """
        获取 AI 配置

        Returns:
            配置字典,如果不存在则返回 None
        """
        config_file = self._get_ai_config_file()

        if not config_file.exists():
            return None

        try:
            with open(config_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return None

    def save_ai_config(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
    ) -> bool:
        """
        保存 AI 配置

        Args:
            api_key: OpenAI API Key
            base_url: API Base URL(可选)
            model: 模型名称(可选)

        Returns:
            是否成功保存
        """
        existing = self.get_ai_config() or {}
        normalized_api_key = (api_key or "").strip()
        final_api_key = normalized_api_key or existing.get("api_key", "")
        if not final_api_key:
            raise ValueError("API Key 不能为空")

        config = {"api_key": final_api_key}
        config["base_url"] = base_url if base_url else None
        config["model"] = model if model else None

        config_file = self._get_ai_config_file()

        try:
            with open(config_file, "w", encoding="utf-8") as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
            return True
        except OSError:
            return False

    def delete_ai_config(self) -> bool:
        """
        删除 AI 配置

        Returns:
            是否成功删除
        """
        config_file = self._get_ai_config_file()

        if not config_file.exists():
            return True

        try:
            config_file.unlink()
            return True
        except OSError:
            return False

    async def test_ai_connection(self) -> Dict:
        """
        测试 AI 连接

        Returns:
            测试结果
        """
        config = self.get_ai_config()

        if not config:
            return {"success": False, "message": "未配置 AI API Key"}

        api_key = config.get("api_key")
        base_url = config.get("base_url")
        model = config.get("model", "gpt-4o")

        if not api_key:
            return {"success": False, "message": "API Key 为空"}

        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=api_key, base_url=base_url)

            # 发送一个简单的测试请求
            response = await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": "Say 'test ok' in 2 words"}],
                max_tokens=10,
            )

            return {
                "success": True,
                "message": f"连接成功！模型响应: {response.choices[0].message.content}",
                "model_used": model,
            }

        except ImportError:
            return {
                "success": False,
                "message": "未安装 openai 库,请运行: pip install openai",
            }
        except Exception as e:
            return {"success": False, "message": f"连接失败: {str(e)}"}

    # ============ 全局设置 ============

    def _get_global_settings_file(self) -> Path:
        """获取全局设置文件路径"""
        return self.workdir / ".global_settings.json"

    def get_global_settings(self) -> Dict:
        """
        获取全局设置

        Returns:
            设置字典
        """
        config_file = self._get_global_settings_file()

        override_data_dir = load_data_dir_override()
        default_settings = {
            "sign_interval": None,  # None 表示使用随机 1-120 秒
            "log_retention_days": 7,
            "data_dir": str(override_data_dir) if override_data_dir else None,
        }

        if not config_file.exists():
            return default_settings

        try:
            with open(config_file, "r", encoding="utf-8") as f:
                settings = json.load(f)
                if not isinstance(settings, dict):
                    return default_settings
                # 合并默认设置
                for key, value in default_settings.items():
                    if key not in settings:
                        settings[key] = value
                return settings
        except (json.JSONDecodeError, OSError):
            return default_settings

    def save_global_settings(self, settings: Dict) -> bool:
        """
        保存全局设置

        Args:
            settings: 设置字典

        Returns:
            是否成功保存
        """
        config_file = self._get_global_settings_file()
        merged = dict(self.get_global_settings())
        merged.update(settings)

        data_dir_value = merged.get("data_dir")
        if isinstance(data_dir_value, str):
            data_dir_value = data_dir_value.strip()
        if data_dir_value:
            resolved = Path(str(data_dir_value)).expanduser()
            resolved.mkdir(parents=True, exist_ok=True)
            if not is_writable_dir(resolved):
                raise ValueError(f"数据路径不可写: {resolved}")
            save_data_dir_override(resolved)
            merged["data_dir"] = str(resolved)
        elif data_dir_value is None or data_dir_value == "":
            clear_data_dir_override()
            merged["data_dir"] = None

        try:
            with open(config_file, "w", encoding="utf-8") as f:
                json.dump(merged, f, ensure_ascii=False, indent=2)
            return True
        except OSError:
            return False

    # ============ Telegram API 配置 ============

    # 默认的 Telegram API 凭证
    DEFAULT_TG_API_ID = "611335"
    DEFAULT_TG_API_HASH = "d524b414d21f4d37f08684c1df41ac9c"

    def _get_telegram_config_file(self) -> Path:
        """获取 Telegram API 配置文件路径"""
        return self.workdir / ".telegram_api.json"

    def get_telegram_config(self) -> Dict:
        """
        获取 Telegram API 配置

        Returns:
            配置字典,包含 api_id, api_hash, is_custom (是否为自定义配置)
        """
        config_file = self._get_telegram_config_file()

        # 默认配置
        default_config = {
            "api_id": self.DEFAULT_TG_API_ID,
            "api_hash": self.DEFAULT_TG_API_HASH,
            "is_custom": False,
        }

        if not config_file.exists():
            return default_config

        try:
            with open(config_file, "r", encoding="utf-8") as f:
                config = json.load(f)
                # 如果有自定义配置,标记为自定义
                if config.get("api_id") and config.get("api_hash"):
                    config["is_custom"] = True
                    return config
                else:
                    return default_config
        except (json.JSONDecodeError, OSError):
            return default_config

    def save_telegram_config(self, api_id: str, api_hash: str) -> bool:
        """
        保存 Telegram API 配置

        Args:
            api_id: Telegram API ID
            api_hash: Telegram API Hash

        Returns:
            是否成功保存
        """
        config = {
            "api_id": api_id,
            "api_hash": api_hash,
        }

        config_file = self._get_telegram_config_file()

        try:
            with open(config_file, "w", encoding="utf-8") as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
            return True
        except OSError:
            return False

    def reset_telegram_config(self) -> bool:
        """
        重置 Telegram API 配置(恢复默认)

        Returns:
            是否成功重置
        """
        config_file = self._get_telegram_config_file()

        if not config_file.exists():
            return True

        try:
            config_file.unlink()
            return True
        except OSError:
            return False


    def export_sessions_zip(self) -> bytes:
        """
        将所有会话文件打包成 ZIP 压缩包字节流
        """
        session_dir = settings.resolve_session_dir()
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(
                "manifest.json",
                json.dumps(
                    self._export_metadata("session_bundle"),
                    ensure_ascii=False,
                    indent=2,
                ),
            )
            if session_dir.exists():
                for file in session_dir.glob("*"):
                    if file.is_file():
                        zf.write(file, file.name)
        return buf.getvalue()

    def preview_sessions_zip(self, zip_bytes: bytes) -> Dict[str, Any]:
        warnings: list[str] = []
        files: list[str] = []
        manifest: dict[str, Any] = {}

        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            for member in zf.infolist():
                if member.is_dir():
                    continue
                name = member.filename.replace("\\", "/")
                if name == "manifest.json":
                    try:
                        with zf.open(member) as fh:
                            loaded = json.loads(fh.read().decode("utf-8"))
                            if isinstance(loaded, dict):
                                manifest = loaded
                    except Exception:
                        warnings.append("manifest_unreadable")
                    continue
                if "/" in name:
                    warnings.append(f"nested_entry:{name}")
                files.append(name)

        account_names = sorted(
            {
                Path(name).stem.replace(".session", "")
                if name.endswith(".session_string")
                else Path(name).stem
                for name in files
            }
        )

        return {
            "valid": True,
            "metadata": {
                "schema_version": manifest.get("schema_version"),
                "payload_type": manifest.get("payload_type"),
                "source": manifest.get("source"),
                "exported_at": manifest.get("exported_at"),
            },
            "file_count": len(files),
            "file_names": files[:20],
            "account_names": account_names[:20],
            "warnings": warnings,
        }

    def import_sessions_zip(self, zip_bytes: bytes) -> bool:
        """
        从 ZIP 字节流导入并还原会话文件
        """
        session_dir = settings.resolve_session_dir()
        session_dir.mkdir(parents=True, exist_ok=True)
        try:
            # 清空旧会话
            for file in session_dir.glob("*"):
                if file.is_file():
                    file.unlink()
            with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
                for member in zf.infolist():
                    if member.filename == "manifest.json":
                        continue
                    zf.extract(member, session_dir)
            return True
        except Exception as e:
            logger.warning("Error importing sessions zip: %s", e)
            return False

_config_service: Optional[ConfigService] = None

def get_config_service() -> ConfigService:
    global _config_service
    if _config_service is None:
        _config_service = ConfigService()
    return _config_service
