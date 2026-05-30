import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { buildApp } from "./app.js";
import type { Pool } from "pg";

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

let app: ReturnType<typeof buildApp>;
let pool: Pool;

describe("api integration", () => {
  beforeAll(async () => {
    process.env.INTERNAL_API_SECRET = "test-secret";
    process.env.POSTGRES_HOST ??= "127.0.0.1";
    process.env.POSTGRES_PORT ??= "5432";
    process.env.POSTGRES_USER ??= "postgres";
    process.env.POSTGRES_PASSWORD ??= "postgres";
    process.env.POSTGRES_DB ??= "agent_suite_test";

    const database = await import("./database.js");
    const application = await import("./app.js");

    pool = database.pool;
    app = application.buildApp();
    await app.ready();
    await database.ensurePlatformSchema();
  });

  beforeEach(async () => {
    await resetPlatformData();
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    delete process.env.INTERNAL_API_SECRET;
  });

  it("rejects anonymous access to /api/status", async () => {
    const response = await app.inject({ method: "GET", url: "/api/status" });

    expect(response.statusCode).toBe(401);
  });

  it("allows internal access to /api/status", async () => {
    const response = await app.inject({ method: "GET", url: "/api/status", headers: { "x-internal-api-secret": "test-secret" } });

    expect(response.statusCode).toBe(200);
    expect(response.json().overallOk).toBe(true);
  });

  it("rejects anonymous access to temporal smoke route", async () => {
    const response = await app.inject({ method: "POST", url: "/api/smoke/temporal" });

    expect(response.statusCode).toBe(401);
  });

  it("allows internal access to temporal smoke route", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/smoke/temporal",
      headers: { "x-internal-api-secret": "test-secret" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().ok).toBe(true);
  });

  it("loads the seeded platform snapshot from Postgres", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/platform",
      headers: { "x-internal-api-secret": "test-secret" }
    });

    expect(response.statusCode).toBe(200);
    const snapshot = response.json();
    expect(snapshot.goals).toHaveLength(1);
    expect(snapshot.goals[0].title).toBe("Build the personal agent platform");
    expect(snapshot.agents.map((agent: { name: string }) => agent.name)).toEqual([
      "Executive Function",
      "Personal Analyst",
      "Researcher",
      "Software Factory"
    ]);
  });

  it("creates goals through the control-plane API", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/goals",
      headers: { "x-internal-api-secret": "test-secret" },
      payload: {
        title: "Ship Phase 1",
        description: "Build the documented control plane.",
        successCriteria: "Goals, agents, runs, approvals, memory, and knowledge are backed by Postgres.",
        constraints: "",
        horizon: "long_horizon"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().title).toBe("Ship Phase 1");

    const snapshot = await app.inject({
      method: "GET",
      url: "/api/platform",
      headers: { "x-internal-api-secret": "test-secret" }
    });
    expect(snapshot.json().goals.some((goal: { title: string }) => goal.title === "Ship Phase 1")).toBe(true);
  });

  it("records goal ownership from the forwarded owner header", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/goals",
      headers: {
        "x-internal-api-secret": "test-secret",
        "x-owner-id": "owner@example.com"
      },
      payload: {
        title: "Verify owner attribution",
        description: "Ensure ownership tracks the signed-in owner context.",
        successCriteria: "Created goal row records the owner identity from the request header.",
        constraints: "",
        horizon: "long_horizon"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().ownerId).toBe("owner@example.com");
  });

  it("rejects invalid platform payloads", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/goals",
      headers: { "x-internal-api-secret": "test-secret" },
      payload: { title: "" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("bad_request");
  });

  it("creates and resolves a manual run approval transactionally", async () => {
    const { goalId, agentId } = await getSeedIds();
    const runResponse = await app.inject({
      method: "POST",
      url: "/api/runs",
      headers: { "x-internal-api-secret": "test-secret" },
      payload: {
        goalId,
        agentId,
        objective: "Decompose the platform goal into next implementation steps."
      }
    });

    expect(runResponse.statusCode).toBe(201);
    expect(runResponse.json().status).toBe("waiting_approval");

    const approval = await pool.query<{ id: string; status: string }>("select id, status from approvals limit 1");
    expect(approval.rows[0]?.status).toBe("pending");

    const approvalResponse = await app.inject({
      method: "PATCH",
      url: `/api/approvals/${approval.rows[0]?.id}`,
      headers: { "x-internal-api-secret": "test-secret" },
      payload: { status: "approved", resolvedBy: "owner" }
    });

    expect(approvalResponse.statusCode).toBe(200);
    expect(approvalResponse.json().status).toBe("approved");

    const run = await pool.query<{ status: string }>("select status from runs where id = $1", [runResponse.json().id]);
    const events = await pool.query<{ event_type: string }>("select event_type from run_events order by sequence asc");
    expect(run.rows[0]?.status).toBe("queued");
    expect(events.rows.map((event) => event.event_type)).toEqual(["run.requested", "approval.approved"]);
  });

  it("creates memory and knowledge source records through the API", async () => {
    const memoryResponse = await app.inject({
      method: "POST",
      url: "/api/memories",
      headers: { "x-internal-api-secret": "test-secret" },
      payload: {
        title: "Review preference",
        content: "Prefer explicit approval gates before long-running actions.",
        importance: 4
      }
    });
    const knowledgeResponse = await app.inject({
      method: "POST",
      url: "/api/knowledge-sources",
      headers: { "x-internal-api-secret": "test-secret" },
      payload: {
        name: "Architecture docs",
        sourceType: "repo",
        uri: "docs/architecture.md"
      }
    });

    expect(memoryResponse.statusCode).toBe(201);
    expect(memoryResponse.json().tier).toBe("working");
    expect(knowledgeResponse.statusCode).toBe(201);
    expect(knowledgeResponse.json().status).toBe("pending");

    const snapshot = await app.inject({
      method: "GET",
      url: "/api/platform",
      headers: { "x-internal-api-secret": "test-secret" }
    });
    expect(snapshot.json().memories).toHaveLength(1);
    expect(snapshot.json().knowledgeSources).toHaveLength(1);
  });
});

async function resetPlatformData() {
  await pool.query(`
    delete from approvals;
    delete from run_events;
    delete from runs;
    delete from memories;
    delete from knowledge_sources;
    delete from goals where title <> 'Build the personal agent platform';
  `);
}

async function getSeedIds() {
  const result = await pool.query<{ goal_id: string; agent_id: string }>(`
    select
      (select id from goals where title = 'Build the personal agent platform' limit 1) as goal_id,
      (select id from agents where name = 'Executive Function' limit 1) as agent_id
  `);
  const row = result.rows[0];

  if (!row?.goal_id || !row.agent_id) {
    throw new Error("Missing seeded goal or agent.");
  }

  return { goalId: row.goal_id, agentId: row.agent_id };
}
