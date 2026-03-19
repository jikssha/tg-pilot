from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from backend.core.database import get_session_local
from backend.models.account import Account


class AccountStore:
    def _session(self) -> Session:
        return get_session_local()()

    @staticmethod
    def _resolve_api_credentials() -> tuple[str, str]:
        api_id = os.getenv("TG_API_ID") or ""
        api_hash = os.getenv("TG_API_HASH") or ""
        if api_id and api_hash:
            return str(api_id), str(api_hash)

        try:
            from backend.services.config import get_config_service

            tg_config = get_config_service().get_telegram_config()
            api_id = str(tg_config.get("api_id") or "")
            api_hash = str(tg_config.get("api_hash") or "")
        except Exception:
            api_id = ""
            api_hash = ""
        return api_id or "611335", api_hash or "d524b414d21f4d37f08684c1df41ac9c"

    def get_account(self, account_name: str) -> Account | None:
        db = self._session()
        try:
            return (
                db.query(Account).filter(Account.account_name == account_name).first()
            )
        finally:
            db.close()

    def list_account_names(self) -> list[str]:
        db = self._session()
        try:
            rows = db.query(Account.account_name).all()
            return sorted({row[0] for row in rows if row and row[0]})
        finally:
            db.close()

    def get_profile(self, account_name: str) -> dict[str, Any]:
        account = self.get_account(account_name)
        if account is None:
            return {}
        return {
            "remark": account.remark,
            "proxy": account.proxy,
            "status": account.status,
            "last_status_message": account.last_status_message,
            "last_checked_at": account.last_checked_at.isoformat()
            if account.last_checked_at
            else None,
            "session_backend": account.session_backend,
            "session_ref": account.session_ref,
            "last_login_at": account.last_login_at.isoformat()
            if account.last_login_at
            else None,
        }

    def ensure_account(
        self,
        account_name: str,
        *,
        legacy_profile: dict[str, Any] | None = None,
        session_backend: str | None = None,
        session_ref: str | None = None,
    ) -> dict[str, Any]:
        db = self._session()
        try:
            account = (
                db.query(Account).filter(Account.account_name == account_name).first()
            )
            if account is None:
                api_id, api_hash = self._resolve_api_credentials()
                account = Account(
                    account_name=account_name,
                    api_id=api_id,
                    api_hash=api_hash,
                    remark=(legacy_profile or {}).get("remark"),
                    proxy=(legacy_profile or {}).get("proxy"),
                    session_backend=session_backend,
                    session_ref=session_ref,
                    status="idle",
                )
                db.add(account)
            else:
                if legacy_profile:
                    if not account.remark and legacy_profile.get("remark"):
                        account.remark = legacy_profile.get("remark")
                    if not account.proxy and legacy_profile.get("proxy"):
                        account.proxy = legacy_profile.get("proxy")
                if session_backend:
                    account.session_backend = session_backend
                if session_ref:
                    account.session_ref = session_ref
            db.commit()
            db.refresh(account)
            return self.get_profile(account_name)
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def upsert_profile(
        self,
        account_name: str,
        *,
        remark: str | None = None,
        proxy: str | None = None,
        session_backend: str | None = None,
        session_ref: str | None = None,
        status: str | None = None,
        last_status_message: str | None = None,
        last_checked_at: datetime | None = None,
        last_login_at: datetime | None = None,
    ) -> dict[str, Any]:
        db = self._session()
        try:
            account = (
                db.query(Account).filter(Account.account_name == account_name).first()
            )
            if account is None:
                api_id, api_hash = self._resolve_api_credentials()
                account = Account(
                    account_name=account_name,
                    api_id=api_id,
                    api_hash=api_hash,
                    status=status or "idle",
                )
                db.add(account)

            if remark is not None:
                account.remark = remark.strip() if isinstance(remark, str) else remark
            if proxy is not None:
                account.proxy = proxy.strip() if isinstance(proxy, str) else proxy
            if session_backend is not None:
                account.session_backend = session_backend
            if session_ref is not None:
                account.session_ref = session_ref
            if status is not None:
                account.status = status
            if last_status_message is not None:
                account.last_status_message = last_status_message
            if last_checked_at is not None:
                account.last_checked_at = last_checked_at
            if last_login_at is not None:
                account.last_login_at = last_login_at

            db.commit()
            db.refresh(account)
            return self.get_profile(account_name)
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def sync_from_session(
        self,
        account_name: str,
        *,
        legacy_profile: dict[str, Any] | None = None,
        session_file: Path | None = None,
        session_backend: str | None = None,
    ) -> dict[str, Any]:
        session_ref = session_file.name if session_file is not None else None
        return self.ensure_account(
            account_name,
            legacy_profile=legacy_profile,
            session_backend=session_backend,
            session_ref=session_ref,
        )

    def delete_account(self, account_name: str) -> None:
        db = self._session()
        try:
            db.query(Account).filter(Account.account_name == account_name).delete(
                synchronize_session=False
            )
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()


_account_store: AccountStore | None = None


def get_account_store() -> AccountStore:
    global _account_store
    if _account_store is None:
        from backend.core.database import ensure_schema

        ensure_schema()
        _account_store = AccountStore()
    return _account_store
