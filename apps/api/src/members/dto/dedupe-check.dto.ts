import { createZodDto } from "nestjs-zod";
import { dedupeCheckSchema } from "@nmms/shared";

export class DedupeCheckDto extends createZodDto(dedupeCheckSchema) {}
