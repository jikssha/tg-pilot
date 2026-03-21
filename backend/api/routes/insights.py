from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel

from backend.core.auth import get_current_user
from backend.models.user import User
from backend.services.audit import get_audit_service
from backend.services.operations import get_operations_service

router = APIRouter()


class AuditEventOut(BaseModel):
    id: int
    action: str
    resource_type: str
    resource_id: str | None = None
    actor: str | None = None
    status: str
    details: dict[str, Any] | None = None
    created_at: str


class AuditEventListResponse(BaseModel):
    items: list[AuditEventOut]
    total: int
    limit: int
    offset: int


class DailyRunItemOut(BaseModel):
    id: int
    task_name: str
    account_name: str
    planned_run_at: str
    status: str
    attempt_count: int
    max_attempts: int
    next_retry_at: str | None = None
    deadline_at: str | None = None
    last_started_at: str | None = None
    last_finished_at: str | None = None
    last_error_code: str | None = None
    last_error_message: str | None = None


class DailyRunsSummaryResponse(BaseModel):
    run_date: str
    total: int
    pending: int
    running: int
    retry_wait: int
    success: int
    failed: int
    blocked: int
    expired: int
    latest_planned_at: str | None = None
    latest_finished_at: str | None = None
    recent_runs: list[DailyRunItemOut]


class OperationsOverviewResponse(BaseModel):

    readiness: dict[str, Any]
    scheduler: dict[str, Any]
    accounts: dict[str, Any]
    sign_tasks: dict[str, Any]
    daily_runs: DailyRunsSummaryResponse
    recent_audit: list[AuditEventOut]
    latest_audit_at: str | None = None


@router.get("/audit/events", response_model=AuditEventListResponse)
def list_audit_events(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    action: str | None = Query(None),
    resource_type: str | None = Query(None),
    status: str | None = Query(None),
    current_user: User = Depends(get_current_user),
):
    del current_user
    result = get_audit_service().list_events(
        limit=limit,
        offset=offset,
        action=action,
        resource_type=resource_type,
        status=status,
    )
    return AuditEventListResponse(**result)


@router.get("/ops/overview", response_model=OperationsOverviewResponse)
def get_operations_overview(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    del current_user
    checks = dict(getattr(request.app.state, "readiness_checks", {}) or {})
    details = dict(getattr(request.app.state, "readiness_details", {}) or {})
    ready = bool(getattr(request.app.state, "ready", False))
    result = get_operations_service().get_overview(
        ready=ready,
        readiness_checks=checks,
        readiness_details=details,
    )
    return OperationsOverviewResponse(**result)
