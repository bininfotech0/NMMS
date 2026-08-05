import { z } from "zod";
import { Role } from "../enums/role";

export const createNoticeSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  body: z.string().min(10, "Body must be at least 10 characters"),
  audienceRole: z.nativeEnum(Role).nullable().optional(),
  publishNow: z.boolean().default(false),
});

export const updateNoticeSchema = createNoticeSchema.partial();

export const noticeResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  audienceRole: z.nativeEnum(Role).nullable(),
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
