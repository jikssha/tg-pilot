from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from backend.services.config import get_config_service
from tg_signer import __version__ as APP_VERSION

DEFAULT_UPDATE_OWNER = "jikssha"
DEFAULT_UPDATE_REPO = "tg-pilot"
UPDATE_CACHE_TTL = timedelta(hours=6)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _isoformat(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.isoformat().replace("+00:00", "Z")


def _normalize_version(version: str | None) -> tuple[int, int, int]:
    raw = str(version or "").strip()
    if raw.startswith(("v", "V")):
        raw = raw[1:]
    core = raw.split("-", 1)[0].split("+", 1)[0]
    parts = []
    for segment in core.split("."):
        digits = "".join(ch for ch in segment if ch.isdigit())
        parts.append(int(digits or 0))
    while len(parts) < 3:
        parts.append(0)
    return int(parts[0]), int(parts[1]), int(parts[2])


def _has_update(current_version: str, latest_version: str | None) -> bool:
    if not latest_version:
        return False
    return _normalize_version(current_version) < _normalize_version(latest_version)


@dataclass
class UpdateCheckCacheEntry:
    expires_at: datetime
    payload: dict[str, Any]


class UpdateCheckService:
    def __init__(self) -> None:
        self._cache: dict[tuple[str, str], UpdateCheckCacheEntry] = {}
        self._lock = threading.Lock()

    def _fetch_latest_release(self, owner: str, repo: str) -> dict[str, Any]:
        request = Request(
            f"https://api.github.com/repos/{owner}/{repo}/releases/latest",
            headers={
                "Accept": "application/vnd.github+json",
                "User-Agent": "tg-pilot-update-check",
            },
            method="GET",
        )
        try:
            with urlopen(request, timeout=5) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            raise RuntimeError(f"GitHub returned HTTP {exc.code}") from exc
        except URLError as exc:
            raise RuntimeError("Unable to reach GitHub releases") from exc

        if not isinstance(payload, dict):
            raise RuntimeError("Unexpected GitHub release payload")
        tag_name = str(payload.get("tag_name") or "").strip()
        if not tag_name:
            raise RuntimeError("Latest release tag is missing")
        return payload

    def check(self, *, force_refresh: bool = False) -> dict[str, Any]:
        settings = get_config_service().get_global_settings()
        enabled = bool(settings.get("update_check_enabled", True))
        owner = str(settings.get("update_repo_owner") or DEFAULT_UPDATE_OWNER).strip() or DEFAULT_UPDATE_OWNER
        repo = str(settings.get("update_repo_name") or DEFAULT_UPDATE_REPO).strip() or DEFAULT_UPDATE_REPO
        source_repo = f"{owner}/{repo}"
        current_version = APP_VERSION
        cache_key = (source_repo, current_version)
        now = _utc_now()

        if not enabled:
            return {
                "enabled": False,
                "status": "disabled",
                "source_repo": source_repo,
                "current_version": current_version,
                "latest_version": None,
                "has_update": False,
                "release_url": f"https://github.com/{source_repo}/releases",
                "checked_at": _isoformat(now),
                "error": None,
            }

        if not force_refresh:
            with self._lock:
                cached = self._cache.get(cache_key)
                if cached and cached.expires_at > now:
                    return dict(cached.payload)

        release_url = f"https://github.com/{source_repo}/releases"
        try:
            release = self._fetch_latest_release(owner, repo)
            latest_version = str(release.get("tag_name") or "").strip() or None
            release_url = str(release.get("html_url") or release_url)
            payload = {
                "enabled": True,
                "status": "ok",
                "source_repo": source_repo,
                "current_version": current_version,
                "latest_version": latest_version,
                "has_update": _has_update(current_version, latest_version),
                "release_url": release_url,
                "checked_at": _isoformat(now),
                "error": None,
            }
        except Exception as exc:
            payload = {
                "enabled": True,
                "status": "error",
                "source_repo": source_repo,
                "current_version": current_version,
                "latest_version": None,
                "has_update": False,
                "release_url": release_url,
                "checked_at": _isoformat(now),
                "error": str(exc),
            }

        with self._lock:
            self._cache[cache_key] = UpdateCheckCacheEntry(
                expires_at=now + UPDATE_CACHE_TTL,
                payload=dict(payload),
            )

        return payload


_update_check_service: UpdateCheckService | None = None


def get_update_check_service() -> UpdateCheckService:
    global _update_check_service
    if _update_check_service is None:
        _update_check_service = UpdateCheckService()
    return _update_check_service
