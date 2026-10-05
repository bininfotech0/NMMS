import { z } from "zod";
import { Role } from "../enums/role";

// Who a notice is for: null = everyone (members and staff), "MEMBER" =
// members only, or one staff role.
export const NOTICE_AUDIENCE_MEMBERS = "MEMBER" as const;
export const noticeAudienceSchema = z.union([z.nativeEnum(Role), z.literal(NOTICE_AUDIENCE_MEMBERS)]);
export type NoticeAudience = z.infer<typeof noticeAudienceSchema>;

export const createNoticeSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  body: z.string().min(10, "Body must be at least 10 characters"),
  audienceRole: noticeAudienceSchema.nullable().optional(),
  publishNow: z.boolean().default(false),
});

export const updateNoticeSchema = createNoticeSchema.partial();

export const noticeResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  audienceRole: noticeAudienceSchema.nullable(),
  createdById: z.string(),
  createdBy: z.object({
    id: z.string(),
    email: z.string(),
    fullName: z.string(),
  }).optional(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CreateNoticeDto = z.input<typeof createNoticeSchema>;
export type UpdateNoticeDto = z.input<typeof updateNoticeSchema>;
export type NoticeResponse = z.input<typeof noticeResponseSchema>;

// What a member sees — no staff details.
export interface MemberNoticeResponse {
  id: string;
  title: string;
  body: string;
  publishedAt: string | Date | null;
}
