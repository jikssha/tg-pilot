# Stage Gates

Every implementation phase must satisfy the following baseline gate before it is considered complete:

- Backend tests pass
- Frontend lint/build pass
- Docker smoke build passes
- Version and documentation changes are updated where relevant
- No leftover business `print` or ad-hoc `DEBUG` output remains
- Git worktree is clean or only contains intentional, reviewable changes

## Phase 0 Exit Gate

- Product entrypoint and legacy boundaries are documented
- Lightweight ADR is accepted
- Versioning and license metadata are aligned

## Phase 1 Exit Gate

- CI covers backend lint/test, frontend lint/build, and Docker smoke checks
- Alembic baseline exists and can initialize a fresh database
- Health/readiness checks reflect actual service readiness
- Minimal regression tests cover auth, config import/export, session ZIP handling, scheduler sync, and config compatibility

## Phase 2 Exit Gate

- Backend business code depends on internal contracts/adapters instead of scattered `tg_signer.core` calls
- Large service modules have clearer ownership boundaries
- Lightweight audit skeleton exists

## Phase 3 Exit Gate

- Account metadata and task metadata each have one primary source of truth
- CLI compatibility remains intact
- Import/export payloads have explicit versioning

## Phase 4 Exit Gate

- Dashboard and task pages are split by feature ownership
- Shared UI states and async data flows are reusable
- Bulk operations provide precheck, summary, and retry affordances

## Phase 5 Exit Gate

- Audit records are queryable
- Lightweight operations dashboard is available
- Backup/restore flows support preview or preflight checks
- Release/runbook documentation is sufficient for repeatable maintenance
