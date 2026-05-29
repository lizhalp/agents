import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PUBLIC_BASE_URL: z.string().min(1).default("localhost"),
  API_BASE_URL: z.string().optional(),
  INTERNAL_API_SECRET: z.string().min(1).default("change-me-in-real-environments"),
  AUTH_SECRET: z.string().min(1).default("change-me-auth-secret"),
  AUTH_OWNER_EMAILS: z.string().default(""),
  AUTH_OWNER_USERNAMES: z.string().default(""),
  AUTHENTIK_HOST: z.string().min(1).default("auth.localhost"),
  AUTHENTIK_BASE_URL: z.string().url().default("https://localhost/authentik"),
  AUTHENTIK_INTERNAL_BASE_URL: z.string().url().default("http://reverse-proxy/authentik"),
  AUTHENTIK_INTERNAL_SERVICE_URL: z.string().url().default("http://authentik-server:9000"),
  AUTHENTIK_APP_SLUG: z.string().min(1).default("personal-agent-suite"),
  AUTHENTIK_CLIENT_ID: z.string().min(1).default("personal-agent-suite"),
  AUTHENTIK_CLIENT_SECRET: z.string().min(1).default("personal-agent-suite-secret"),
  AUTH_GITHUB_ID: z.string().default(""),
  AUTH_GITHUB_SECRET: z.string().default(""),
  AUTH_GOOGLE_ID: z.string().default(""),
  AUTH_GOOGLE_SECRET: z.string().default(""),
  AUTHENTIK_BOOTSTRAP_PASSWORD: z.string().min(1).default("authentik-admin-password"),
  AUTHENTIK_BOOTSTRAP_TOKEN: z.string().min(1).default("authentik-bootstrap-token"),
  AUTHENTIK_BOOTSTRAP_EMAIL: z.string().email().default("akadmin@example.com"),
  WEB_PORT: z.coerce.number().int().positive().default(3000),
  API_PORT: z.coerce.number().int().positive().default(4000),
  POSTGRES_DB: z.string().min(1).default("agent_suite"),
  POSTGRES_USER: z.string().min(1).default("postgres"),
  POSTGRES_PASSWORD: z.string().min(1).default("postgres"),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  AUTHENTIK_POSTGRES_DB: z.string().min(1).default("authentik"),
  AUTHENTIK_POSTGRES_USER: z.string().min(1).default("authentik"),
  AUTHENTIK_POSTGRES_PASSWORD: z.string().min(1).default("authentik"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  AUTHENTIK_REDIS_PORT: z.coerce.number().int().positive().default(6380),
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

export type RuntimeEnv = z.infer<typeof envSchema>;

/**
 * Parses and validates runtime environment variables for every service in the monorepo.
 *
 * @param input Optional environment map, primarily used by tests.
 * @returns The validated runtime environment with defaults applied.
 */
export function loadEnv(input: Record<string, string | undefined> = process.env): RuntimeEnv {
  return envSchema.parse(input);
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
    apiBaseUrl,
    authentikIssuer: `${env.AUTHENTIK_INTERNAL_SERVICE_URL}/application/o/${env.AUTHENTIK_APP_SLUG}/`,
    authentikAuthorizeUrl: `${env.AUTHENTIK_BASE_URL}/application/o/authorize/`,
    authentikTokenUrl: `${env.AUTHENTIK_INTERNAL_SERVICE_URL}/application/o/token/`,
    authentikUserInfoUrl: `${env.AUTHENTIK_INTERNAL_SERVICE_URL}/application/o/userinfo/`,
    authentikJwksUrl: `${env.AUTHENTIK_INTERNAL_SERVICE_URL}/application/o/${env.AUTHENTIK_APP_SLUG}/jwks/`,
    authentikDiscoveryUrl: `${env.AUTHENTIK_INTERNAL_SERVICE_URL}/application/o/${env.AUTHENTIK_APP_SLUG}/.well-known/openid-configuration`,
    authentikAppBaseUrl: `${env.AUTHENTIK_BASE_URL}/application/o/${env.AUTHENTIK_APP_SLUG}`,
    authentikBootstrapApiUrl: `${env.AUTHENTIK_INTERNAL_SERVICE_URL}/api/v3`
  };
}

function inputOrDefault(value: string | undefined, fallback: string) {
  return value && value.trim().length > 0 ? value : fallback;
}
