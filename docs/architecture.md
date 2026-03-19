# TG-Pilot Architecture

## Product Line

TG-Pilot follows a lightweight, single-tenant product line:

- Product entrypoint: `frontend + backend`
- Execution engine and CLI compatibility layer: `tg_signer`
- Legacy compatibility surface: `tg_signer/webui`

`tg_signer/webui` remains in the repository for compatibility and emergency fixes only. New product work must land in the `frontend + backend` path.

## Runtime Model

The runtime model must remain lightweight by default:

- Single backend service process
- Single APScheduler instance
- SQLite as the default database
- Local filesystem for Telegram session material
- Static frontend served by the backend container

The project explicitly avoids introducing Redis, PostgreSQL-as-default, MQ-based workers, or microservices in the mainline product.

## Ownership Boundaries

- `frontend/`: operator-facing product UI
- `backend/`: product API, scheduling, orchestration, health/readiness, admin flows
- `tg_signer/`: Telegram execution primitives, CLI compatibility, legacy WebUI

## Versioning

The repository uses a unified product version:

- Product/app version: `3.6.1`
- Python package version: `tg_signer.__version__`
- Frontend package version: `frontend/package.json`

Any future release must keep these entrypoints aligned and update `CHANGELOG.md`.
