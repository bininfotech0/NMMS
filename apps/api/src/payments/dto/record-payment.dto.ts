import { createZodDto } from "nestjs-zod";
import { recordPaymentSchema } from "@nmms/shared";

export class RecordPaymentDto extends createZodDto(recordPaymentSchema) {}
