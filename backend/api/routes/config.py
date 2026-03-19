"""Configuration API routes."""

from __future__ import annotations

import io
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.core.auth import get_current_user
from backend.models.user import User
from backend.services.audit import get_audit_service
from backend.services.config import get_config_service

router = APIRouter()


def _clear_sign_task_cache() -> None:
    try:
        from backend.services.sign_tasks import get_sign_task_service

        get_sign_task_service().invalidate_cache()
    except Exception:
        # Best-effort cache invalidation; import should still succeed.
        pass


class ExportTaskResponse(BaseModel):
    task_name: str
    task_type: str
    config_json: str


class ImportTaskRequest(BaseModel):
    config_json: str
    task_name: Optional[str] = None
    account_name: Optional[str] = None


class ImportTaskResponse(BaseModel):
    success: bool
    task_name: str
    message: str


class ImportAllRequest(BaseModel):
    config_json: str
    overwrite: bool = False


class ImportAllResponse(BaseModel):
    signs_imported: int
    signs_skipped: int
    monitors_imported: int
    monitors_skipped: int
    errors: list[str]
    message: str


class TaskListResponse(BaseModel):
    sign_tasks: list[str]
    monitor_tasks: list[str]
    total: int


@router.get("/tasks", response_model=TaskListResponse)
def list_all_tasks(current_user: User = Depends(get_current_user)):
    try:
        sign_tasks = get_config_service().list_sign_tasks()
        monitor_tasks = get_config_service().list_monitor_tasks()
        return TaskListResponse(
            sign_tasks=sign_tasks,
            monitor_tasks=monitor_tasks,
            total=len(sign_tasks) + len(monitor_tasks),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list tasks: {str(e)}",
        )


@router.get("/export/sign/{task_name}")
def export_sign_task(
    task_name: str,
    account_name: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    try:
        config_json = get_config_service().export_sign_task(
            task_name, account_name=account_name
        )
        if config_json is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task {task_name} not found",
            )

        get_audit_service().record_action(
            action="export_sign_task",
            resource_type="sign_task",
            resource_id=task_name,
            actor=current_user.username,
            details={"task_name": task_name, "account_name": account_name},
        )

        return Response(
            content=config_json.encode("utf-8"),
            media_type="application/json; charset=utf-8",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export task: {str(e)}",
        )


@router.post("/import/sign", response_model=ImportTaskResponse)
def import_sign_task(
    request: ImportTaskRequest, current_user: User = Depends(get_current_user)
):
    try:
        success = get_config_service().import_sign_task(
            request.config_json,
            task_name=request.task_name,
            account_name=request.account_name,
        )
        if not success:
            return ImportTaskResponse(
                success=False,
                task_name=request.task_name or "unknown",
                message="Import failed. Invalid configuration format.",
            )

        import asyncio

        from backend.scheduler import sync_jobs

        _clear_sign_task_cache()
        try:
            # Check if event loop is running
            asyncio.get_running_loop()
            asyncio.create_task(sync_jobs())
        except RuntimeError:
            # Fallback for no running loop
            pass

        get_audit_service().record_action(
            action="import_sign_task",
            resource_type="sign_task",
            resource_id=request.task_name or "imported",
            actor=current_user.username,
            details={
                "task_name": request.task_name,
                "account_name": request.account_name,
            },
        )

        return ImportTaskResponse(
            success=True,
            task_name=request.task_name or "imported",
            message="Task imported successfully",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import task: {str(e)}",
        )


