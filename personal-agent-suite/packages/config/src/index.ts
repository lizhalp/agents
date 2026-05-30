import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PUBLIC_BASE_URL: z.string().min(1).default("localhost"),
  API_BASE_URL: z.string().optional(),
  INTERNAL_API_SECRET: z.string().min(1).default("change-me-in-real-environments"),
  AUTH_SECRET: z.string().min(1).default("change-me-auth-secret"),
  AUTH_LOCAL_EMAIL: z.string().email().default("akadmin@example.com"),
  AUTH_LOCAL_NAME: z.string().min(1).default("Local Owner"),
  AUTH_LOCAL_PASSWORD: z.string().min(1).default("change-me-local-password"),
  AUTH_LOCAL_USERNAME: z.string().min(1).default("akadmin"),
  AUTH_OWNER_EMAILS: z.string().default(""),
  AUTH_OWNER_USERNAMES: z.string().default(""),
  AUTH_GITHUB_ID: z.string().default(""),
  AUTH_GITHUB_SECRET: z.string().default(""),
  AUTH_GOOGLE_ID: z.string().default(""),
  AUTH_GOOGLE_SECRET: z.string().default(""),
  WEB_PORT: z.coerce.number().int().positive().default(3000),
  API_PORT: z.coerce.number().int().positive().default(4000),
  POSTGRES_DB: z.string().min(1).default("agent_suite"),
  POSTGRES_USER: z.string().min(1).default("postgres"),
  POSTGRES_PASSWORD: z.string().min(1).default("postgres"),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  TEMPORAL_PORT: z.coerce.number().int().positive().default(7233),
  TEMPORAL_NAMESPACE: z.string().min(1).default("default"),
  TEMPORAL_TASK_QUEUE: z.string().min(1).default("platform-smoke"),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_CONSOLE_PORT: z.coerce.number().int().positive().default(9001),
  MINIO_ROOT_USER: z.string().min(1).default("minioadmin"),
  MINIO_ROOT_PASSWORD: z.string().min(1).default("minioadmin"),
  MINIO_BUCKET: z.string().min(1).default("agent-suite-artifacts"),
  GRAFANA_PORT: z.coerce.number().int().positive().default(3100),
  PROMETHEUS_PORT: z.coerce.number().int().positive().default(9090),
  LOKI_PORT: z.coerce.number().int().positive().default(3101),
  TEMPO_PORT: z.coerce.number().int().positive().default(3200),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default("http://tempo:4318")
});

const insecureSecretDefaults = new Set([
  "change-me-in-real-environments",
  "change-me-auth-secret",
  "change-me-local-password"
]);

export type RuntimeEnv = z.infer<typeof envSchema>;

/**
 * Parses and validates runtime environment variables for every service in the monorepo.
 *
 * @param input Optional environment map, primarily used by tests.
 * @returns The validated runtime environment with defaults applied.
 */
export function loadEnv(input: Record<string, string | undefined> = process.env): RuntimeEnv {
  const env = envSchema.parse(input);

  if (
    env.NODE_ENV === "production" &&
    (insecureSecretDefaults.has(env.INTERNAL_API_SECRET) ||
      insecureSecretDefaults.has(env.AUTH_SECRET) ||
      insecureSecretDefaults.has(env.AUTH_LOCAL_PASSWORD))
  ) {
    throw new Error("Production environment requires explicit secure values for INTERNAL_API_SECRET, AUTH_SECRET, and AUTH_LOCAL_PASSWORD.");
  }

  return env;
}

/**
 * Builds internal service URLs from validated environment values.
 *
 * @param env The validated runtime environment returned by `loadEnv`.
 * @returns Connection strings and service endpoints used throughout the stack.
 */
export function buildServiceUrls(env: RuntimeEnv) {
  const postgresHost = inputOrDefault(process.env.POSTGRES_HOST, "postgres");
  const redisHost = inputOrDefault(process.env.REDIS_HOST, "redis");
  const temporalHost = inputOrDefault(process.env.TEMPORAL_HOST, "temporal");
  const minioHost = inputOrDefault(process.env.MINIO_HOST, "minio");
  const apiBaseUrl = inputOrDefault(env.API_BASE_URL, `http://api:${env.API_PORT}`);

  return {
    postgresUrl: `postgresql://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@${postgresHost}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}`,
    redisUrl: `redis://${redisHost}:${env.REDIS_PORT}`,
    temporalAddress: `${temporalHost}:${env.TEMPORAL_PORT}`,
    minioEndpoint: `http://${minioHost}:${env.MINIO_PORT}`,
    webBaseUrl: `http://web:${env.WEB_PORT}`,
    apiBaseUrl
  };
}

function inputOrDefault(value: string | undefined, fallback: string) {
  return value && value.trim().length > 0 ? value : fallback;
}
