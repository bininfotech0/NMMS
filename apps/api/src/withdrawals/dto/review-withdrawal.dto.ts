import { createZodDto } from "nestjs-zod";
import { reviewWithdrawalSchema } from "@nmms/shared";

export class ReviewWithdrawalDto extends createZodDto(reviewWithdrawalSchema) {}
