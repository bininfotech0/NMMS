import { createZodDto } from "nestjs-zod";
import { upsertReferralPointRuleMatrixSchema } from "@nmms/shared";

export class UpsertReferralPointRuleMatrixDto extends createZodDto(upsertReferralPointRuleMatrixSchema) {}
