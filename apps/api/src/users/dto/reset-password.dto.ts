import { createZodDto } from "nestjs-zod";
import { resetPasswordSchema } from "@nmms/shared";

export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
