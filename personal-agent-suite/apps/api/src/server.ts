import Fastify from "fastify";
import pino from "pino";

import { buildServiceUrls, loadEnv } from "@agent-suite/config";
import { statusResponseSchema } from "@agent-suite/shared-types";
import { getDependencyStatuses } from "./dependencies.js";
import { runTemporalSmokeCheck } from "./smoke.js";
import type { ServiceStatus } from "./types.js";

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

app.get("/api/status", async () => {
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

app.post("/api/smoke/temporal", async (_request, reply) => {
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

app.listen({ host: "0.0.0.0", port: env.API_PORT }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
