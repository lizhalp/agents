# AGENTS.md

This repository contains `personal-agent-suite`, a personal agent platform. Treat this file as the high-signal project brief for future agent work. It intentionally folds in the baseline engineering standards so agents do not need to load several docs before acting.

## What We Are Building

Build the system described in `personal-agent-suite/docs/architecture.md`: a DB-backed personal agent platform for goals, reusable agents, durable runs, approvals, memory, knowledge sources, workflows, tools, and policy controls. Do not turn it into a generic dashboard or landing page.

The product model is:

- Goals: long-lived objectives with success criteria, constraints, horizon, and owner.
- Agents: reusable operating profiles with prompts, tool policy, memory scope, planning style, and evaluation criteria.
- Runs: durable work attempts coordinated through the API and Temporal-backed orchestration.
- Approvals: human gates for actions and workflow progress.
- Memory: working, episodic, and semantic state tied to goals and runs.
- Knowledge: registered sources that can later be indexed, embedded, and retrieved.
- Capabilities: typed access to models, tools, browser/code execution, documents, notes, search, and other integrations.

Prioritize Phase 1 capabilities before polish-only work: single-user auth, goal management, agent registry, manual run triggering, Temporal workflows, basic memory/vector search, knowledge sources, and approval gates.

## Stack And Layout

- `personal-agent-suite/apps/web`: Next.js management UI using TypeScript and Tailwind.
- `personal-agent-suite/apps/api`: Fastify control-plane API.
- `personal-agent-suite/services/orchestrator`: Temporal workflows and activities.
- `personal-agent-suite/packages/shared-types`: shared Zod schemas and contracts.
- `personal-agent-suite/packages/config`: environment and service URL configuration.
- `personal-agent-suite/infra/docker`: local Docker Compose stack.
- `personal-agent-suite/tests/e2e`: Playwright tests.

Core stack: Next.js, Fastify, Postgres with pgvector, Redis, Temporal, S3-compatible storage, Docker Compose, pnpm, Turborepo, Playwright.

## Product Direction

- Product state belongs in Postgres unless it is truly ephemeral.
- Do not ship mocked data as product behavior. Mock only in tests where the test layer calls for it.
- Keep auth simple: NextAuth, local owner credentials, and optional Google/GitHub OAuth. Do not reintroduce Authentik, credential relay endpoints, cookie forwarding, or open registration.
- Prefer workflow durability in Temporal over long-running work inside web/API request handlers.
- Keep autonomous actions behind explicit approval gates until policies are implemented.

## Engineering Standards

- Optimize for clarity, traceability, and testability over cleverness.
- Keep modules small and named by responsibility. Avoid files that mix UI, data access, validation, orchestration, and styling.
- Use early returns and explicit names instead of deeply nested control flow.
- Keep import order stable and grouped.
- Await promises unless work is intentionally detached and documented.
- Keep production logging structured and useful.
- Add documentation comments to exported backend, shared-contract, orchestration, and auth-facing functions.
- Add inline comments only when they explain non-obvious intent. Do not restate the code mechanically.
- Do not hide production behavior behind test-only shortcuts.

## Testing Policy

Use three explicit layers:

- Unit tests: pure logic only. No app server, network, database, Docker, or browser.
- Integration tests: real module boundaries and real backing services where practical. API/repository integration tests should use real Postgres with pgvector.
- E2E tests: Docker Compose plus Playwright for browser behavior, auth, server actions, reverse proxy, service wiring, and isomorphic/runtime risks.

Do not create a separate "contract test" category unless there is a real consumer/provider compatibility contract. For this codebase, unit + integration + E2E is the default.

Coverage expectations:

- API, auth, policy, database, orchestration, and user-facing behavior changes require automated coverage.
- Schema and repository changes require real Postgres integration tests.
- Auth and browser-visible workflow changes require Playwright coverage.
- Bug fixes should include a test that would have failed before the fix when practical.

## Local Verification

Before saying work is ready to commit or push, run as much of the CI-equivalent suite locally as practical.

For most changes:

```bash
cd personal-agent-suite
pnpm ci:local
```

For changes touching Docker, Next.js runtime behavior, auth, API routing, server actions, Temporal, reverse proxy, or E2E behavior:

```bash
cd personal-agent-suite
pnpm ci:local:full
```

If a check cannot run, say exactly which check was skipped and why. Do not imply readiness when required verification did not run.

## CI Strategy

- Keep fast checks cheap: lint, typecheck, and unit tests should run together after one install.
- Run API integration against real `pgvector/pgvector:pg16` Postgres.
- Run full stack E2E for stack-impacting changes and before declaring stack-impacting work ready.
- Use path filtering only when skipped jobs cannot hide relevant failures.

## Database And State

- Keep seed behavior idempotent.
- Use disposable databases or isolated schemas for tests. Do not rely on developer data.
- Transactions that create related records, such as run + event + approval, need integration coverage.
- Vector/memory/indexing work should stay grounded in Postgres/pgvector first unless there is a concrete reason to add another system.

## Auth And Security

- Owner detection must be explicit and unit-tested.
- Privileged routes require authentication, authorization, and tests.
- Do not add unauthenticated registration, password relay routes, or identity-provider cookie forwarding.
- Do not reuse secrets across unrelated services.
- Keep service-to-service auth and human auth distinguishable in roles and principals.

## Frontend Policy

- Build the operational interface first. No marketing-first landing pages for app work.
- Use Tailwind consistently. Avoid large inline-style systems.
- UI should support real workflows: empty, loading, error, authenticated, anonymous, and persisted states.
- Text must fit across mobile and desktop. Do not allow controls, cards, or headings to overlap.
- Use Playwright for changed browser behavior and server-action/isomorphic risks.

## Git Hygiene

- Do not revert unrelated user changes.
- Keep edits scoped to the task.
- Do not commit generated local artifacts, temporary env files, Playwright reports, local Docker output, or dependency folders.
- Before pushing, confirm branch, committed files, and verification results.
