import { beforeEach, describe, expect, it } from "vitest";

import { requireInternalSystemAuth } from "./auth.js";

import type { FastifyReply, FastifyRequest } from "fastify";

describe("requireInternalSystemAuth", () => {
  beforeEach(() => {
    process.env.INTERNAL_API_SECRET = "unit-secret";
  });

  it("rejects requests without the internal API secret", async () => {
    const reply = createReply();

    await requireInternalSystemAuth(createRequest(), reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.payload).toEqual({
      error: "unauthorized",
      message: "missing or invalid internal api secret"
    });
  });

  it("attaches a service principal when the internal API secret matches", async () => {
    const request = createRequest("unit-secret");
    const reply = createReply();

    await requireInternalSystemAuth(request, reply);

    expect(reply.statusCode).toBeUndefined();
    expect(request.principal).toEqual({
      subjectId: "internal-system",
      principalType: "service",
      roles: ["service"],
      capabilities: ["platform.read", "platform.admin", "workflow.invoke", "internal.system"]
    });
  });
});

function createRequest(secret?: string) {
  return {
    headers: secret ? { "x-internal-api-secret": secret } : {}
  } as FastifyRequest;
}

function createReply() {
  const reply = {
    statusCode: undefined as number | undefined,
    payload: undefined as unknown,
    code(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    send(payload: unknown) {
      this.payload = payload;
      return this;
    }
  };

  return reply as FastifyReply & typeof reply;
}
