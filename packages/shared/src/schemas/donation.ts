import { z } from "zod";

// A member's monetary gift to the NGO. ONLINE is gateway-originated only —
// created exclusively by DonationGatewayService.verifyAndRecord, never
// hand-picked from the manual submit/record forms (see
// manualDonationModeSchema below) — same precedent as PaymentMode.ONLINE.
export const donationModeSchema = z.enum(["CASH", "UPI", "BANK", "CHEQUE", "ONLINE"]);
export type DonationMode = z.infer<typeof donationModeSchema>;

// Excludes ONLINE — same defensive precedent as payment.ts's
// upgradeMemberPlanSchema (paymentModeSchema.exclude(["ONLINE"])), so a
// client can never directly claim mode: "ONLINE" through the manual
// submit/record-direct endpoints and skip Razorpay verification entirely.
export const manualDonationModeSchema = donationModeSchema.exclude(["ONLINE"]);
export type ManualDonationMode = z.infer<typeof manualDonationModeSchema>;

export const donationStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type DonationStatus = z.infer<typeof donationStatusSchema>;

// Member self-submission — a claim about money already sent outside the app,
// awaiting Field Executive/Admin confirmation. Same shape reused for staff's
// direct-record action (a donation received in person, auto-approved).
export const submitDonationSchema = z.object({
  amount: z.number().positive(),
  mode: manualDonationModeSchema,
  note: z.string().nullish(),
  reference: z.string().nullish(),
  // Optional, for an 80G-style tax receipt — unvalidated free text, same
  // lenient pattern as Member.pan (no format/checksum enforcement anywhere
  // in this codebase).
  donorAddress: z.string().nullish(),
  donorPan: z.string().nullish(),
});
export type SubmitDonationInput = z.infer<typeof submitDonationSchema>;

export const recordDonationSchema = submitDonationSchema;
export type RecordDonationInput = z.infer<typeof recordDonationSchema>;

// Reject-only — approve takes no body, mirrors reviewWithdrawalSchema.
export const reviewDonationSchema = z.object({
  note: z.string().min(1),
});
export type ReviewDonationInput = z.infer<typeof reviewDonationSchema>;

export const donationResponseSchema = z.object({
  id: z.string(),
  memberId: z.string(),
  memberName: z.string().optional(), // admin views only
  amount: z.number(),
  mode: donationModeSchema,
  note: z.string().nullable(),
  reference: z.string().nullable(),
  donorAddress: z.string().nullable(),
  donorPan: z.string().nullable(),
  status: donationStatusSchema,
  receiptNumber: z.string().nullable(),
  pointsAwarded: z.number().nullable(),
  recordedById: z.string().nullable(),
  reviewedById: z.string().nullable(),
  reviewedAt: z.date().nullable(),
  reviewNote: z.string().nullable(),
  gatewayOrderId: z.string().nullable(),
  gatewayPaymentId: z.string().nullable(),
  createdAt: z.date(),
});
export type DonationResponse = z.infer<typeof donationResponseSchema>;

// Donation gateway (Razorpay) — online checkout flow, member-initiated.
// Amount is member-chosen (unlike Payment's gatewayOrderResponseSchema,
// where the fee is fixed by the member's plan), so createOrder needs it as
// input.
export const createDonationOrderSchema = z.object({
  amount: z.number().positive(),
  donorAddress: z.string().nullish(),
  donorPan: z.string().nullish(),
});
export type CreateDonationOrderInput = z.infer<typeof createDonationOrderSchema>;

export const donationGatewayOrderResponseSchema = z.object({
  orderId: z.string(),
  amountPaise: z.number().int().positive(),
  currency: z.string(),
  keyId: z.string(),
  name: z.string(),
  description: z.string(),
});
export type DonationGatewayOrderResponse = z.infer<typeof donationGatewayOrderResponseSchema>;

export const verifyDonationGatewayPaymentSchema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});
export type VerifyDonationGatewayPaymentInput = z.infer<typeof verifyDonationGatewayPaymentSchema>;
