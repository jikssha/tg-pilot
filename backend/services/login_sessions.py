from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from backend.core.database import get_session_local
from backend.models.login_session_state import LoginSessionState

logger = logging.getLogger("backend.login_sessions")

_ACTIVE_STATUSES = {
    "code_sent",
    "waiting_scan",
    "scanned_wait_confirm",
    "password_required",
    "authorized",
}


class LoginSessionService:
    def __init__(self):
        self._phone_runtime: dict[str, dict[str, Any]] = {}
        self._qr_runtime: dict[str, dict[str, Any]] = {}
        self._mark_active_sessions_stale()

    def _mark_active_sessions_stale(self) -> None:
        db = get_session_local()()
        try:
            db.query(LoginSessionState).filter(
                LoginSessionState.status.in_(tuple(_ACTIVE_STATUSES))
            ).update({"status": "stale"}, synchronize_session=False)
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.warning("Failed to mark transient login sessions stale: %s", exc)
        finally:
            db.close()

    def _upsert_state(
        self,
        *,
        session_id: str,
        flow_type: str,
        account_name: str,
        status: str,
        phone_number: str | None = None,
        expires_at: datetime | None = None,
        payload_updates: dict[str, Any] | None = None,
    ) -> None:
        db = get_session_local()()
        try:
            row = (
                db.query(LoginSessionState)
                .filter(LoginSessionState.session_id == session_id)
                .first()
            )
            payload: dict[str, Any] = {}
            if row and row.payload:
                try:
                    payload = json.loads(row.payload)
                except Exception:
                    payload = {}
            if payload_updates:
                payload.update(payload_updates)

            if row is None:
                row = LoginSessionState(
                    session_id=session_id,
                    flow_type=flow_type,
                    account_name=account_name,
                    phone_number=phone_number,
                    status=status,
                    expires_at=expires_at,
                    payload=json.dumps(payload, ensure_ascii=False, default=str)
                    if payload
                    else None,
                )
                db.add(row)
            else:
                row.flow_type = flow_type
                row.account_name = account_name
                row.phone_number = phone_number
                row.status = status
                row.expires_at = expires_at
                row.payload = (
                    json.dumps(payload, ensure_ascii=False, default=str)
                    if payload
                    else None
                )
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.warning("Failed to persist login state %s: %s", session_id, exc)
        finally:
            db.close()

    def _delete_state(self, session_id: str) -> None:
        db = get_session_local()()
        try:
            db.query(LoginSessionState).filter(
                LoginSessionState.session_id == session_id
            ).delete(synchronize_session=False)
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.warning("Failed to delete login state %s: %s", session_id, exc)
        finally:
            db.close()

    def list_pending_account_names(self) -> set[str]:
        db = get_session_local()()
        try:
            rows = (
                db.query(LoginSessionState.account_name)
                .filter(LoginSessionState.status.in_(tuple(_ACTIVE_STATUSES)))
                .all()
            )
            return {row[0] for row in rows if row and row[0]}
        finally:
            db.close()

    def register_phone_session(
        self,
        session_id: str,
        data: dict[str, Any],
        *,
        expires_at: datetime | None = None,
    ) -> None:
        self._phone_runtime[session_id] = data
        self._upsert_state(
            session_id=session_id,
            flow_type="phone",
            account_name=str(data.get("account_name") or ""),
            phone_number=data.get("phone_number"),
            status="code_sent",
            expires_at=expires_at,
            payload_updates={
                "proxy": data.get("proxy"),
                "phone_code_hash": data.get("phone_code_hash"),
            },
        )

    def get_phone_session(self, session_id: str) -> dict[str, Any] | None:
        return self._phone_runtime.get(session_id)

    def list_phone_sessions_for_account(
        self, account_name: str
    ) -> list[tuple[str, dict[str, Any]]]:
        return [
            (session_id, data)
            for session_id, data in self._phone_runtime.items()
            if data.get("account_name") == account_name
        ]

    def update_phone_state(
        self,
        session_id: str,
        *,
        status: str,
        expires_at: datetime | None = None,
        payload_updates: dict[str, Any] | None = None,
    ) -> None:
        data = self._phone_runtime.get(session_id)
        if data:
            data["status"] = status
        self._upsert_state(
            session_id=session_id,
            flow_type="phone",
            account_name=str((data or {}).get("account_name") or ""),
            phone_number=(data or {}).get("phone_number"),
            status=status,
            expires_at=expires_at,
            payload_updates=payload_updates,
        )

    def remove_phone_session(self, session_id: str) -> dict[str, Any] | None:
        self._delete_state(session_id)
        return self._phone_runtime.pop(session_id, None)

    def register_qr_session(
        self,
        login_id: str,
        data: dict[str, Any],
        *,
        expires_at: datetime | None = None,
    ) -> None:
        self._qr_runtime[login_id] = data
        self._upsert_state(
            session_id=login_id,
            flow_type="qr",
            account_name=str(data.get("account_name") or ""),
            status=str(data.get("status") or "waiting_scan"),
            expires_at=expires_at,
            payload_updates={
                "proxy": data.get("proxy"),
                "scan_seen": bool(data.get("scan_seen")),
                "authorized": bool(data.get("authorized")),
                "api_id": data.get("api_id"),
                "api_hash": data.get("api_hash"),
                "migrate_dc_id": data.get("migrate_dc_id"),
                "expires_at": data.get("expires_at"),
            },
        )

    def get_qr_session(self, login_id: str) -> dict[str, Any] | None:
        return self._qr_runtime.get(login_id)

    def list_qr_sessions_for_account(
        self, account_name: str
    ) -> list[tuple[str, dict[str, Any]]]:
        return [
            (session_id, data)
            for session_id, data in self._qr_runtime.items()
            if data.get("account_name") == account_name
        ]

    def update_qr_state(
        self,
        login_id: str,
        *,
        status: str,
        expires_at: datetime | None = None,
        payload_updates: dict[str, Any] | None = None,
    ) -> None:
        data = self._qr_runtime.get(login_id)
        if data:
            data["status"] = status
        self._upsert_state(
            session_id=login_id,
            flow_type="qr",
            account_name=str((data or {}).get("account_name") or ""),
            status=status,
            expires_at=expires_at,
            payload_updates=payload_updates,
        )

    def remove_qr_session(self, login_id: str) -> dict[str, Any] | None:
        self._delete_state(login_id)
        return self._qr_runtime.pop(login_id, None)


_login_session_service: LoginSessionService | None = None


def get_login_session_service() -> LoginSessionService:
    global _login_session_service
    if _login_session_service is None:
        _login_session_service = LoginSessionService()
    return _login_session_service
