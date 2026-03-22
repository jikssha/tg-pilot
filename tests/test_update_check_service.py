from __future__ import annotations


def test_update_check_defaults_follow_upstream(isolated_env):
    from backend.services.config import get_config_service

    settings = get_config_service().get_global_settings()

    assert settings["update_check_enabled"] is True
    assert settings["update_repo_owner"] == "jikssha"
    assert settings["update_repo_name"] == "tg-pilot"


def test_update_check_detects_new_release_and_caches(isolated_env, monkeypatch):
    from backend.services.update_check import get_update_check_service

    service = get_update_check_service()
    calls = {"count": 0}

    def fake_fetch(owner: str, repo: str) -> dict[str, str]:
        calls["count"] += 1
        assert owner == "jikssha"
        assert repo == "tg-pilot"
        return {
            "tag_name": "v9.9.9",
            "html_url": "https://github.com/jikssha/tg-pilot/releases/tag/v9.9.9",
        }

    monkeypatch.setattr(service, "_fetch_latest_release", fake_fetch)

    first = service.check(force_refresh=False)
    second = service.check(force_refresh=False)

    assert first["status"] == "ok"
    assert first["has_update"] is True
    assert first["latest_version"] == "v9.9.9"
    assert second["latest_version"] == "v9.9.9"
    assert calls["count"] == 1


def test_update_check_disabled_returns_disabled_state(isolated_env):
    from backend.services.config import get_config_service
    from backend.services.update_check import get_update_check_service

    assert get_config_service().save_global_settings({"update_check_enabled": False}) is True

    payload = get_update_check_service().check(force_refresh=True)

    assert payload["status"] == "disabled"
    assert payload["enabled"] is False
    assert payload["has_update"] is False
