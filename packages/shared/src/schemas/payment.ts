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
