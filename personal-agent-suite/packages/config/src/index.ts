import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PUBLIC_BASE_URL: z.string().min(1).default("localhost"),
  API_BASE_URL: z.string().optional(),
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

export type RuntimeEnv = z.infer<typeof envSchema>;

export function loadEnv(input: Record<string, string | undefined> = process.env): RuntimeEnv {
  return envSchema.parse(input);
}

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
