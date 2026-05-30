import { z } from "zod";

export const roleSchema = z.enum(["owner", "service"]);
export const capabilitySchema = z.enum(["platform.read", "platform.admin", "workflow.invoke", "internal.system"]);
export const principalTypeSchema = z.enum(["human", "service"]);

export const authenticatedPrincipalSchema = z.object({
  subjectId: z.string(),
  principalType: principalTypeSchema,
  roles: z.array(roleSchema),
  capabilities: z.array(capabilitySchema)
});

export const dependencyStatusSchema = z.object({
  name: z.enum(["api", "postgres", "redis", "temporal", "minio"]),
  ok: z.boolean(),
  message: z.string(),
  latencyMs: z.number().nullable()
});

export const statusResponseSchema = z.object({
  service: z.string(),
  version: z.string(),
  environment: z.string(),
  timestamp: z.string(),
  overallOk: z.boolean(),
  dependencies: z.array(dependencyStatusSchema)
});

export const goalStatusSchema = z.enum(["active", "paused", "completed", "archived"]);
export const goalHorizonSchema = z.enum(["daily", "weekly", "monthly", "quarterly", "long_horizon"]);
export const agentStatusSchema = z.enum(["active", "draft", "retired"]);
export const runStatusSchema = z.enum(["queued", "running", "waiting_approval", "completed", "failed", "cancelled"]);
export const approvalStatusSchema = z.enum(["pending", "approved", "rejected"]);
export const memoryTierSchema = z.enum(["working", "episodic", "semantic"]);
export const knowledgeSourceStatusSchema = z.enum(["pending", "indexing", "ready", "failed"]);

const timestampFields = {
  createdAt: z.string(),
  updatedAt: z.string()
};

export const goalSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  successCriteria: z.string(),
  constraints: z.string(),
  horizon: goalHorizonSchema,
  status: goalStatusSchema,
  ownerId: z.string(),
  targetDate: z.string().nullable(),
  ...timestampFields
});

export const agentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  status: agentStatusSchema,
  systemPrompt: z.string(),
  planningStyle: z.string(),
  toolPolicy: z.string(),
  memoryScope: z.string(),
  evaluationCriteria: z.string(),
  version: z.number().int(),
  ...timestampFields
});

export const runSchema = z.object({
  id: z.string().uuid(),
  goalId: z.string().uuid(),
  agentId: z.string().uuid(),
  status: runStatusSchema,
  objective: z.string(),
  summary: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  workflowId: z.string().nullable(),
  ...timestampFields
});

export const runEventSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  sequence: z.number().int(),
  eventType: z.string(),
  message: z.string(),
  payload: z.record(z.unknown()),
  createdAt: z.string()
});

export const approvalSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  status: approvalStatusSchema,
  requestedBy: z.string(),
  resolvedBy: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  ...timestampFields
});

export const memorySchema = z.object({
  id: z.string().uuid(),
  goalId: z.string().uuid().nullable(),
  tier: memoryTierSchema,
  title: z.string(),
  content: z.string(),
  sourceRunId: z.string().uuid().nullable(),
  importance: z.number().int(),
  ...timestampFields
});

export const knowledgeSourceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sourceType: z.string(),
  uri: z.string(),
  status: knowledgeSourceStatusSchema,
  documentCount: z.number().int(),
  lastIndexedAt: z.string().nullable(),
  ...timestampFields
});

export const platformSnapshotSchema = z.object({
  goals: z.array(goalSchema),
  agents: z.array(agentSchema),
  runs: z.array(runSchema),
  runEvents: z.array(runEventSchema),
  approvals: z.array(approvalSchema),
  memories: z.array(memorySchema),
  knowledgeSources: z.array(knowledgeSourceSchema)
});

export const createGoalSchema = z.object({
  title: z.string().min(1).max(180),
  description: z.string().min(1).max(4000),
  successCriteria: z.string().min(1).max(4000),
  constraints: z.string().max(4000).default(""),
  horizon: goalHorizonSchema.default("long_horizon"),
  targetDate: z.string().date().optional()
});

export const createRunSchema = z.object({
  goalId: z.string().uuid(),
  agentId: z.string().uuid(),
  objective: z.string().min(1).max(4000)
});

export const resolveApprovalSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  resolvedBy: z.string().min(1).max(180).default("owner")
});

export const createMemorySchema = z.object({
  goalId: z.string().uuid().optional(),
  tier: memoryTierSchema.default("working"),
  title: z.string().min(1).max(180),
  content: z.string().min(1).max(8000),
  importance: z.coerce.number().int().min(1).max(5).default(3)
});

export const createKnowledgeSourceSchema = z.object({
  name: z.string().min(1).max(180),
  sourceType: z.string().min(1).max(80),
  uri: z.string().min(1).max(1000)
});

export type DependencyStatus = z.infer<typeof dependencyStatusSchema>;
export type StatusResponse = z.infer<typeof statusResponseSchema>;
export type Role = z.infer<typeof roleSchema>;
export type Capability = z.infer<typeof capabilitySchema>;
export type PrincipalType = z.infer<typeof principalTypeSchema>;
export type AuthenticatedPrincipal = z.infer<typeof authenticatedPrincipalSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type Agent = z.infer<typeof agentSchema>;
export type Run = z.infer<typeof runSchema>;
export type RunEvent = z.infer<typeof runEventSchema>;
export type Approval = z.infer<typeof approvalSchema>;
export type Memory = z.infer<typeof memorySchema>;
export type KnowledgeSource = z.infer<typeof knowledgeSourceSchema>;
export type PlatformSnapshot = z.infer<typeof platformSnapshotSchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type CreateRunInput = z.infer<typeof createRunSchema>;
export type ResolveApprovalInput = z.infer<typeof resolveApprovalSchema>;
export type CreateMemoryInput = z.infer<typeof createMemorySchema>;
export type CreateKnowledgeSourceInput = z.infer<typeof createKnowledgeSourceSchema>;
