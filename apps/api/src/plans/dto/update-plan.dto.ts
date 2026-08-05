import { createZodDto } from "nestjs-zod";
import { updatePlanSchema } from "@nmms/shared";

export class UpdatePlanDto extends createZodDto(updatePlanSchema) {}
