from __future__ import annotations

import asyncio
import logging
import sqlite3
from pathlib import Path

from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# Monkeypatch sqlite3.connect to increase default timeout
_original_sqlite3_connect = sqlite3.connect


def _patched_sqlite3_connect(*args, **kwargs):
    # Force timeout to be at least 10 seconds, even if Pyrogram sets it to 1
    if "timeout" in kwargs:
        if kwargs["timeout"] < 10:
            kwargs["timeout"] = 10
    else:
        kwargs["timeout"] = 30
    return _original_sqlite3_connect(*args, **kwargs)


sqlite3.connect = _patched_sqlite3_connect

from backend.api import router as api_router  # noqa: E402
from backend.core.config import get_settings  # noqa: E402
from backend.core.database import (  # noqa: E402
    check_database_connection,
    get_session_local,
    init_engine,
)
from backend.core.migrations import run_migrations  # noqa: E402
from backend.scheduler import (  # noqa: E402
    init_scheduler,
    shutdown_scheduler,
    sync_jobs,
)
from backend.services.daily_dispatcher import get_daily_dispatcher_service  # noqa: E402
from backend.services.legacy_migration import get_legacy_migration_service  # noqa: E402
from backend.services.users import ensure_admin  # noqa: E402
from backend.utils.paths import ensure_data_dirs  # noqa: E402
from backend.utils.storage import is_writable_dir  # noqa: E402
from tg_signer import __version__ as APP_VERSION  # noqa: E402


# Silence /health check logs
class HealthCheckFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        return (
            "/health" not in msg
            and "/healthz" not in msg
            and "/readyz" not in msg
        )


logging.getLogger("uvicorn.access").addFilter(HealthCheckFilter())

settings = get_settings()

app = FastAPI(title=settings.app_name, version=APP_VERSION)
app.state.ready = False
app.state.readiness_checks = {
    "storage": False,
    "database": False,
    "scheduler": False,
    "jobs_synced": False,
}
app.state.readiness_details = {}

app.add_middleware(GZipMiddleware, minimum_size=1000)



app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 路由必须在静态文件挂载之前注册,并使用 /api 前缀
app.include_router(api_router, prefix="/api")


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "version": APP_VERSION}


@app.get("/healthz")
def health_checkz() -> dict[str, str]:
    return {"status": "ok", "version": APP_VERSION}


@app.get("/readyz")
def ready_check(response: Response) -> dict[str, str]:
    payload = {
        "status": "ready" if app.state.ready else "starting",
        "checks": app.state.readiness_checks,
    }
    if app.state.readiness_details:
        payload["details"] = app.state.readiness_details
    if app.state.ready:
        return payload
    response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return payload


def _bootstrap_legacy_metadata(startup_logger: logging.Logger) -> None:
    try:
        result = get_legacy_migration_service().migrate_all(
            dry_run=False,
            overwrite=False,
        )
    except Exception as exc:
        startup_logger.exception(
            "Legacy metadata bootstrap failed, continuing startup with existing data: %s",
            exc,
        )
        return

    account_result = result.get("accounts", {})
    sign_task_result = result.get("sign_tasks", {})
    sign_task_errors = sign_task_result.get("errors", [])

    startup_logger.info(
        "Legacy metadata bootstrap finished: accounts=%s sign_tasks_imported=%s sign_tasks_skipped=%s",
        account_result.get("migrated_count", 0),
        sign_task_result.get("imported", 0),
        sign_task_result.get("skipped", 0),
    )
    if sign_task_errors:
        startup_logger.warning(
            "Legacy sign task bootstrap reported %s errors: %s",
            len(sign_task_errors),
            sign_task_errors[:3],
        )


# 静态前端托管逻辑优化
web_dir = Path("/web")

# 1. 优先挂载 _next 静态目录(Next.js 核心资源)
if (web_dir / "_next").exists():
    app.mount("/_next", StaticFiles(directory=str(web_dir / "_next"), html=False), name="next_assets")

# 2. 挂载其他顶级静态文件夹(如果存在)
for folder in ["static", "images", "assets"]:
    if (web_dir / folder).exists():
        app.mount(f"/{folder}", StaticFiles(directory=str(web_dir / folder)), name=f"static_{folder}")

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """
    强化版 SPA 逻辑:
    1. 优先检查精确文件路径
    2. 尝试 .html 映射
    3. 最后回退到 index.html
    """
    # 忽略 API 和 健康检查
    if full_path.startswith("api/") or full_path in ["health", "healthz", "readyz"]:
        return {"detail": "Not Found"}

    # 构造完整路径
    file_path = web_dir / full_path

    # 如果是文件且存在,直接返回
    if file_path.exists() and file_path.is_file():
        # 为静态资源添加缓存控制 (max-age 1年,因为 _next 资源带哈希)
        headers = {}
        if "/_next/static/" in str(file_path):
            headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return FileResponse(file_path, headers=headers)

    # 尝试 .html 映射(Next.js 静态路由习惯)
    html_path = web_dir / f"{full_path}.html"
    if html_path.exists() and html_path.is_file():
        return FileResponse(html_path)

    # 顶级 index.html 回退
    index_path = web_dir / "index.html"
    if index_path.exists():
        return FileResponse(index_path)

    return Response(content="Frontend missing", status_code=404)


@app.on_event("startup")
async def on_startup() -> None:
    startup_logger = logging.getLogger("backend.startup")

    def set_readiness(name: str, ok: bool, detail: str = "") -> None:
        checks = dict(app.state.readiness_checks)
        details = dict(app.state.readiness_details)
        checks[name] = ok
        if detail:
            details[name] = detail
        else:
            details.pop(name, None)
        app.state.readiness_checks = checks
        app.state.readiness_details = details

    def verify_storage() -> None:
        paths_to_check = {
            settings.resolve_base_dir(),
            settings.resolve_workdir(),
            settings.resolve_session_dir(),
            settings.resolve_logs_dir(),
            settings.resolve_db_path().parent,
        }
        for path in paths_to_check:
            if not is_writable_dir(path):
                raise RuntimeError(f"Path is not writable: {path}")

    ensure_data_dirs(settings)
    verify_storage()
    set_readiness("storage", True)

    run_migrations()
    init_engine()
    check_database_connection()
    set_readiness("database", True)

    with get_session_local()() as db:
        ensure_admin(db)
    _bootstrap_legacy_metadata(startup_logger)
    await init_scheduler(sync_on_startup=False)
    set_readiness("scheduler", True)

    async def _post_startup() -> None:
        try:
            recovered = get_daily_dispatcher_service().recover_today_runs()
            if recovered:
                startup_logger.warning(
                    "Recovered %s interrupted daily run(s) on startup",
                    recovered,
                )
            await sync_jobs()
            set_readiness("jobs_synced", True)
        except Exception as exc:
            set_readiness("jobs_synced", False, str(exc))
            startup_logger.exception(
                "Delayed scheduler sync failed: %s",
                exc,
            )
        finally:
            app.state.ready = all(app.state.readiness_checks.values())

    asyncio.create_task(_post_startup())


@app.on_event("shutdown")
def on_shutdown() -> None:
    shutdown_scheduler()
