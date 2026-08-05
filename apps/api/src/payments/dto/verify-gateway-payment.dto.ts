import { createZodDto } from "nestjs-zod";
import { verifyGatewayPaymentSchema } from "@nmms/shared";

export class VerifyGatewayPaymentDto extends createZodDto(verifyGatewayPaymentSchema) {}
