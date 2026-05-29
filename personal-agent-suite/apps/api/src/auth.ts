
import { loadEnv } from "@agent-suite/config";

import type { AuthenticatedPrincipal } from "@agent-suite/shared-types";
import type { FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    principal?: AuthenticatedPrincipal;
  }
}

/**
 * Verifies the shared internal secret for machine-to-machine control-plane routes.
 *
 * @param request The Fastify request carrying the internal auth header.
 * @param reply The Fastify reply used to stop unauthorized calls.
 * @returns A principal on success or an unauthorized response on failure.
 */
export async function requireInternalSystemAuth(request: FastifyRequest, reply: FastifyReply) {
  const env = loadEnv();
  const providedSecret = request.headers["x-internal-api-secret"];
  const secret = Array.isArray(providedSecret) ? providedSecret[0] : providedSecret;

  if (!secret || secret !== env.INTERNAL_API_SECRET) {
    reply.code(401);
    return reply.send({
      error: "unauthorized",
      message: "missing or invalid internal api secret"
    });
  }

  request.principal = {
    subjectId: "internal-system",
    principalType: "service",
    roles: ["service"],
    capabilities: ["platform.read", "platform.admin", "workflow.invoke", "internal.system"]
  };
}
