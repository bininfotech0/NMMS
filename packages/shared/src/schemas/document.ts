import { z } from "zod";

export const documentTypeSchema = z.enum([
  "PHOTO",
  "AADHAAR",
  "PAN",
  "VOTER_ID",
  "ADDRESS_PROOF",
  "OTHER",
  "SIGNATURE",
  "AADHAAR_FRONT",
  "AADHAAR_BACK",
  "QUALIFICATION_CERTIFICATE",
  "PASSPORT",
  "DRIVING_LICENCE",
  "GOVERNMENT_ID",
]);
export type DocumentType = z.infer<typeof documentTypeSchema>;

export const memberDocumentResponseSchema = z.object({
  id: z.string(),
  memberId: z.string(),
  memberName: z.string(),
  type: documentTypeSchema,
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  uploadedById: z.string(),
  uploadedByEmail: z.string(),
  createdAt: z.date(),
});
export type MemberDocumentResponse = z.infer<typeof memberDocumentResponseSchema>;
