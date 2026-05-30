import { buildServiceUrls, loadEnv } from "@agent-suite/config";
import { Pool } from "pg";

const env = loadEnv();
const urls = buildServiceUrls(env);

export const pool = new Pool({
  connectionString: urls.postgresUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000
});

let schemaReady: Promise<void> | null = null;

/**
 * Ensures the Phase 1 control-plane schema exists before repository operations run.
 *
 * @returns A promise that resolves once schema and seed data are ready.
 */
export function ensurePlatformSchema() {
  schemaReady ??= initializeSchema();
  return schemaReady;
}

async function initializeSchema() {
  await pool.query(`
    create extension if not exists pgcrypto;
    create extension if not exists vector;

    create table if not exists users (
      id uuid primary key default gen_random_uuid(),
      email text not null unique,
      username text not null unique,
      display_name text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists workspaces (
      id uuid primary key default gen_random_uuid(),
      name text not null unique,
      owner_user_id uuid not null references users(id) on delete restrict,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists goals (
      id uuid primary key default gen_random_uuid(),
      workspace_id uuid not null references workspaces(id) on delete cascade,
      owner_id text not null,
      title text not null,
      description text not null,
      success_criteria text not null,
      constraints text not null default '',
      horizon text not null check (horizon in ('daily', 'weekly', 'monthly', 'quarterly', 'long_horizon')),
      status text not null default 'active' check (status in ('active', 'paused', 'completed', 'archived')),
      target_date date,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists agents (
      id uuid primary key default gen_random_uuid(),
      workspace_id uuid not null references workspaces(id) on delete cascade,
      name text not null,
      description text not null,
      status text not null default 'active' check (status in ('active', 'draft', 'retired')),
      system_prompt text not null,
      planning_style text not null,
      tool_policy text not null,
      memory_scope text not null,
      evaluation_criteria text not null,
      version integer not null default 1,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (workspace_id, name, version)
    );

    create table if not exists runs (
      id uuid primary key default gen_random_uuid(),
      workspace_id uuid not null references workspaces(id) on delete cascade,
      goal_id uuid not null references goals(id) on delete cascade,
      agent_id uuid not null references agents(id) on delete restrict,
      status text not null default 'queued' check (status in ('queued', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled')),
      objective text not null,
      summary text not null default '',
      workflow_id text,
      started_at timestamptz,
      completed_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists run_events (
      id uuid primary key default gen_random_uuid(),
      run_id uuid not null references runs(id) on delete cascade,
      sequence integer not null,
      event_type text not null,
      message text not null,
      payload jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      unique (run_id, sequence)
    );

    create table if not exists approvals (
      id uuid primary key default gen_random_uuid(),
      workspace_id uuid not null references workspaces(id) on delete cascade,
      run_id uuid not null references runs(id) on delete cascade,
      title text not null,
      description text not null,
      status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
      requested_by text not null,
      resolved_by text,
      resolved_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists memories (
      id uuid primary key default gen_random_uuid(),
      workspace_id uuid not null references workspaces(id) on delete cascade,
      goal_id uuid references goals(id) on delete set null,
      tier text not null check (tier in ('working', 'episodic', 'semantic')),
      title text not null,
      content text not null,
      source_run_id uuid references runs(id) on delete set null,
      importance integer not null check (importance between 1 and 5),
      embedding vector(1536),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists knowledge_sources (
      id uuid primary key default gen_random_uuid(),
      workspace_id uuid not null references workspaces(id) on delete cascade,
      name text not null,
      source_type text not null,
      uri text not null,
      status text not null default 'pending' check (status in ('pending', 'indexing', 'ready', 'failed')),
      document_count integer not null default 0,
      last_indexed_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists idx_goals_workspace_status on goals(workspace_id, status);
    create index if not exists idx_runs_workspace_status on runs(workspace_id, status);
    create index if not exists idx_run_events_run_sequence on run_events(run_id, sequence);
    create index if not exists idx_approvals_workspace_status on approvals(workspace_id, status);
    create index if not exists idx_memories_workspace_tier on memories(workspace_id, tier);
    create index if not exists idx_knowledge_sources_workspace_status on knowledge_sources(workspace_id, status);
  `);

  await seedOwnerWorkspace();
}

