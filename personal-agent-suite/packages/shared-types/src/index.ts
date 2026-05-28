import { z } from "zod";

export const dependencyStatusSchema = z.object({
  name: z.enum(["api", "postgres", "redis", "temporal", "minio"]),
  ok: z.boolean(),
  message: z.string(),
  latencyMs: z.number().nullable()
});

export const statusResponseSchema = z.object({
  service: z.string(),
  version: z.string(),
  environment: z.string(),
  timestamp: z.string(),
  overallOk: z.boolean(),
  dependencies: z.array(dependencyStatusSchema)
});

export type DependencyStatus = z.infer<typeof dependencyStatusSchema>;
export type StatusResponse = z.infer<typeof statusResponseSchema>;
