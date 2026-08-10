import { createZodDto } from "nestjs-zod";
import { rejectKycSchema } from "@nmms/shared";

export class RejectKycDto extends createZodDto(rejectKycSchema) {}
