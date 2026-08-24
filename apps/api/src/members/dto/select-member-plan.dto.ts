import { createZodDto } from "nestjs-zod";
import { selectMemberPlanSchema } from "@nmms/shared";

export class SelectMemberPlanDto extends createZodDto(selectMemberPlanSchema) {}
