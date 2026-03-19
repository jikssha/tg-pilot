from __future__ import annotations


def test_sign_config_v2_payload_upgrades_to_v3():
    from tg_signer.config import SignConfigV3

    legacy_payload = {
        "chats": [
            {
                "chat_id": 123456,
                "sign_text": "signin",
                "delete_after": None,
            }
        ],
        "sign_at": "06:00:00",
        "random_seconds": 0,
        "sign_interval": 1,
    }

    loaded = SignConfigV3.load(legacy_payload)

    assert loaded is not None
    current_config, upgraded = loaded
    assert upgraded is True
    assert current_config._version == 3
    assert current_config.chats[0].chat_id == 123456
    assert current_config.chats[0].actions[0].text == "signin"
