import { z } from "zod";

export const namedCountSchema = z.object({
  name: z.string(),
  count: z.number(),
});
export type NamedCount = z.infer<typeof namedCountSchema>;

export const monthlyCountSchema = z.object({
  month: z.string(),
  count: z.number(),
});
export type MonthlyCount = z.infer<typeof monthlyCountSchema>;

export const monthlyAmountSchema = z.object({
  month: z.string(),
  amount: z.number(),
});
export type MonthlyAmount = z.infer<typeof monthlyAmountSchema>;

export const recentActivitySchema = z.object({
  id: z.string(),
  type: z.string(),
  message: z.string(),
  timestamp: z.string(),
  status: z.string().optional(),
});
export type RecentActivity = z.infer<typeof recentActivitySchema>;

export const statusBreakdownSchema = z.record(z.string(), z.number());

export const reportsSummaryResponseSchema = z.object({
  totalMembers: z.number(),
  memberStatusBreakdown: z.array(namedCountSchema),
  statusBreakdown: statusBreakdownSchema.optional(),
  memberGrowth: z.array(monthlyCountSchema),
  monthlyGrowth: z.array(z.object({ month: z.string(), members: z.number() })).optional(),
  planBreakdown: z.record(z.string(), z.number()).optional(),
  applicationFunnel: z.array(namedCountSchema),
  totalCollected: z.number(),
  totalCollection: z.number().optional(),
  thisMonthCollected: z.number(),
  monthlyCollection: z.number().optional(),
  monthlyCollections: z.array(monthlyAmountSchema).optional(),
  recentActivity: z.array(recentActivitySchema).optional(),
  expiringThisMonth: z.number().optional(),
});
export type ReportsSummaryResponse = z.infer<typeof reportsSummaryResponseSchema>;

// --- Detailed report rows (9 report types) ---------------------------------

export const memberRegisterRowSchema = z.object({
  id: z.string(),
  registrationNumber: z.string().nullable(),
  membershipNumber: z.string().nullable(),
  fullName: z.string(),
  mobile: z.string(),
  status: z.string(),
  planName: z.string().nullable(),
  createdAt: z.date(),
});
export type MemberRegisterRow = z.infer<typeof memberRegisterRowSchema>;

export const paymentCollectionRowSchema = z.object({
  id: z.string(),
  receiptNumber: z.string(),
  memberName: z.string(),
  amount: z.number(),
  mode: z.string(),
  paidAt: z.date(),
  receivedByEmail: z.string(),
});
export type PaymentCollectionRow = z.infer<typeof paymentCollectionRowSchema>;

export const renewalRowSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  membershipNumber: z.string().nullable(),
  mobile: z.string(),
  planName: z.string().nullable(),
  validUntil: z.date().nullable(),
});
export type RenewalRow = z.infer<typeof renewalRowSchema>;

export const fieldExecutivePerformanceRowSchema = z.object({
  userId: z.string(),
  email: z.string(),
  registeredCount: z.number(),
  activeCount: z.number(),
  totalCollected: z.number(),
});
export type FieldExecutivePerformanceRow = z.infer<typeof fieldExecutivePerformanceRowSchema>;
