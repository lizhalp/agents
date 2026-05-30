import { approvalSchema, goalSchema, knowledgeSourceSchema, memorySchema, platformSnapshotSchema, runSchema } from "@agent-suite/shared-types";

import { ensurePlatformSchema, pool } from "./database.js";

import type {
  Agent,
  Approval,
  CreateGoalInput,
  CreateKnowledgeSourceInput,
  CreateMemoryInput,
  CreateRunInput,
  Goal,
  KnowledgeSource,
  Memory,
  PlatformSnapshot,
  ResolveApprovalInput,
  Run,
  RunEvent
} from "@agent-suite/shared-types";

type DbGoal = {
  id: string;
  title: string;
  description: string;
  success_criteria: string;
  constraints: string;
  horizon: Goal["horizon"];
  status: Goal["status"];
  owner_id: string;
  target_date: string | null;
  created_at: Date;
  updated_at: Date;
};

type DbAgent = {
  id: string;
  name: string;
  description: string;
  status: Agent["status"];
  system_prompt: string;
  planning_style: string;
  tool_policy: string;
  memory_scope: string;
  evaluation_criteria: string;
  version: number;
  created_at: Date;
  updated_at: Date;
};

type DbRun = {
  id: string;
  goal_id: string;
  agent_id: string;
  status: Run["status"];
  objective: string;
  summary: string;
  started_at: Date | null;
  completed_at: Date | null;
  workflow_id: string | null;
  created_at: Date;
  updated_at: Date;
};

type DbRunEvent = {
  id: string;
  run_id: string;
  sequence: number;
  event_type: string;
  message: string;
  payload: Record<string, unknown>;
  created_at: Date;
};

