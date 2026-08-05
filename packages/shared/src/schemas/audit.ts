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
