import { z } from "zod";

export const featureFlagKeySchema = z.enum([
  "PAYMENT_GATEWAY",
  "PAYMENT_GATEWAY_PAYOUTS",
  "WHATSAPP_NOTIFY",
  "AI_DEDUPE",
  "AI_OCR",
  "SMS",
  "EMAIL",
]);
export type FeatureFlagKey = z.infer<typeof featureFlagKeySchema>;

export const updateFeatureFlagSchema = z.object({
  enabled: z.boolean().optional(),
  // Provider credentials/config, e.g. { apiKey, senderId }. Stored encrypted server-side.
  // Pass null to clear, omit to leave unchanged.
  config: z.record(z.string(), z.unknown()).nullish(),
});
export type UpdateFeatureFlagInput = z.infer<typeof updateFeatureFlagSchema>;

export const featureFlagResponseSchema = z.object({
  key: featureFlagKeySchema,
  enabled: z.boolean(),
  hasConfig: z.boolean(),
});
export type FeatureFlagResponse = z.infer<typeof featureFlagResponseSchema>;
