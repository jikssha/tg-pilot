from __future__ import annotations

from pathlib import Path


def test_tg_signer_adapter_creates_backend_signer(isolated_env):
    from backend.adapters.tg_signer import BackendUserSigner, get_tg_signer_adapter

    adapter = get_tg_signer_adapter()
    signer = adapter.create_signer(
        task_name="daily",
        session_dir=str(isolated_env / "sessions"),
        account="alpha",
        workdir=isolated_env,
        proxy=None,
        session_string="test-session",
        in_memory=True,
        api_id=12345,
        api_hash="hash",
        no_updates=True,
    )

    assert isinstance(signer, BackendUserSigner)
    assert signer.task_dir == Path(isolated_env) / "signs" / "alpha" / "daily"
