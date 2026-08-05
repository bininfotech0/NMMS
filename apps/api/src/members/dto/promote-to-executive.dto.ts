import { createZodDto } from "nestjs-zod";
import { promoteToExecutiveSchema } from "@nmms/shared";

export class PromoteToExecutiveDto extends createZodDto(promoteToExecutiveSchema) {}
