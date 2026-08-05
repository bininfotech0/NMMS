import { createZodDto } from "nestjs-zod";
import { registerMemberSchema } from "@nmms/shared";

export class RegisterMemberDto extends createZodDto(registerMemberSchema) {}
