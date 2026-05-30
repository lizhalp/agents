# Personal Agent Suite

This repository is a scaffold for a personal platform of AI agents and subagents that can:

- run long-horizon software delivery work across the SDLC
- support personal analysis and decision-making
- improve executive functioning through planning, follow-through, and review
- manage goals that are structurally similar to those domains

The architecture is intentionally abstract. It separates:

- a control plane for goals, agents, workflows, tools, memory, and audit logs
- execution services for synchronous and asynchronous agent work
- a web app for managing agents, runs, knowledge, and results
- domain agent packs that can be extended without changing the platform core

## Recommended stack

- Frontend: Next.js, TypeScript, Tailwind CSS, shadcn/ui
- Backend API: Fastify with TypeScript
- Workflow orchestration: Temporal
- Database: Postgres with pgvector
- Cache and queues: Redis
- Search and retrieval: Postgres + pgvector first, add OpenSearch only if needed
- Auth: NextAuth with local owner credentials and optional Google/GitHub OAuth
- File/object storage: S3-compatible storage
- Observability: OpenTelemetry, Grafana, Loki
- Agent runtime: TypeScript SDK with pluggable providers and tool adapters
- Monorepo tooling: pnpm + Turborepo
- Deployment: Docker Compose for local development, Terraform for cloud

## Why this stack

This is the simplest stack that still handles durable long-running workflows, agent specialization, auditability, human approval steps, and a usable web control surface. The critical choice is `Temporal`: it gives you retries, resumability, schedules, timers, and stateful workflows without forcing fragile prompt-chaining logic into a web server.

## Directory map

- `apps/web`: management UI
- `apps/api`: control-plane API
- `apps/studio`: optional future sandbox for prompt and tool testing
- `services/orchestrator`: workflow workers and long-horizon coordination
- `services/worker-gateway`: execution boundary for tools, models, and sandboxed jobs
- `services/scheduler`: recurring planning, follow-up, and maintenance jobs
- `services/memory`: memory extraction, summarization, and retrieval services
- `services/indexer`: ingestion for documents, notes, repos, and structured data
- `packages/agent-sdk`: core agent abstractions
- `packages/shared-types`: shared schemas and contracts
- `packages/ui`: shared UI components
- `packages/config`: lint, tsconfig, env, and app configuration
- `packages/prompts`: versioned system prompts and templates
- `agents/*`: domain-specific agent packs
- `infra/*`: local and cloud infrastructure
- `docs/*`: architecture and product notes

## Clarifying questions

Before implementation, the highest-value questions are:

1. Do you want the first version to be local-first, cloud-first, or hybrid?
2. Should agents be allowed to take actions automatically, or should most actions require approval?
3. Which data sources matter first: local files, email, calendar, tasks, GitHub, browser, finance, or notes?
4. Do you want one primary LLM provider first, or a multi-provider routing layer from day one?
5. Is personal privacy more important than convenience, enough to justify self-hosting most state?

See `docs/architecture.md` for the concrete design.
