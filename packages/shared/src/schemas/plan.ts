import { z } from "zod";

export const planValidityTypeSchema = z.enum(["MONTHS", "LIFETIME"]);
export type PlanValidityType = z.infer<typeof planValidityTypeSchema>;

// The paid membership tier — canonical definition, imported by referral.ts
// and event.ts to key the referral matrix / per-tier reward rules. Distinct
// from VolunteerBatch (a points-threshold badge, unrelated to which plan a
// member paid for) despite sharing the same three names.
export const planTierSchema = z.enum(["SILVER", "GOLD", "PLATINUM"]);
export type PlanTier = z.infer<typeof planTierSchema>;

const planValidityRefinement = <T extends { validityType: PlanValidityType; validityMonths?: number | null }>(
  data: T,
  ctx: z.RefinementCtx,
) => {
  if (data.validityType === "MONTHS" && !data.validityMonths) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "validityMonths is required when validityType is MONTHS",
      path: ["validityMonths"],
    });
  }
  if (data.validityType === "LIFETIME" && data.validityMonths) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "validityMonths must be omitted when validityType is LIFETIME",
      path: ["validityMonths"],
    });
  }
};

export const createPlanSchema = z
  .object({
    name: z.string().min(1),
    tier: planTierSchema.nullish(),
    fee: z.number().nonnegative(),
    validityType: planValidityTypeSchema,
    validityMonths: z.number().int().positive().nullish(),
  })
  .superRefine(planValidityRefinement);
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  tier: planTierSchema.nullish(),
  fee: z.number().nonnegative().optional(),
  validityType: planValidityTypeSchema.optional(),
  validityMonths: z.number().int().positive().nullish(),
  isActive: z.boolean().optional(),
});
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export const planResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  tier: planTierSchema.nullable(),
  fee: z.number(),
  validityType: planValidityTypeSchema,
  validityMonths: z.number().nullable(),
  isActive: z.boolean(),
});
export type PlanResponse = z.infer<typeof planResponseSchema>;
