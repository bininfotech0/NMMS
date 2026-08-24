import { createZodDto } from "nestjs-zod";
import { verifyDonationGatewayPaymentSchema } from "@nmms/shared";

export class VerifyDonationGatewayPaymentDto extends createZodDto(verifyDonationGatewayPaymentSchema) {}
