import { createZodDto } from "nestjs-zod";
import { createUserSchema } from "@nmms/shared";

export class CreateUserDto extends createZodDto(createUserSchema) {}