async function seedOwnerWorkspace() {
  const owner = await pool.query<{ id: string }>(
    `
      insert into users (email, username, display_name)
      values ($1, $2, $3)
      on conflict (email) do update
        set username = excluded.username,
            display_name = excluded.display_name,
            updated_at = now()
      returning id
    `,
    [env.AUTH_LOCAL_EMAIL, env.AUTH_LOCAL_USERNAME, env.AUTH_LOCAL_NAME]
  );

  const workspace = await pool.query<{ id: string }>(
    `
      insert into workspaces (name, owner_user_id)
      values ('Personal Agent Suite', $1)
      on conflict (name) do update
        set owner_user_id = excluded.owner_user_id,
            updated_at = now()
      returning id
    `,
    [owner.rows[0]?.id]
  );

  const workspaceId = workspace.rows[0]?.id;
  if (!workspaceId) {
    throw new Error("Unable to initialize workspace.");
  }

  await seedAgents(workspaceId);
  await seedGoal(workspaceId);
}

async function seedAgents(workspaceId: string) {
  const agents = [
    {
      name: "Executive Function",
      description: "Plans, prioritizes, and reviews commitments across work and life.",
      systemPrompt: "Turn broad goals into bounded plans with explicit next actions, constraints, and review points.",
      planningStyle: "structured review, decomposition, and follow-through",
      toolPolicy: "calendar, tasks, notes, approvals",
      memoryScope: "working and episodic goal memory",
      evaluationCriteria: "Plans are concrete, time-aware, and reduce ambiguity."
    },
    {
      name: "Software Factory",
      description: "Coordinates implementation plans, code review, and delivery workflows.",
      systemPrompt: "Help ship reliable software through scoped implementation, verification, and review.",
      planningStyle: "engineering execution with tests and risk controls",
      toolPolicy: "repos, code execution, browser automation, approvals",
      memoryScope: "project, repository, and run history",
      evaluationCriteria: "Changes are tested, maintainable, and traceable to goals."
    },
    {
      name: "Personal Analyst",
      description: "Analyzes opportunities, patterns, and tradeoffs for personal decisions.",
      systemPrompt: "Convert observations and evidence into clear options, implications, and recommendations.",
      planningStyle: "comparative analysis and decision support",
      toolPolicy: "documents, notes, search, approvals",
      memoryScope: "semantic preferences and episodic decisions",
      evaluationCriteria: "Analysis is grounded, useful, and explicit about uncertainty."
    },
    {
      name: "Researcher",
      description: "Ingests sources, extracts claims, and maintains knowledge context.",
      systemPrompt: "Gather, summarize, and connect knowledge sources with citations and uncertainty.",
      planningStyle: "source-first research and synthesis",
      toolPolicy: "search, documents, notes, memory",
      memoryScope: "semantic memory and knowledge documents",
      evaluationCriteria: "Outputs preserve source context and separate fact from inference."
    }
  ];

  for (const agent of agents) {
    await pool.query(
      `
        insert into agents (
          workspace_id, name, description, system_prompt, planning_style, tool_policy, memory_scope, evaluation_criteria
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        on conflict (workspace_id, name, version) do nothing
      `,
      [
        workspaceId,
        agent.name,
        agent.description,
        agent.systemPrompt,
        agent.planningStyle,
        agent.toolPolicy,
        agent.memoryScope,
        agent.evaluationCriteria
      ]
    );
  }
}

async function seedGoal(workspaceId: string) {
  await pool.query(
    `
      insert into goals (workspace_id, owner_id, title, description, success_criteria, constraints, horizon)
      select $1, $2, $3, $4, $5, $6, 'long_horizon'
      where not exists (select 1 from goals where workspace_id = $1)
    `,
    [
      workspaceId,
      env.AUTH_LOCAL_USERNAME,
      "Build the personal agent platform",
      "Implement the documented Phase 1 control plane for goals, agents, durable runs, memory, knowledge sources, and approval gates.",
      "A working owner can create goals, register agents, trigger runs, resolve approvals, and record memory against a Postgres-backed system.",
      "Keep automation behind explicit approval gates until policies are defined."
    ]
  );
}
