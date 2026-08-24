import { z } from "zod";
import { planTierSchema } from "./plan";

// Optional override of pointsReward for a specific plan tier — e.g. the same
// event pays Silver=1pt, Gold=2pt, Platinum=3pt. A tier with no entry falls
// back to the event's base pointsReward.
export const tierRewardOverridesSchema = z.record(planTierSchema, z.number().int().nonnegative());
export type TierRewardOverrides = z.infer<typeof tierRewardOverridesSchema>;

export const eventStatusSchema = z.enum(["PLANNED", "COMPLETED", "CANCELLED"]);
export type EventStatus = z.infer<typeof eventStatusSchema>;

export const eventCompletionStatusSchema = z.enum([
  "NOT_SUBMITTED",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
]);
export type EventCompletionStatus = z.infer<typeof eventCompletionStatusSchema>;

// Host/path check rather than an exact-match regex — tolerant of shorts
// links, mobile app share links, and tracking params like ?si=.
const YOUTUBE_URL_PATTERN = /^https?:\/\/(www\.|m\.)?(youtube\.com\/|youtu\.be\/)/i;
const youtubeUrlSchema = z
  .string()
  .url()
  .refine((v) => YOUTUBE_URL_PATTERN.test(v), { message: "Must be a YouTube URL" })
  .nullish();

export const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullish(),
  location: z.string().nullish(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().nullish(),
  capacity: z.coerce.number().int().positive().nullish(),
  // Informational completion goal (e.g. "Plant 100 saplings") members submit
  // evidence against — see submitEventEvidenceSchema. pointsReward is what's
  // actually credited per approved submission; 0 means no points program for
  // this event (pure RSVP/attendance tracking, same as before this existed).
  targetDescription: z.string().nullish(),
  targetQuantity: z.coerce.number().int().positive().nullish(),
  pointsReward: z.coerce.number().int().nonnegative().optional(),
  tierRewardOverrides: tierRewardOverridesSchema.optional(),
  youtubeUrl: youtubeUrlSchema,
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullish(),
  location: z.string().nullish(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().nullish(),
  capacity: z.coerce.number().int().positive().nullish(),
  status: eventStatusSchema.optional(),
  targetDescription: z.string().nullish(),
  targetQuantity: z.coerce.number().int().positive().nullish(),
  pointsReward: z.coerce.number().int().nonnegative().optional(),
  tierRewardOverrides: tierRewardOverridesSchema.optional(),
  youtubeUrl: youtubeUrlSchema,
});
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const registerMemberSchema = z.object({
  memberId: z.string().min(1),
});
export type RegisterMemberInput = z.infer<typeof registerMemberSchema>;

export const setAttendanceSchema = z.object({
  attended: z.boolean(),
});
export type SetAttendanceInput = z.infer<typeof setAttendanceSchema>;

// Text fields of an evidence submission — the file itself is handled as a
// separate multipart part by the controller (same split as member document
// uploads), not part of this JSON-validated shape.
export const submitEventEvidenceSchema = z.object({
  note: z.string().nullish(),
  quantityAchieved: z.coerce.number().int().nonnegative().nullish(),
});
export type SubmitEventEvidenceInput = z.infer<typeof submitEventEvidenceSchema>;

export const reviewEventEvidenceSchema = z.object({
  approved: z.boolean(),
  note: z.string().nullish(),
});
export type ReviewEventEvidenceInput = z.infer<typeof reviewEventEvidenceSchema>;

export const eventResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  startAt: z.date(),
  endAt: z.date().nullable(),
  capacity: z.number().nullable(),
  status: eventStatusSchema,
  targetDescription: z.string().nullable(),
  targetQuantity: z.number().nullable(),
  pointsReward: z.number(),
  tierRewardOverrides: tierRewardOverridesSchema,
  // Server-computed served URL (e.g. /public/events/{id}/banner) — never the
  // raw storage path.
  bannerImageUrl: z.string().nullable(),
  youtubeUrl: z.string().nullable(),
  createdById: z.string(),
  registrationCount: z.number(),
  attendedCount: z.number(),
  createdAt: z.date(),
});
export type EventResponse = z.infer<typeof eventResponseSchema>;

export const eventRegistrationResponseSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  memberId: z.string(),
  memberName: z.string(),
  memberMobile: z.string(),
  attended: z.boolean(),
  evidenceNote: z.string().nullable(),
  evidenceFileName: z.string().nullable(),
  quantityAchieved: z.number().nullable(),
  completionStatus: eventCompletionStatusSchema,
  reviewedById: z.string().nullable(),
  reviewedAt: z.date().nullable(),
  reviewNote: z.string().nullable(),
  registeredAt: z.date(),
});
export type EventRegistrationResponse = z.infer<typeof eventRegistrationResponseSchema>;

// Own registration status + event details, for the member portal's events list.
export const myEventSummarySchema = z.object({
  eventId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  startAt: z.date(),
  endAt: z.date().nullable(),
  targetDescription: z.string().nullable(),
  targetQuantity: z.number().nullable(),
  pointsReward: z.number(),
  bannerImageUrl: z.string().nullable(),
  youtubeUrl: z.string().nullable(),
  status: eventStatusSchema,
  registered: z.boolean(),
  registrationId: z.string().nullable(),
  completionStatus: eventCompletionStatusSchema.nullable(),
  reviewNote: z.string().nullable(),
});
export type MyEventSummary = z.infer<typeof myEventSummarySchema>;
