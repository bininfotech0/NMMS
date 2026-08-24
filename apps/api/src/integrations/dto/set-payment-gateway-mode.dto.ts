import { createZodDto } from "nestjs-zod";
import { setPaymentGatewayModeSchema } from "@nmms/shared";

export class SetPaymentGatewayModeDto extends createZodDto(setPaymentGatewayModeSchema) {}
