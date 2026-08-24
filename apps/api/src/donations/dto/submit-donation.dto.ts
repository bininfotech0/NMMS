import { createZodDto } from "nestjs-zod";
import { submitDonationSchema } from "@nmms/shared";

export class SubmitDonationDto extends createZodDto(submitDonationSchema) {}
