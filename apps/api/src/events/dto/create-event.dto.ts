import { createZodDto } from "nestjs-zod";
import { createEventSchema } from "@nmms/shared";

export class CreateEventDto extends createZodDto(createEventSchema) {}