@router.get("/sessions/export")
async def export_sessions_zip(current_user: User = Depends(get_current_user)):
    """
    导出所有账号会话为 ZIP 压缩包
    """
    try:
        service = get_config_service()
        zip_data = service.export_sessions_zip()

        get_audit_service().record_action(
            action="export_sessions_zip",
            resource_type="session_bundle",
            resource_id="all",
            actor=current_user.username,
        )

        return StreamingResponse(
            io.BytesIO(zip_data),
            media_type="application/zip",
            headers={
                "Content-Disposition": 'attachment; filename="tg_pilot_sessions.zip"'
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export sessions: {str(e)}"
        )


@router.post("/sessions/import")
async def import_sessions_zip(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    通过上传 ZIP 还原会话状态
    """
    try:
        content = await file.read()
        service = get_config_service()
        success = service.import_sessions_zip(content)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to import sessions. Invalid zip file or data error."
            )

        get_audit_service().record_action(
            action="import_sessions_zip",
            resource_type="session_bundle",
            resource_id=file.filename or "upload",
            actor=current_user.username,
            details={"filename": file.filename},
        )

        return {"success": True, "message": "Sessions imported successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import sessions: {str(e)}"
        )


@router.get("/export/all")
def export_all_configs(current_user: User = Depends(get_current_user)):
    try:
        config_json = get_config_service().export_all_configs()
        get_audit_service().record_action(
            action="export_all_configs",
            resource_type="config_bundle",
            resource_id="all",
            actor=current_user.username,
        )
        return Response(
            content=config_json.encode("utf-8"),
            media_type="application/json; charset=utf-8",
            headers={
                "Content-Disposition": 'attachment; filename="tg_signer_all_configs.json"'
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export all configs: {str(e)}",
        )


@router.post("/import/all", response_model=ImportAllResponse)
async def import_all_configs(
    request: ImportAllRequest, current_user: User = Depends(get_current_user)
):
    try:
        result = get_config_service().import_all_configs(
            request.config_json, request.overwrite
        )

        message_parts = []
        if result.get("signs_imported", 0) > 0:
            message_parts.append(f"sign tasks imported: {result['signs_imported']}")
        if result.get("signs_skipped", 0) > 0:
            message_parts.append(f"sign tasks skipped: {result['signs_skipped']}")
        if result.get("monitors_imported", 0) > 0:
            message_parts.append(
                f"monitor tasks imported: {result['monitors_imported']}"
            )
        if result.get("monitors_skipped", 0) > 0:
            message_parts.append(f"monitor tasks skipped: {result['monitors_skipped']}")
        if result.get("settings_imported", 0) > 0:
            message_parts.append(f"settings imported: {result['settings_imported']}")

        message = "; ".join(message_parts) if message_parts else "No config imported"

        from backend.scheduler import sync_jobs

        _clear_sign_task_cache()
        await sync_jobs()

        get_audit_service().record_action(
            action="import_all_configs",
            resource_type="config_bundle",
            resource_id="all",
            actor=current_user.username,
            details={
                "overwrite": request.overwrite,
                "signs_imported": int(result.get("signs_imported", 0)),
                "monitors_imported": int(result.get("monitors_imported", 0)),
            },
        )

        return ImportAllResponse(
            signs_imported=int(result.get("signs_imported", 0)),
            signs_skipped=int(result.get("signs_skipped", 0)),
            monitors_imported=int(result.get("monitors_imported", 0)),
            monitors_skipped=int(result.get("monitors_skipped", 0)),
            errors=[str(item) for item in result.get("errors", [])],
            message=message,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import all configs: {str(e)}",
        )


@router.delete("/sign/{task_name}")
async def delete_sign_task(
    task_name: str,
    account_name: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    try:
        success = get_config_service().delete_sign_config(
            task_name, account_name=account_name
        )
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task {task_name} not found",
            )

        from backend.scheduler import sync_jobs

        _clear_sign_task_cache()
        await sync_jobs()

        get_audit_service().record_action(
            action="delete_sign_config",
            resource_type="sign_task",
            resource_id=task_name,
            actor=current_user.username,
            details={"task_name": task_name, "account_name": account_name},
        )

        return {"success": True, "message": f"Task {task_name} deleted"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete task: {str(e)}",
        )


class AIConfigRequest(BaseModel):
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None


class AIConfigResponse(BaseModel):
    has_config: bool
    base_url: Optional[str] = None
    model: Optional[str] = None
    api_key_masked: Optional[str] = None


class AIConfigSaveResponse(BaseModel):
    success: bool
    message: str


class AITestResponse(BaseModel):
    success: bool
    message: str
    model_used: Optional[str] = None


@router.get("/ai", response_model=AIConfigResponse)
def get_ai_config(current_user: User = Depends(get_current_user)):
    try:
        config = get_config_service().get_ai_config()
        if not config:
            return AIConfigResponse(has_config=False)

        api_key = config.get("api_key", "")
        if api_key:
            masked = (
                api_key[:4] + "*" * (len(api_key) - 8) + api_key[-4:]
                if len(api_key) > 8
                else "****"
            )
        else:
            masked = None

        return AIConfigResponse(
            has_config=True,
            base_url=config.get("base_url"),
            model=config.get("model"),
            api_key_masked=masked,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read AI config: {str(e)}",
        )


@router.post("/ai", response_model=AIConfigSaveResponse)
def save_ai_config(
    request: AIConfigRequest, current_user: User = Depends(get_current_user)
):
    try:
        get_config_service().save_ai_config(
            api_key=request.api_key,
            base_url=request.base_url,
            model=request.model,
        )
        return AIConfigSaveResponse(success=True, message="AI config saved")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save AI config: {str(e)}",
        )


@router.post("/ai/test", response_model=AITestResponse)
async def test_ai_connection(current_user: User = Depends(get_current_user)):
    try:
        result = await get_config_service().test_ai_connection()
        return AITestResponse(**result)
    except Exception as e:
        return AITestResponse(success=False, message=f"AI test failed: {str(e)}")


@router.delete("/ai", response_model=AIConfigSaveResponse)
def delete_ai_config(current_user: User = Depends(get_current_user)):
    try:
        get_config_service().delete_ai_config()
        return AIConfigSaveResponse(success=True, message="AI config deleted")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete AI config: {str(e)}",
        )


class GlobalSettingsRequest(BaseModel):
    sign_interval: Optional[int] = None
    log_retention_days: int = 7
    data_dir: Optional[str] = None


class GlobalSettingsResponse(BaseModel):
    sign_interval: Optional[int] = None
    log_retention_days: int = 7
    data_dir: Optional[str] = None
    server_time: Optional[str] = None


@router.get("/settings", response_model=GlobalSettingsResponse)
def get_global_settings(current_user: User = Depends(get_current_user)):
    try:
        from datetime import datetime
        settings = get_config_service().get_global_settings()
        # Add current server time for frontend display
        settings = dict(settings)
        settings["server_time"] = datetime.now().strftime("%H:%M")
        return GlobalSettingsResponse(**settings)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read global settings: {str(e)}",
        )


@router.post("/settings", response_model=AIConfigSaveResponse)
def save_global_settings(
    request: GlobalSettingsRequest, current_user: User = Depends(get_current_user)
):
    try:
        settings = {
            "sign_interval": request.sign_interval,
            "log_retention_days": request.log_retention_days,
        }
        fields_set = getattr(request, "model_fields_set", getattr(request, "__fields_set__", set()))
        if "data_dir" in fields_set:
            settings["data_dir"] = request.data_dir

        get_config_service().save_global_settings(settings)
        return AIConfigSaveResponse(success=True, message="Global settings saved")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save global settings: {str(e)}",
        )


class TelegramConfigRequest(BaseModel):
    api_id: str
    api_hash: str


class TelegramConfigResponse(BaseModel):
    api_id: str
    api_hash: str
    is_custom: bool
    default_api_id: str
    default_api_hash: str


class TelegramConfigSaveResponse(BaseModel):
    success: bool
    message: str


@router.get("/telegram", response_model=TelegramConfigResponse)
def get_telegram_config(current_user: User = Depends(get_current_user)):
    try:
        config = get_config_service().get_telegram_config()
        service = get_config_service()
        return TelegramConfigResponse(
            api_id=config.get("api_id", ""),
            api_hash=config.get("api_hash", ""),
            is_custom=bool(config.get("is_custom", False)),
            default_api_id=service.DEFAULT_TG_API_ID,
            default_api_hash=service.DEFAULT_TG_API_HASH,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read Telegram config: {str(e)}",
        )


@router.post("/telegram", response_model=TelegramConfigSaveResponse)
def save_telegram_config(
    request: TelegramConfigRequest, current_user: User = Depends(get_current_user)
):
    try:
        if not request.api_id or not request.api_hash:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="api_id and api_hash are required",
            )

        success = get_config_service().save_telegram_config(
            api_id=request.api_id,
            api_hash=request.api_hash,
        )
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save Telegram config",
            )
        return TelegramConfigSaveResponse(success=True, message="Telegram config saved")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save Telegram config: {str(e)}",
        )


@router.delete("/telegram", response_model=TelegramConfigSaveResponse)
def reset_telegram_config(current_user: User = Depends(get_current_user)):
    try:
        get_config_service().reset_telegram_config()
        get_audit_service().record_action(
            action="reset_telegram_config",
            resource_type="telegram_config",
            resource_id="default",
            actor=current_user.username,
        )
        return TelegramConfigSaveResponse(success=True, message="Telegram config reset")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset Telegram config: {str(e)}",
        )


# ============ Bot 通知配置 ============


class BotNotifyConfigRequest(BaseModel):
    """Bot 通知配置请求"""

    bot_token: Optional[str] = None
    chat_id: Optional[str] = None
    enabled: bool = True
    notify_on_success: bool = True
    notify_on_failure: bool = True
    daily_summary: bool = True
    daily_summary_hour: int = 22
    daily_summary_minute: int = 0


class BotNotifyConfigResponse(BaseModel):
    """Bot 通知配置响应"""

    has_config: bool
    enabled: bool = False
    chat_id: Optional[str] = None
    bot_token_masked: Optional[str] = None
    notify_on_success: bool = True
    notify_on_failure: bool = True
    daily_summary: bool = True
    daily_summary_hour: int = 22
    daily_summary_minute: int = 0


class BotNotifyTestResponse(BaseModel):
    """Bot 通知测试响应"""

    success: bool
    message: str


@router.get("/bot-notify", response_model=BotNotifyConfigResponse)
def get_bot_notify_config(current_user: User = Depends(get_current_user)):
    """获取 Bot 通知配置"""
    try:
        from backend.services.bot_notify import get_bot_notify_service

        config = get_bot_notify_service().get_config()
        if not config:
            return BotNotifyConfigResponse(has_config=False)

        bot_token = config.get("bot_token", "")
        if bot_token:
            masked = (
                bot_token[:4] + "*" * (len(bot_token) - 8) + bot_token[-4:]
                if len(bot_token) > 8
                else "****"
            )
        else:
            masked = None

        return BotNotifyConfigResponse(
            has_config=True,
            enabled=config.get("enabled", True),
            chat_id=config.get("chat_id"),
            bot_token_masked=masked,
            notify_on_success=config.get("notify_on_success", True),
            notify_on_failure=config.get("notify_on_failure", True),
            daily_summary=config.get("daily_summary", True),
            daily_summary_hour=config.get("daily_summary_hour", 22),
            daily_summary_minute=config.get("daily_summary_minute", 0),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read bot notify config: {str(e)}",
        )


@router.post("/bot-notify", response_model=AIConfigSaveResponse)
async def save_bot_notify_config(
    request: BotNotifyConfigRequest, current_user: User = Depends(get_current_user)
):
    """保存 Bot 通知配置"""
    try:
        from backend.scheduler import sync_jobs
        from backend.services.bot_notify import get_bot_notify_service

        get_bot_notify_service().save_config(
            bot_token=request.bot_token,
            chat_id=request.chat_id,
            enabled=request.enabled,
            notify_on_success=request.notify_on_success,
            notify_on_failure=request.notify_on_failure,
            daily_summary=request.daily_summary,
            daily_summary_hour=request.daily_summary_hour,
            daily_summary_minute=request.daily_summary_minute,
        )
        await sync_jobs()
        return AIConfigSaveResponse(success=True, message="Bot notify config saved")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save bot notify config: {str(e)}",
        )


@router.delete("/bot-notify", response_model=AIConfigSaveResponse)
async def delete_bot_notify_config(current_user: User = Depends(get_current_user)):
    """删除 Bot 通知配置"""
    try:
        from backend.scheduler import sync_jobs
        from backend.services.bot_notify import get_bot_notify_service

        get_bot_notify_service().delete_config()
        await sync_jobs()
        get_audit_service().record_action(
            action="delete_bot_notify_config",
            resource_type="bot_notify_config",
            resource_id="default",
            actor=current_user.username,
        )
        return AIConfigSaveResponse(success=True, message="Bot notify config deleted")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete bot notify config: {str(e)}",
        )


@router.post("/bot-notify/test", response_model=BotNotifyTestResponse)
async def test_bot_notify(current_user: User = Depends(get_current_user)):
    """发送测试通知"""
    try:
        from backend.services.bot_notify import get_bot_notify_service

        result = await get_bot_notify_service().test_notify()
        return BotNotifyTestResponse(**result)
    except Exception as e:
        return BotNotifyTestResponse(success=False, message=f"Test failed: {str(e)}")

