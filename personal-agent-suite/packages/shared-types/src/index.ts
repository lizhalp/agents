import { z } from "zod";

export const roleSchema = z.enum(["owner", "service"]);
export const capabilitySchema = z.enum(["platform.read", "platform.admin", "workflow.invoke", "internal.system"]);
export const principalTypeSchema = z.enum(["human", "service"]);

export const authenticatedPrincipalSchema = z.object({
  subjectId: z.string(),
  principalType: principalTypeSchema,
  roles: z.array(roleSchema),
  capabilities: z.array(capabilitySchema)
});

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
export type Role = z.infer<typeof roleSchema>;
export type Capability = z.infer<typeof capabilitySchema>;
export type PrincipalType = z.infer<typeof principalTypeSchema>;
export type AuthenticatedPrincipal = z.infer<typeof authenticatedPrincipalSchema>;
