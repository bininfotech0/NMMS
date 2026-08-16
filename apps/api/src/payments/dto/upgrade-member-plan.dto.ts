import { createZodDto } from "nestjs-zod";
import { upgradeMemberPlanSchema } from "@nmms/shared";

export class UpgradeMemberPlanDto extends createZodDto(upgradeMemberPlanSchema) {}
