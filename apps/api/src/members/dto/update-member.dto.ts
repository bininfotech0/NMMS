import { createZodDto } from "nestjs-zod";
import { updateMemberSchema } from "@nmms/shared";

export class UpdateMemberDto extends createZodDto(updateMemberSchema) {}
