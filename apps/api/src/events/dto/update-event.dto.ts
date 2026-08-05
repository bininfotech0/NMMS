import { createZodDto } from "nestjs-zod";
import { updateEventSchema } from "@nmms/shared";

export class UpdateEventDto extends createZodDto(updateEventSchema) {}
