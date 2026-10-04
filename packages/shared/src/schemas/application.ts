import { z } from "zod";
import { memberStatusSchema } from "./member";

// Used for suspend/reactivate/mark-deceased; each requires a remark for the
// audit trail (StatusHistory.remarks).
export const lifecycleActionSchema = z.object({
  remarks: z.string().min(1),
});
export type LifecycleActionInput = z.infer<typeof lifecycleActionSchema>;

export const statusHistoryResponseSchema = z.object({
  id: z.string(),
  memberId: z.string(),
  fromStatus: memberStatusSchema,
  toStatus: memberStatusSchema,
  remarks: z.string().nullable(),
  actorId: z.string(),
  createdAt: z.date(),
});
export type StatusHistoryResponse = z.infer<typeof statusHistoryResponseSchema>;
