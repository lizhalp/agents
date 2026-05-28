# Architecture

## Design goal

Build a personal agent platform that can support:

- strategic, long-horizon execution
- nested agents and subagents
- software delivery work
- personal planning and opportunity analysis
- human-in-the-loop approvals
- strong memory, traceability, and extensibility

The platform should not hardcode one domain. It should treat all work as a combination of:

- goals
- plans
- workflows
- capabilities
- memory
- outputs
- feedback

## Core abstractions

### Goal

A goal is a long-lived objective with success criteria, constraints, time horizon, and ownership.

### Agent

An agent is a reusable operating profile:

- system prompt and policies
- tool access policy
- planning style
- memory scope
- escalation thresholds
- evaluation criteria

### Subagent

A subagent is a narrower agent invoked for a bounded task. It should inherit policy from its parent and receive a reduced capability set by default.

### Workflow

A workflow is a durable execution graph that coordinates steps over time, including sleeps, retries, review gates, and scheduled follow-ups.

### Capability

A capability is a typed integration point:

- LLM provider access
- search
- code execution
- browser automation
- email
- calendar
- task systems
- notes
- documents
- analytics

### Memory

Memory has four tiers:

- ephemeral run context
- working memory for an active goal
- episodic memory for completed runs and observations
- semantic memory for extracted facts, entities, and preferences

## Service layout

### `apps/web`

Primary management interface for:

- viewing goals, runs, and agent health
- reading memory and outputs
- approving actions
- comparing agent configs
- configuring providers, tools, and policies

### `apps/api`

Control-plane API for:

- CRUD for goals, agents, runs, tools, knowledge sources
- authentication and authorization
- audit logs and event streams
- operator actions from the UI

### `services/orchestrator`

Temporal workflows and activities for:

- long-running goals
- recurring reviews
- decomposition into subgoals
- approval checkpoints
- recovery and retry behavior

### `services/worker-gateway`

Execution boundary for:

- tool invocation
- sandboxed code execution
- model routing
- secret-aware provider adapters

### `services/scheduler`

Time-based triggers for:

- daily and weekly reviews
- reminder loops
- stale goal nudges
- opportunity scans

### `services/memory`

Pipelines for:

- summarization
- memory extraction
- embeddings
- retrieval ranking
- memory aging and compaction

### `services/indexer`

Ingestion for:

- repositories
- documents
- notes
- exports from external systems

## Data model

Start with these tables or equivalent entities:

- users
- workspaces
- goals
- goal_steps
- agents
- agent_versions
- runs
- run_events
- tool_definitions
- tool_invocations
- knowledge_sources
- knowledge_documents
- memories
- approvals
- schedules
- evaluations

## Web app modules

Prioritize these views:

1. Goals dashboard
2. Agent registry
3. Run timeline and logs
4. Memory explorer
5. Knowledge sources
6. Approval queue
7. Settings for models, tools, auth, and policies

## Technology choices

### Why Next.js

It gives a fast path to a serious internal app with server rendering, React ergonomics, and clean integration with auth and API consumption.

### Why Fastify

It is simpler than Nest for a greenfield control plane, stays close to the metal, and works well when most domain complexity belongs in workflows rather than controller layers.

### Why Temporal

Long-horizon work breaks naive request-response systems. Temporal gives durable timers, resumability, retries, workflows, and observability for tasks that may run for hours, days, or weeks.

### Why Postgres + pgvector

It keeps transactional state and vector retrieval in one place at the start. That reduces system count and operational drag.

### Why Redis

Use it for transient caching, rate limiting, and queue-like support tasks. Do not make it your source of truth for agent state.

## Recommended implementation phases

### Phase 1

- single-user auth
- goal management
- agent registry
- manual run triggering
- Temporal-backed workflows
- basic memory and vector search
- approval gates

### Phase 2

- recurring reviews and planners
- document and repo ingestion
- better dashboards
- tool marketplace and capability policies

### Phase 3

- multi-provider routing
- self-evaluation and regression testing
- richer personal analytics
- cross-goal optimization and portfolio views

## Clarifications needed

The main open design choices are:

1. local-first vs cloud-first
2. self-hosted vs managed auth and storage
3. level of autonomous action allowed
4. first-party integrations to build first
5. whether software execution and personal-life analysis must share the same trust boundary
