# ADR 0001: Lightweight Product Line

## Status

Accepted

## Context

TG-Pilot is evolving from a feature-rich secondary development effort into a product-grade self-hosted panel. The project must mature without losing its defining characteristic: low deployment and runtime requirements for multi-account Telegram automation.

## Decision

The mainline product will stay lightweight by default:

- Single-tenant, self-hosted deployment model
- Single-process backend and scheduler
- SQLite as the default database
- Local filesystem for Telegram session storage
- No Redis, message queue, or microservice split in the default path
- `frontend + backend` is the only product entrypoint
- `tg_signer` remains the execution engine and CLI compatibility layer
- `tg_signer/webui` is legacy and frozen for feature work

## Consequences

### Positive

- Low deployment complexity
- Low operator burden
- Easier local development and recovery
- Product maturity can improve without forcing larger machines

### Trade-offs

- No multi-tenant SaaS path in the mainline plan
- No distributed scheduling guarantees
- Advanced observability and role-based access remain out of scope for the default deployment

## Implementation Guardrails

- New always-on background work must justify its steady-state resource cost
- New storage layers must default to SQLite/file-backed implementations
- Product-level features must prefer on-demand execution over high-frequency polling
