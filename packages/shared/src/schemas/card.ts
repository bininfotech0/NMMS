import { z } from "zod";
import { memberStatusSchema } from "./member";

export const cardTokenResponseSchema = z.object({
  token: z.string(),
});
export type CardTokenResponse = z.infer<typeof cardTokenResponseSchema>;

// Deliberately minimal — no photo, mobile, address, or other PII. Anyone with
// a camera can scan the physical card's QR, so this is a public endpoint.
export const cardVerifyResponseSchema = z.object({
  fullName: z.string(),
  membershipNumber: z.string().nullable(),
  status: memberStatusSchema,
  validUntil: z.date().nullable(),
});
export type CardVerifyResponse = z.infer<typeof cardVerifyResponseSchema>;
