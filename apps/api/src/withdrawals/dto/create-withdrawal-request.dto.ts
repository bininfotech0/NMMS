import { createZodDto } from "nestjs-zod";
import { createWithdrawalRequestSchema } from "@nmms/shared";

export class CreateWithdrawalRequestDto extends createZodDto(createWithdrawalRequestSchema) {}
