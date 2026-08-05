import { createZodDto } from "nestjs-zod";
import { memberRegisterSchema } from "@nmms/shared";

export class MemberRegisterDto extends createZodDto(memberRegisterSchema) {}
