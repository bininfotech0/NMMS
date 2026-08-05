import { createZodDto } from "nestjs-zod";
import { updateUserSchema } from "@nmms/shared";

export class UpdateUserDto extends createZodDto(updateUserSchema) {}
