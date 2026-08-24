import { createZodDto } from "nestjs-zod";
import { recordDonationSchema } from "@nmms/shared";

export class RecordDonationDto extends createZodDto(recordDonationSchema) {}