type DbApproval = {
  id: string;
  run_id: string;
  title: string;
  description: string;
  status: Approval["status"];
  requested_by: string;
  resolved_by: string | null;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type DbMemory = {
  id: string;
  goal_id: string | null;
  tier: Memory["tier"];
  title: string;
  content: string;
  source_run_id: string | null;
  importance: number;
  created_at: Date;
  updated_at: Date;
};

type DbKnowledgeSource = {
  id: string;
  name: string;
  source_type: string;
  uri: string;
  status: KnowledgeSource["status"];
  document_count: number;
  last_indexed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * Reads the current Phase 1 platform state from Postgres.
 *
 * @returns Goals, agents, runs, approvals, memories, and knowledge sources for the owner workspace.
 */
export async function getPlatformSnapshot(): Promise<PlatformSnapshot> {
  await ensurePlatformSchema();
  const workspaceId = await getWorkspaceId();

  const [goals, agents, runs, runEvents, approvals, memories, knowledgeSources] = await Promise.all([
    pool.query<DbGoal>("select * from goals where workspace_id = $1 order by created_at desc", [workspaceId]),
    pool.query<DbAgent>("select * from agents where workspace_id = $1 order by name asc, version desc", [workspaceId]),
    pool.query<DbRun>("select * from runs where workspace_id = $1 order by created_at desc limit 25", [workspaceId]),
    pool.query<DbRunEvent>(
      `
        select re.*
        from run_events re
        join runs r on r.id = re.run_id
        where r.workspace_id = $1
        order by re.created_at desc, re.sequence desc
        limit 80
      `,
      [workspaceId]
    ),
    pool.query<DbApproval>("select * from approvals where workspace_id = $1 order by created_at desc", [workspaceId]),
    pool.query<DbMemory>("select * from memories where workspace_id = $1 order by importance desc, updated_at desc", [
      workspaceId
    ]),
    pool.query<DbKnowledgeSource>("select * from knowledge_sources where workspace_id = $1 order by created_at desc", [
      workspaceId
    ])
  ]);

  return platformSnapshotSchema.parse({
    goals: goals.rows.map(mapGoal),
    agents: agents.rows.map(mapAgent),
    runs: runs.rows.map(mapRun),
    runEvents: runEvents.rows.map(mapRunEvent),
    approvals: approvals.rows.map(mapApproval),
    memories: memories.rows.map(mapMemory),
    knowledgeSources: knowledgeSources.rows.map(mapKnowledgeSource)
  });
}

/**
 * Creates a goal in the owner workspace.
 *
 * @param input Goal creation payload.
 * @param ownerId Owner identifier recorded on the goal.
 * @returns The created goal.
 */
export async function createGoal(input: CreateGoalInput, ownerId: string): Promise<Goal> {
  await ensurePlatformSchema();
  const workspaceId = await getWorkspaceId();
  const result = await pool.query<DbGoal>(
    `
      insert into goals (workspace_id, owner_id, title, description, success_criteria, constraints, horizon, target_date)
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      returning *
    `,
    [
      workspaceId,
      ownerId,
      input.title,
      input.description,
      input.successCriteria,
      input.constraints,
      input.horizon,
      input.targetDate ?? null
    ]
  );

  return goalSchema.parse(mapGoal(requiredRow(result.rows[0], "goal")));
}

/**
 * Creates a manual run request and its initial approval gate.
 *
 * @param input Run creation payload.
 * @returns The created run.
 */
export async function createManualRun(input: CreateRunInput): Promise<Run> {
  await ensurePlatformSchema();
  const workspaceId = await getWorkspaceId();
  const client = await pool.connect();

  try {
    await client.query("begin");
    const run = await client.query<DbRun>(
      `
        insert into runs (workspace_id, goal_id, agent_id, status, objective, summary)
        values ($1, $2, $3, 'waiting_approval', $4, 'Manual run requested. Waiting for owner approval.')
        returning *
      `,
      [workspaceId, input.goalId, input.agentId, input.objective]
    );
    const createdRun = requiredRow(run.rows[0], "run");

    await client.query(
      `
        insert into run_events (run_id, sequence, event_type, message, payload)
        values ($1, 1, 'run.requested', 'Manual run requested and queued behind an approval gate.', $2)
      `,
      [createdRun.id, { objective: input.objective }]
    );

    await client.query(
      `
        insert into approvals (workspace_id, run_id, title, description, requested_by)
        values ($1, $2, 'Approve manual run', $3, 'system')
      `,
      [workspaceId, createdRun.id, input.objective]
    );

    await client.query("commit");
    return runSchema.parse(mapRun(createdRun));
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Resolves a pending approval and records a run event.
 *
 * @param approvalId Approval identifier.
 * @param input Approval resolution payload.
 * @returns The updated approval.
 */
export async function resolveApproval(approvalId: string, input: ResolveApprovalInput): Promise<Approval> {
  await ensurePlatformSchema();
  const client = await pool.connect();

  try {
    await client.query("begin");
    const approval = await client.query<DbApproval>(
      `
        update approvals
        set status = $2,
            resolved_by = $3,
            resolved_at = now(),
            updated_at = now()
        where id = $1 and status = 'pending'
        returning *
      `,
      [approvalId, input.status, input.resolvedBy]
    );
    const updated = requiredRow(approval.rows[0], "approval");

    const nextStatus = input.status === "approved" ? "queued" : "cancelled";
    await client.query("update runs set status = $2, updated_at = now() where id = $1", [updated.run_id, nextStatus]);
    await client.query(
      `
        insert into run_events (run_id, sequence, event_type, message, payload)
        values (
          $1,
          coalesce((select max(sequence) + 1 from run_events where run_id = $1), 1),
          $2,
          $3,
          $4
        )
      `,
      [
        updated.run_id,
        `approval.${input.status}`,
        input.status === "approved" ? "Owner approved the run." : "Owner rejected the run.",
        { resolvedBy: input.resolvedBy }
      ]
    );
    await client.query("commit");
    return approvalSchema.parse(mapApproval(updated));
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Creates a memory entry.
 *
 * @param input Memory payload.
 * @returns The created memory.
 */
export async function createMemory(input: CreateMemoryInput): Promise<Memory> {
  await ensurePlatformSchema();
  const workspaceId = await getWorkspaceId();
  const result = await pool.query<DbMemory>(
    `
      insert into memories (workspace_id, goal_id, tier, title, content, importance)
      values ($1, $2, $3, $4, $5, $6)
      returning *
    `,
    [workspaceId, input.goalId ?? null, input.tier, input.title, input.content, input.importance]
  );

  return memorySchema.parse(mapMemory(requiredRow(result.rows[0], "memory")));
}

/**
 * Registers a knowledge source for future indexing.
 *
 * @param input Knowledge source payload.
 * @returns The created knowledge source.
 */
export async function createKnowledgeSource(input: CreateKnowledgeSourceInput): Promise<KnowledgeSource> {
  await ensurePlatformSchema();
  const workspaceId = await getWorkspaceId();
  const result = await pool.query<DbKnowledgeSource>(
    `
      insert into knowledge_sources (workspace_id, name, source_type, uri)
      values ($1, $2, $3, $4)
      returning *
    `,
    [workspaceId, input.name, input.sourceType, input.uri]
  );

  return knowledgeSourceSchema.parse(mapKnowledgeSource(requiredRow(result.rows[0], "knowledge source")));
}

async function getWorkspaceId() {
  const result = await pool.query<{ id: string }>("select id from workspaces where name = 'Personal Agent Suite' limit 1");
  const row = requiredRow(result.rows[0], "workspace");
  return row.id;
}

function mapGoal(row: DbGoal): Goal {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    successCriteria: row.success_criteria,
    constraints: row.constraints,
    horizon: row.horizon,
    status: row.status,
    ownerId: row.owner_id,
    targetDate: row.target_date,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function mapAgent(row: DbAgent): Agent {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    systemPrompt: row.system_prompt,
    planningStyle: row.planning_style,
    toolPolicy: row.tool_policy,
    memoryScope: row.memory_scope,
    evaluationCriteria: row.evaluation_criteria,
    version: row.version,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function mapRun(row: DbRun): Run {
  return {
    id: row.id,
    goalId: row.goal_id,
    agentId: row.agent_id,
    status: row.status,
    objective: row.objective,
    summary: row.summary,
    startedAt: row.started_at ? toIso(row.started_at) : null,
    completedAt: row.completed_at ? toIso(row.completed_at) : null,
    workflowId: row.workflow_id,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function mapRunEvent(row: DbRunEvent): RunEvent {
  return {
    id: row.id,
    runId: row.run_id,
    sequence: row.sequence,
    eventType: row.event_type,
    message: row.message,
    payload: row.payload,
    createdAt: toIso(row.created_at)
  };
}

function mapApproval(row: DbApproval): Approval {
  return {
    id: row.id,
    runId: row.run_id,
    title: row.title,
    description: row.description,
    status: row.status,
    requestedBy: row.requested_by,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at ? toIso(row.resolved_at) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function mapMemory(row: DbMemory): Memory {
  return {
    id: row.id,
    goalId: row.goal_id,
    tier: row.tier,
    title: row.title,
    content: row.content,
    sourceRunId: row.source_run_id,
    importance: row.importance,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function mapKnowledgeSource(row: DbKnowledgeSource): KnowledgeSource {
  return {
    id: row.id,
    name: row.name,
    sourceType: row.source_type,
    uri: row.uri,
    status: row.status,
    documentCount: row.document_count,
    lastIndexedAt: row.last_indexed_at ? toIso(row.last_indexed_at) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function toIso(value: Date) {
  return value.toISOString();
}

function requiredRow<T>(row: T | undefined, name: string): T {
  if (!row) {
    throw new Error(`Missing ${name}.`);
  }

  return row;
}
