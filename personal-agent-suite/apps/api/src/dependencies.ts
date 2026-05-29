import { buildServiceUrls, loadEnv } from "@agent-suite/config";
import { S3Client, HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
import { Connection } from "@temporalio/client";
import { Redis } from "ioredis";
import { Client as PgClient } from "pg";

import type { HealthDependency } from "./types.js";

const env = loadEnv();
const urls = buildServiceUrls(env);

async function checkPostgres(): Promise<HealthDependency> {
  const startedAt = Date.now();
  const client = new PgClient({ connectionString: urls.postgresUrl });
  try {
    await client.connect();
    await client.query("select 1");
    return { name: "postgres", ok: true, message: "connected", latencyMs: Date.now() - startedAt };
  } catch (error) {
    return { name: "postgres", ok: false, message: formatError(error), latencyMs: Date.now() - startedAt };
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function checkRedis(): Promise<HealthDependency> {
  const startedAt = Date.now();
  const redis = new Redis(urls.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    const pong = await redis.ping();
    return { name: "redis", ok: pong === "PONG", message: pong, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return { name: "redis", ok: false, message: formatError(error), latencyMs: Date.now() - startedAt };
  } finally {
    await redis.quit().catch(() => redis.disconnect());
  }
}

async function checkTemporal(): Promise<HealthDependency> {
  const startedAt = Date.now();
  const connection = await Connection.connect({ address: urls.temporalAddress }).catch((error) => error);
  if (connection instanceof Error) {
    return { name: "temporal", ok: false, message: formatError(connection), latencyMs: Date.now() - startedAt };
  }

  try {
    return { name: "temporal", ok: true, message: "connected", latencyMs: Date.now() - startedAt };
  } finally {
    await connection.close();
  }
}

async function checkMinio(): Promise<HealthDependency> {
  const startedAt = Date.now();
  const s3 = new S3Client({
    region: "us-east-1",
    endpoint: urls.minioEndpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.MINIO_ROOT_USER,
      secretAccessKey: env.MINIO_ROOT_PASSWORD
    }
  });

  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.MINIO_BUCKET }));
    return { name: "minio", ok: true, message: "bucket ready", latencyMs: Date.now() - startedAt };
  } catch (error) {
    const missingBucket = `${error}`.includes("NotFound") || `${error}`.includes("NoSuchBucket");
    if (!missingBucket) {
      return { name: "minio", ok: false, message: formatError(error), latencyMs: Date.now() - startedAt };
    }

    try {
      await s3.send(new CreateBucketCommand({ Bucket: env.MINIO_BUCKET }));
      return { name: "minio", ok: true, message: "bucket created", latencyMs: Date.now() - startedAt };
    } catch (createError) {
      return { name: "minio", ok: false, message: formatError(createError), latencyMs: Date.now() - startedAt };
    }
  }
}

/**
 * Probes every runtime dependency required by the API readiness contract.
 *
 * @returns The dependency status list consumed by readiness and status routes.
 */
export async function getDependencyStatuses(): Promise<HealthDependency[]> {
  return Promise.all([checkPostgres(), checkRedis(), checkTemporal(), checkMinio()]);
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : "unknown error";
}
