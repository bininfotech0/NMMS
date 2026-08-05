import { createZodDto } from "nestjs-zod";
import { createLookupSchema, updateLookupSchema } from "@nmms/shared";

export class CreateLookupDto extends createZodDto(createLookupSchema) {}
export class UpdateLookupDto extends createZodDto(updateLookupSchema) {}
