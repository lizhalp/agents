import { describe, expect, it } from "vitest";

import { buildServiceUrls, loadEnv } from "./index.js";

describe("loadEnv", () => {
  it("applies defaults for the local development stack", () => {
    const env = loadEnv({});

    expect(env.NODE_ENV).toBe("development");
    expect(env.PUBLIC_BASE_URL).toBe("localhost");
    expect(env.AUTHENTIK_CLIENT_ID).toBe("personal-agent-suite");
    expect(env.POSTGRES_PORT).toBe(5432);
    expect(env.TEMPORAL_TASK_QUEUE).toBe("platform-smoke");
  });

  it("parses explicit overrides and numeric strings", () => {
    const env = loadEnv({
      NODE_ENV: "production",
      PUBLIC_BASE_URL: "agents.example.com",
      API_PORT: "4100",
      POSTGRES_PORT: "6543",
      AUTH_GOOGLE_ID: "google-client-id",
      AUTH_GOOGLE_SECRET: "google-client-secret"
    });

    expect(env.NODE_ENV).toBe("production");
    expect(env.PUBLIC_BASE_URL).toBe("agents.example.com");
    expect(env.API_PORT).toBe(4100);
    expect(env.POSTGRES_PORT).toBe(6543);
    expect(env.AUTH_GOOGLE_ID).toBe("google-client-id");
  });
});

describe("buildServiceUrls", () => {
  it("builds internal service URLs from the validated environment", () => {
    const env = loadEnv({
      POSTGRES_USER: "suite",
      POSTGRES_PASSWORD: "secret",
      POSTGRES_DB: "suite_db",
      AUTHENTIK_APP_SLUG: "operator-suite",
      AUTHENTIK_BASE_URL: "https://agents.example.com/auth",
      AUTHENTIK_INTERNAL_SERVICE_URL: "http://authentik-server:9000"
    });

    const urls = buildServiceUrls(env);

    expect(urls.postgresUrl).toBe("postgresql://suite:secret@postgres:5432/suite_db");
    expect(urls.redisUrl).toBe("redis://redis:6379");
    expect(urls.temporalAddress).toBe("temporal:7233");
    expect(urls.authentikAuthorizeUrl).toBe("https://agents.example.com/auth/application/o/authorize/");
    expect(urls.authentikDiscoveryUrl).toBe(
      "http://authentik-server:9000/application/o/operator-suite/.well-known/openid-configuration"
    );
  });

  it("respects explicit host overrides from process environment", () => {
    const original = {
      MINIO_HOST: process.env.MINIO_HOST,
      POSTGRES_HOST: process.env.POSTGRES_HOST,
      REDIS_HOST: process.env.REDIS_HOST,
      TEMPORAL_HOST: process.env.TEMPORAL_HOST
    };

    process.env.POSTGRES_HOST = "db.internal";
    process.env.REDIS_HOST = "cache.internal";
    process.env.TEMPORAL_HOST = "temporal.internal";
    process.env.MINIO_HOST = "object.internal";

    try {
      const urls = buildServiceUrls(loadEnv({}));

      expect(urls.postgresUrl).toContain("@db.internal:5432/");
      expect(urls.redisUrl).toBe("redis://cache.internal:6379");
      expect(urls.temporalAddress).toBe("temporal.internal:7233");
      expect(urls.minioEndpoint).toBe("http://object.internal:9000");
    } finally {
      restoreEnv(original);
    }
  });
});

function restoreEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
