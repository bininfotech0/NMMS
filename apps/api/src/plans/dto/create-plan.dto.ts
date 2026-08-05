import { createZodDto } from "nestjs-zod";
import { createPlanSchema } from "@nmms/shared";

export class CreatePlanDto extends createZodDto(createPlanSchema) {}
