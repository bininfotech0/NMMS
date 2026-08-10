import { z } from "zod";

export const kycStatusSchema = z.enum(["NOT_SUBMITTED", "PENDING", "VERIFIED", "REJECTED"]);
export type KycStatus = z.infer<typeof kycStatusSchema>;

export const payoutMethodSchema = z.enum(["BANK", "UPI"]);
export type PayoutMethod = z.infer<typeof payoutMethodSchema>;

// Member-submitted payout details. BANK requires accountName+accountNumber+
// ifsc; UPI requires upiId — raw bankAccountNumber is write-only, hashed to
// last4 + encrypted server-side, never echoed back in full.
export const submitKycSchema = z
  .object({
    payoutMethod: payoutMethodSchema,
    bankAccountName: z.string().min(1).nullish(),
    bankAccountNumber: z.string().min(4).nullish(),
    bankIfscCode: z.string().min(1).nullish(),
    bankName: z.string().min(1).nullish(),
    upiId: z.string().min(1).nullish(),
  })
  .superRefine((data, ctx) => {
    if (data.payoutMethod === "BANK") {
      if (!data.bankAccountName || !data.bankAccountNumber || !data.bankIfscCode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Bank account name, account number, and IFSC code are required for bank payouts",
          path: ["bankAccountNumber"],
        });
      }
    } else if (data.payoutMethod === "UPI") {
      if (!data.upiId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "UPI ID is required for UPI payouts",
          path: ["upiId"],
        });
      }
    }
  });
export type SubmitKycInput = z.infer<typeof submitKycSchema>;

// Own or admin-viewed KYC status + masked payout details — never the raw
// encrypted bank account number (see revealBankAccountResponseSchema for the
// narrowly-scoped admin action that does return it).
export const kycResponseSchema = z.object({
  memberId: z.string().optional(),
  memberName: z.string().optional(),
  kycStatus: kycStatusSchema,
  kycReviewedAt: z.date().nullable(),
  kycReviewNote: z.string().nullable(),
  isComplete: z.boolean(),
  payoutMethod: payoutMethodSchema.nullable(),
  bankAccountName: z.string().nullable(),
  bankAccountNumberLast4: z.string().nullable(),
  bankIfscCode: z.string().nullable(),
  bankName: z.string().nullable(),
  upiId: z.string().nullable(),
  aadhaarLast4: z.string().nullable(),
  pan: z.string().nullable(),
});
export type KycResponse = z.infer<typeof kycResponseSchema>;

export const rejectKycSchema = z.object({
  note: z.string().min(1),
});
export type RejectKycInput = z.infer<typeof rejectKycSchema>;

export const revealBankAccountResponseSchema = z.object({
  bankAccountNumber: z.string(),
});
export type RevealBankAccountResponse = z.infer<typeof revealBankAccountResponseSchema>;
