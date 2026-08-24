import { createZodDto } from "nestjs-zod";
import { createDonationOrderSchema } from "@nmms/shared";

export class CreateDonationOrderDto extends createZodDto(createDonationOrderSchema) {}
