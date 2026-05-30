import { buildServiceUrls, loadEnv } from "@agent-suite/config";
import { statusResponseSchema } from "@agent-suite/shared-types";
import Fastify from "fastify";
import pino from "pino";


import { requireInternalSystemAuth } from "./auth.js";
import { getDependencyStatuses } from "./dependencies.js";
import { registerPlatformRoutes } from "./platform-routes.js";
import { runTemporalSmokeCheck } from "./smoke.js";

import type { ServiceStatus } from "./types.js";

/**
 * Builds the API server with health, status, and smoke-test routes for the v1 control plane.
 *
 * @returns A configured Fastify application instance that is ready to listen.
 */
export function buildApp() {
  const env = loadEnv();
  const urls = buildServiceUrls(env);

  const logger = pino({
    level: "info",
    transport: process.env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" }
  });

  const app = Fastify({
    loggerInstance: logger,
    genReqId: () => crypto.randomUUID()
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-correlation-id", request.id);
    request.log.info({ correlationId: request.id }, "request_started");
  });

  app.setErrorHandler((error: unknown, _request, reply) => {
    const statusCode = getErrorStatusCode(error);
    reply.code(statusCode).send({
      error: statusCode >= 500 ? "internal_server_error" : "bad_request",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  });

  app.get("/health/live", async () => ({
    service: "api",
    status: "live",
    timestamp: new Date().toISOString()
  }));

  app.get("/health/ready", async (_request, reply) => {
    const dependencies = await getDependencyStatuses();
    const ok = dependencies.every((dependency) => dependency.ok);

    if (!ok) {
      reply.code(503);
    }

    return {
      service: "api",
      status: ok ? "ready" : "degraded",
      timestamp: new Date().toISOString(),
      dependencies
    };
  });

  app.get("/api/status", { preHandler: requireInternalSystemAuth }, async () => {
    const dependencies = await getDependencyStatuses();
    const payload: ServiceStatus = {
      service: "api",
      version: "0.1.0",
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      overallOk: dependencies.every((dependency) => dependency.ok),
      dependencies: [{ name: "api", ok: true, message: "serving", latencyMs: 0 }, ...dependencies]
    };

    return statusResponseSchema.parse(payload);
  });

  app.post("/api/smoke/temporal", { preHandler: requireInternalSystemAuth }, async (_request, reply) => {
    try {
      const result = await runTemporalSmokeCheck(urls.temporalAddress, env.TEMPORAL_NAMESPACE, env.TEMPORAL_TASK_QUEUE);
      return {
        service: "api",
        ok: result.ok,
        message: result.message,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      reply.code(503);
      return {
        service: "api",
        ok: false,
        message: error instanceof Error ? error.message : "unknown error",
        timestamp: new Date().toISOString()
      };
    }
  });

  registerPlatformRoutes(app as unknown as Parameters<typeof registerPlatformRoutes>[0]);

  return app;
}

function getErrorStatusCode(error: unknown) {
  if (error && typeof error === "object" && "statusCode" in error && typeof error.statusCode === "number") {
    return error.statusCode;
  }

  return 500;
}
