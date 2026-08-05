import { createZodDto } from "nestjs-zod";
import { updateOrgSchema } from "@nmms/shared";

export class UpdateOrgDto extends createZodDto(updateOrgSchema) {}
