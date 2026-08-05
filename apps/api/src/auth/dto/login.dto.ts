import { createZodDto } from "nestjs-zod";
import { loginSchema } from "@nmms/shared";

export class LoginDto extends createZodDto(loginSchema) {}
