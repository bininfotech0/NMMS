import { createZodDto } from "nestjs-zod";
import { submitEventEvidenceSchema } from "@nmms/shared";

export class SubmitEventEvidenceDto extends createZodDto(submitEventEvidenceSchema) {}
