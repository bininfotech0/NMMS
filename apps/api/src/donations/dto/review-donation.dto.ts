import { createZodDto } from "nestjs-zod";
import { reviewDonationSchema } from "@nmms/shared";

export class ReviewDonationDto extends createZodDto(reviewDonationSchema) {}
