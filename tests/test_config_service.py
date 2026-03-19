from __future__ import annotations

import json


def test_sign_task_export_import_round_trip(isolated_env):
    from backend.services.config import ConfigService

    service = ConfigService()
    payload = {
        "_version": 3,
        "account_name": "primary",
        "sign_at": "0 6 * * *",
        "random_seconds": 10,
        "sign_interval": 5,
        "chats": [
            {
                "chat_id": 123456,
                "name": "签到群",
                "actions": [{"action": 1, "text": "签到"}],
                "delete_after": None,
                "action_interval": 10,
            }
        ],
    }

    assert service.save_sign_config("daily_sign", payload) is True

    exported = service.export_sign_task("daily_sign", account_name="primary")
    assert exported is not None

    exported_data = json.loads(exported)
    assert exported_data["task_name"] == "daily_sign"
    assert exported_data["config"]["sign_at"] == payload["sign_at"]
    assert "account_name" not in exported_data["config"]

    assert service.import_sign_task(
        exported,
        task_name="daily_sign_copy",
        account_name="secondary",
    )

    imported = service.get_sign_config("daily_sign_copy", account_name="secondary")
    assert imported is not None
    assert imported["account_name"] == "secondary"
    assert imported["chats"][0]["actions"][0]["text"] == "签到"


def test_session_zip_export_import_round_trip(isolated_env):
    from backend.core.config import get_settings
    from backend.services.config import ConfigService

    service = ConfigService()
    session_dir = get_settings().resolve_session_dir()
    session_dir.mkdir(parents=True, exist_ok=True)

    original_files = {
        "alpha.session_string": "SESSION_ALPHA",
        "beta.session_string": "SESSION_BETA",
    }
    for filename, content in original_files.items():
        (session_dir / filename).write_text(content, encoding="utf-8")

    archive = service.export_sessions_zip()

    (session_dir / "stale.session_string").write_text("STALE", encoding="utf-8")
    assert service.import_sessions_zip(archive) is True

    restored = sorted(path.name for path in session_dir.iterdir() if path.is_file())
    assert restored == sorted(original_files)
    assert (session_dir / "alpha.session_string").read_text(encoding="utf-8") == "SESSION_ALPHA"


def test_session_zip_preview_returns_manifest_and_accounts(isolated_env):
    from backend.core.config import get_settings
    from backend.services.config import ConfigService

    service = ConfigService()
    session_dir = get_settings().resolve_session_dir()
    session_dir.mkdir(parents=True, exist_ok=True)
    (session_dir / "preview-main.session_string").write_text("SESSION", encoding="utf-8")

    archive = service.export_sessions_zip()
    preview = service.preview_sessions_zip(archive)

    assert preview["valid"] is True
    assert preview["metadata"]["payload_type"] == "session_bundle"
    assert preview["file_count"] == 1
    assert preview["account_names"] == ["preview-main"]


def test_config_bundle_preview_reports_conflicts(isolated_env):
    from backend.services.config import ConfigService

    service = ConfigService()
    payload = {
        "_version": 3,
        "account_name": "primary",
        "sign_at": "0 6 * * *",
        "random_seconds": 0,
        "sign_interval": 5,
        "chats": [],
    }
    assert service.save_sign_config("daily_sign", payload) is True

    bundle = service.export_all_configs()
    preview = service.preview_all_configs(bundle, overwrite=False)

    assert preview["valid"] is True
    assert preview["metadata"]["payload_type"] == "config_bundle"
    assert preview["sign_tasks"]["total"] >= 1
    assert preview["sign_tasks"]["conflicts"] >= 1
