import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("./dependencies.js", () => ({
  getDependencyStatuses: vi.fn(async () => [
    { name: "postgres", ok: true, message: "connected", latencyMs: 1 },
    { name: "redis", ok: true, message: "PONG", latencyMs: 1 },
    { name: "temporal", ok: true, message: "connected", latencyMs: 1 },
    { name: "minio", ok: true, message: "bucket ready", latencyMs: 1 }
  ])
}));

vi.mock("./smoke.js", () => ({
  runTemporalSmokeCheck: vi.fn(async () => ({ ok: true, message: "workflow result=hello-world:ack" }))
}));

describe("api auth", () => {
  beforeAll(() => {
    process.env.INTERNAL_API_SECRET = "test-secret";
  });

  afterAll(() => {
    delete process.env.INTERNAL_API_SECRET;
  });

  it("rejects anonymous access to /api/status", async () => {
    const { buildApp } = await import("./app.js");
    const app = buildApp();
    await app.ready();
    const response = await app.inject({ method: "GET", url: "/api/status" });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("allows internal access to /api/status", async () => {
    const { buildApp } = await import("./app.js");
    const app = buildApp();
    await app.ready();
    const response = await app.inject({ method: "GET", url: "/api/status", headers: { "x-internal-api-secret": "test-secret" } });

    expect(response.statusCode).toBe(200);
    expect(response.json().overallOk).toBe(true);
    await app.close();
  });

  it("rejects anonymous access to temporal smoke route", async () => {
    const { buildApp } = await import("./app.js");
    const app = buildApp();
    await app.ready();
    const response = await app.inject({ method: "POST", url: "/api/smoke/temporal" });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("allows internal access to temporal smoke route", async () => {
    const { buildApp } = await import("./app.js");
    const app = buildApp();
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/api/smoke/temporal",
      headers: { "x-internal-api-secret": "test-secret" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().ok).toBe(true);
    await app.close();
  });
});
