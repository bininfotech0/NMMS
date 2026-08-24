import { createZodDto } from "nestjs-zod";
import { updatePaymentGatewayCredentialsSchema } from "@nmms/shared";

export class UpdatePaymentGatewayCredentialsDto extends createZodDto(updatePaymentGatewayCredentialsSchema) {}
