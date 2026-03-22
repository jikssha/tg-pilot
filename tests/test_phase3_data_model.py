from __future__ import annotations

import json


def test_account_store_and_session_store_share_db_backed_profile(isolated_env, db_session):
    from backend.models.account import Account
    from backend.stores import get_account_store, get_session_store

    account_store = get_account_store()
    session_store = get_session_store()

    account_store.ensure_account(
        "alpha",
        session_backend="string",
        session_ref="alpha.session_string",
    )
    account_store.upsert_profile("alpha", remark="db remark", proxy="socks5://10.0.0.1:1080")

    profile = session_store.get_account_profile("alpha")
    row = db_session.query(Account).filter(Account.account_name == "alpha").first()

    assert row is not None
    assert row.remark == "db remark"
    assert row.session_ref == "alpha.session_string"
    assert profile["remark"] == "db remark"
    assert profile["proxy"] == "socks5://10.0.0.1:1080"


def test_db_sign_task_store_persists_task_without_legacy_file_write(
    isolated_env, db_session
):
    from backend.contracts import SignTaskDefinition
    from backend.models.sign_task import SignTask
    from backend.stores import get_sign_task_store

    store = get_sign_task_store()
    definition = SignTaskDefinition(
        name="daily",
        account_name="alpha",
        sign_at="0 7 * * *",
        chats=[{"chat_id": 1, "actions": [{"action": 1, "text": "hi"}]}],
        random_seconds=5,
        sign_interval=12,
        execution_mode="fixed",
    )

    store.save_task(definition)

    row = (
        db_session.query(SignTask)
        .filter(SignTask.account_name == "alpha", SignTask.name == "daily")
        .first()
    )
    assert row is not None
    assert row.sign_at == "0 7 * * *"
    assert store.get_task("daily", "alpha") is not None


def test_config_service_exports_versioned_sign_payload_and_imports_it(isolated_env, db_session):
    from backend.contracts import SignTaskDefinition
    from backend.services.config import get_config_service
    from backend.stores import get_sign_task_store

    store = get_sign_task_store()
    store.save_task(
        SignTaskDefinition(
            name="daily",
            account_name="alpha",
            sign_at="0 7 * * *",
            chats=[{"chat_id": 1, "actions": [{"action": 1, "text": "hello"}]}],
            random_seconds=0,
            sign_interval=3,
        )
    )

    config_service = get_config_service()
    exported = json.loads(config_service.export_sign_task("daily", account_name="alpha"))

    assert exported["schema_version"] == 1
    assert exported["payload_type"] == "sign_task"
    assert "account_name" not in exported["config"]

    exported["task_name"] = "copied"
    assert config_service.import_sign_task(
        json.dumps(exported, ensure_ascii=False),
        task_name="copied",
        account_name="beta",
    )

    copied = store.get_task("copied", "beta")
    assert copied is not None
    assert copied.account_name == "beta"
