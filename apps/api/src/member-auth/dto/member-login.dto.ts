import { createZodDto } from "nestjs-zod";
import { memberLoginSchema } from "@nmms/shared";

export class MemberLoginDto extends createZodDto(memberLoginSchema) {}
