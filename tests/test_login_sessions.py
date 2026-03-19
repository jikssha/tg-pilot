from __future__ import annotations

from datetime import datetime, timedelta


def test_login_session_service_persists_pending_account_names(db_session):
    from backend.services.login_sessions import LoginSessionService

    service = LoginSessionService()
    service.register_phone_session(
        "alpha_+8613800138000",
        {
            "account_name": "alpha",
            "phone_number": "+8613800138000",
            "phone_code_hash": "hash",
            "client": object(),
            "lock": None,
        },
        expires_at=datetime.utcnow() + timedelta(minutes=5),
    )

    assert "alpha" in service.list_pending_account_names()
    assert service.get_phone_session("alpha_+8613800138000") is not None

    removed = service.remove_phone_session("alpha_+8613800138000")
    assert removed is not None
    assert "alpha" not in service.list_pending_account_names()


def test_login_session_service_marks_existing_active_states_stale(db_session):
    from backend.models.login_session_state import LoginSessionState
    from backend.services.login_sessions import LoginSessionService

    db_session.add(
        LoginSessionState(
            session_id="stale-session",
            flow_type="phone",
            account_name="alpha",
            status="code_sent",
        )
    )
    db_session.commit()

    LoginSessionService()
    db_session.expire_all()

    row = (
        db_session.query(LoginSessionState)
        .filter(LoginSessionState.session_id == "stale-session")
        .first()
    )
    assert row is not None
    assert row.status == "stale"
