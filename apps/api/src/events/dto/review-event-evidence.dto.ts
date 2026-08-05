import { createZodDto } from "nestjs-zod";
import { reviewEventEvidenceSchema } from "@nmms/shared";

export class ReviewEventEvidenceDto extends createZodDto(reviewEventEvidenceSchema) {}
