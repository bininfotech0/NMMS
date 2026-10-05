import { createZodDto } from "nestjs-zod";
import { memberPasswordResetConfirmSchema, memberPasswordResetRequestSchema } from "@nmms/shared";

export class MemberPasswordResetRequestDto extends createZodDto(memberPasswordResetRequestSchema) {}
export class MemberPasswordResetConfirmDto extends createZodDto(memberPasswordResetConfirmSchema) {}
