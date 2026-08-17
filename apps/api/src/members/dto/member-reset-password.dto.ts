import { createZodDto } from "nestjs-zod";
import { resetPasswordSchema } from "@nmms/shared";

// Reuses the staff-user reset-password schema — identical shape
// ({ newPassword: string, min 8 }), no reason to duplicate it for members.
export class MemberResetPasswordDto extends createZodDto(resetPasswordSchema) {}
