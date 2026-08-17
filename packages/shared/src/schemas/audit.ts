import { z } from "zod";

export const auditLogResponseSchema = z.object({
  id: z.string(),
  actorId: z.string().nullable(),
  actorEmail: z.string().nullable(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.date(),
});
export type AuditLogResponse = z.infer<typeof auditLogResponseSchema>;

export const auditLogListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  action: z.string().optional(),
  entity: z.string().optional(),
});
export type AuditLogListQuery = z.infer<typeof auditLogListQuerySchema>;

export const auditLogPageSchema = z.object({
  data: z.array(auditLogResponseSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});
export type AuditLogPage = z.infer<typeof auditLogPageSchema>;

// Distinct action/entity values across the org's full audit history — kept
// separate from the paginated list so the filter dropdowns don't shrink to
// whatever happens to be on the current page.
export const auditLogFacetsSchema = z.object({
  actions: z.array(z.string()),
  entities: z.array(z.string()),
});
export type AuditLogFacets = z.infer<typeof auditLogFacetsSchema>;
