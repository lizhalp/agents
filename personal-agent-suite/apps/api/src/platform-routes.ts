import {
  createGoalSchema,
  createKnowledgeSourceSchema,
  createMemorySchema,
  createRunSchema,
  resolveApprovalSchema
} from "@agent-suite/shared-types";

import { requireInternalSystemAuth } from "./auth.js";
import {
  createGoal,
  createKnowledgeSource,
  createManualRun,
  createMemory,
  getPlatformSnapshot,
  resolveApproval
} from "./platform-repository.js";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

type BodySchema<T> = {
  safeParse: (body: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string }[] } };
};

type RouteRegistrar = {
  get: FastifyInstance["get"];
  patch: FastifyInstance["patch"];
  post: FastifyInstance["post"];
};

/**
 * Registers the documented Phase 1 control-plane routes.
 *
 * @param app The Fastify instance receiving route registrations.
 */
export function registerPlatformRoutes(app: RouteRegistrar) {
  app.get("/api/platform", { preHandler: requireInternalSystemAuth }, async () => getPlatformSnapshot());

  app.post("/api/goals", { preHandler: requireInternalSystemAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const input = parseBody(createGoalSchema, request.body);
    const ownerId = parseOwnerId(request);
    reply.code(201);
    return createGoal(input, ownerId);
  });

  app.post("/api/runs", { preHandler: requireInternalSystemAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const input = parseBody(createRunSchema, request.body);
    reply.code(201);
    return createManualRun(input);
  });

  app.patch(
    "/api/approvals/:approvalId",
    { preHandler: requireInternalSystemAuth },
    async (request: FastifyRequest) => {
      const input = parseBody(resolveApprovalSchema, request.body);
      const { approvalId } = request.params as { approvalId: string };
      return resolveApproval(approvalId, input);
    }
  );

  app.post("/api/memories", { preHandler: requireInternalSystemAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const input = parseBody(createMemorySchema, request.body);
    reply.code(201);
    return createMemory(input);
  });

  app.post(
    "/api/knowledge-sources",
    { preHandler: requireInternalSystemAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const input = parseBody(createKnowledgeSourceSchema, request.body);
      reply.code(201);
      return createKnowledgeSource(input);
    }
  );
}

function parseBody<T>(schema: BodySchema<T>, body: unknown) {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw validationError(result.error);
  }

  return result.data;
}

function validationError(error: { issues: { message: string }[] }) {
  return Object.assign(new Error(error.issues[0]?.message ?? "Invalid request body."), {
    statusCode: 400,
    code: "VALIDATION_ERROR"
  });
}

function parseOwnerId(request: FastifyRequest) {
  const rawOwnerId = request.headers["x-owner-id"];
  const ownerId = Array.isArray(rawOwnerId) ? rawOwnerId[0] : rawOwnerId;

  if (typeof ownerId === "string" && ownerId.trim().length > 0) {
    return ownerId.trim();
  }

  return "owner";
}
