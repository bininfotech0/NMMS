import { createZodDto } from "nestjs-zod";
import { submitKycSchema } from "@nmms/shared";

export class SubmitKycDto extends createZodDto(submitKycSchema) {}
