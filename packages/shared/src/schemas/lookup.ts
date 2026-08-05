import { z } from "zod";

export const lookupCategorySchema = z.enum([
  "OCCUPATION",
  "EDUCATION",
  "BLOOD_GROUP",
  "RELIGION",
  "CASTE_CATEGORY",
  "BUSINESS_TYPE",
  "MEMBERSHIP_CATEGORY",
  "BRANCH",
  "FAMILY_TYPE",
]);
export type LookupCategory = z.infer<typeof lookupCategorySchema>;

export const createLookupSchema = z.object({
  category: lookupCategorySchema,
  value: z.string().min(1),
});
export type CreateLookupInput = z.infer<typeof createLookupSchema>;

export const updateLookupSchema = z.object({
  value: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateLookupInput = z.infer<typeof updateLookupSchema>;

export const lookupResponseSchema = z.object({
  id: z.string(),
  category: lookupCategorySchema,
  value: z.string(),
  isActive: z.boolean(),
});
export type LookupResponse = z.infer<typeof lookupResponseSchema>;
