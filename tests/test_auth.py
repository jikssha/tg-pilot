from __future__ import annotations

import pyotp
import pytest
from fastapi import HTTPException


def test_login_succeeds_with_valid_password(db_session):
    from backend.api.routes.auth import login
    from backend.core.security import hash_password
    from backend.models.user import User
    from backend.schemas.auth import LoginRequest

    db_session.add(User(username="alice", password_hash=hash_password("secret123")))
    db_session.commit()

    response = login(LoginRequest(username="alice", password="secret123"), db_session)

    assert response.token_type == "bearer"
    assert response.access_token


def test_login_requires_valid_totp_when_enabled(db_session):
    from backend.api.routes.auth import login
    from backend.core.security import hash_password
    from backend.models.user import User
    from backend.schemas.auth import LoginRequest

    secret = pyotp.random_base32()
    db_session.add(
        User(
            username="totp-user",
            password_hash=hash_password("secret123"),
            totp_secret=secret,
        )
    )
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        login(
            LoginRequest(
                username="totp-user",
                password="secret123",
                totp_code="000000",
            ),
            db_session,
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "TOTP_REQUIRED_OR_INVALID"

    valid_code = pyotp.TOTP(secret).now()
    response = login(
        LoginRequest(
            username="totp-user",
            password="secret123",
            totp_code=valid_code,
        ),
        db_session,
    )

    assert response.token_type == "bearer"
