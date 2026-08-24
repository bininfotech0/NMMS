import { z } from "zod";

export const paymentModeSchema = z.enum(["CASH", "UPI", "BANK", "CHEQUE", "ONLINE"]);
export type PaymentMode = z.infer<typeof paymentModeSchema>;

export const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  mode: paymentModeSchema,
  transactionNumber: z.string().nullish(),
  remarks: z.string().nullish(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const paymentResponseSchema = z.object({
  id: z.string(),
  memberId: z.string(),
  amount: z.number(),
  mode: paymentModeSchema,
  receiptNumber: z.string(),
  transactionNumber: z.string().nullable(),
  remarks: z.string().nullable(),
  receivedById: z.string(),
  paidAt: z.date(),
  gatewayOrderId: z.string().nullable(),
  gatewayPaymentId: z.string().nullable(),
});
export type PaymentResponse = z.infer<typeof paymentResponseSchema>;

// Membership tier upgrade — collects the fee difference (if any) as a Payment
// and reassigns the member's plan. Manual modes only, same as recordPayment
// minus ONLINE (gateway checkout has its own dedicated flow).
export const upgradeMemberPlanSchema = z.object({
  planId: z.string().min(1),
  mode: paymentModeSchema.exclude(["ONLINE"]),
  transactionNumber: z.string().nullish(),
});
export type UpgradeMemberPlanInput = z.infer<typeof upgradeMemberPlanSchema>;

// Payment gateway (Razorpay) — online checkout flow.
export const gatewayOrderResponseSchema = z.object({
  orderId: z.string(),
  amountPaise: z.number().int().positive(),
  currency: z.string(),
  keyId: z.string(),
  name: z.string(),
  description: z.string(),
});
export type GatewayOrderResponse = z.infer<typeof gatewayOrderResponseSchema>;

export const verifyGatewayPaymentSchema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});
export type VerifyGatewayPaymentInput = z.infer<typeof verifyGatewayPaymentSchema>;

export const gatewayStatusResponseSchema = z.object({
  enabled: z.boolean(),
});
export type GatewayStatusResponse = z.infer<typeof gatewayStatusResponseSchema>;

// Razorpay Payment Link — a hosted checkout page shared with the member
// (WhatsApp/SMS/copy) so they can pay on their own device, as opposed to
// gatewayOrderResponseSchema which is embedded checkout completed in-app.
export const paymentLinkResponseSchema = z.object({
  shortUrl: z.string(),
});
export type PaymentLinkResponse = z.infer<typeof paymentLinkResponseSchema>;

// An org can hold both a test-mode and a live-mode Razorpay credential set at
// once (so switching back to test for debugging doesn't mean re-entering live
// keys), with `mode` on PAYMENT_GATEWAY's stored config picking which one
// RazorpayConfigService actually uses for checkout/webhook calls.
export const razorpayModeSchema = z.enum(["test", "live"]);
export type RazorpayMode = z.infer<typeof razorpayModeSchema>;

export const razorpayCredentialsInputSchema = z.object({
  keyId: z.string().min(1),
  keySecret: z.string().min(1),
  webhookSecret: z.string().min(1),
});
export type RazorpayCredentialsInput = z.infer<typeof razorpayCredentialsInputSchema>;

export const updatePaymentGatewayCredentialsSchema = z.object({
  mode: razorpayModeSchema,
  credentials: razorpayCredentialsInputSchema,
});
export type UpdatePaymentGatewayCredentialsInput = z.infer<typeof updatePaymentGatewayCredentialsSchema>;

export const setPaymentGatewayModeSchema = z.object({
  mode: razorpayModeSchema,
});
export type SetPaymentGatewayModeInput = z.infer<typeof setPaymentGatewayModeSchema>;

// Never includes the secrets themselves (write-only, same convention as
// FeatureFlagResponse.hasConfig) — just enough for the settings UI to show
// which modes are configured and which one is currently active.
export const paymentGatewayCredentialsStatusSchema = z.object({
  mode: razorpayModeSchema,
  hasTestConfig: z.boolean(),
  hasLiveConfig: z.boolean(),
});
export type PaymentGatewayCredentialsStatus = z.infer<typeof paymentGatewayCredentialsStatusSchema>;
