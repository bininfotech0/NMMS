import { createZodDto } from "nestjs-zod";
import { markWithdrawalPaidSchema } from "@nmms/shared";

export class MarkWithdrawalPaidDto extends createZodDto(markWithdrawalPaidSchema) {}
