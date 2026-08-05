import { createZodDto } from "nestjs-zod";
import { createMemberSchema } from "@nmms/shared";

export class CreateMemberDto extends createZodDto(createMemberSchema) {}
