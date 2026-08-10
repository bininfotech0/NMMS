import { z } from "zod";
import { payoutMethodSchema } from "./kyc";

export const withdrawalStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "PAID"]);
export type WithdrawalStatus = z.infer<typeof withdrawalStatusSchema>;

export const withdrawalChargeTypeSchema = z.enum(["NONE", "FLAT", "PERCENTAGE"]);
export type WithdrawalChargeType = z.infer<typeof withdrawalChargeTypeSchema>;

export const createWithdrawalRequestSchema = z.object({
  pointsRequested: z.number().int().positive(),
});
export type CreateWithdrawalRequestInput = z.infer<typeof createWithdrawalRequestSchema>;

export const withdrawalRequestResponseSchema = z.object({
  id: z.string(),
  memberId: z.string(),
  memberName: z.string().optional(), // admin views only
  pointsRequested: z.number(),
  grossAmount: z.number(),
  chargeType: withdrawalChargeTypeSchema,
  chargeAmount: z.number(),
  netAmount: z.number(),
  payoutMethod: payoutMethodSchema,
  payoutBankAccountName: z.string().nullable(),
  payoutBankAccountNumberLast4: z.string().nullable(),
  payoutBankIfscCode: z.string().nullable(),
  payoutBankName: z.string().nullable(),
  payoutUpiId: z.string().nullable(),
  status: withdrawalStatusSchema,
  reviewedAt: z.date().nullable(),
  reviewNote: z.string().nullable(),
  paidAt: z.date().nullable(),
  paymentReference: z.string().nullable(),
  createdAt: z.date(),
});
export type WithdrawalRequestResponse = z.infer<typeof withdrawalRequestResponseSchema>;

// The spec's six wallet fields — see WithdrawalsService.getWalletSummary.
export const walletSummaryResponseSchema = z.object({
  earnedPoints: z.number(),
  pendingPoints: z.number(),
  approvedPoints: z.number(),
  convertedPoints: z.number(),
  availableBalancePoints: z.number(),
  availableBalanceAmount: z.number(),
  withdrawnAmount: z.number(),
});
export type WalletSummaryResponse = z.infer<typeof walletSummaryResponseSchema>;

export const reviewWithdrawalSchema = z.object({
  note: z.string().min(1),
});
export type ReviewWithdrawalInput = z.infer<typeof reviewWithdrawalSchema>;

export const markWithdrawalPaidSchema = z.object({
  paymentReference: z.string().nullish(),
});
export type MarkWithdrawalPaidInput = z.infer<typeof markWithdrawalPaidSchema>;
