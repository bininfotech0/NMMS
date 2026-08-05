import { createZodDto } from "nestjs-zod";
import { rejectMemberSchema } from "@nmms/shared";

export class RejectMemberDto extends createZodDto(rejectMemberSchema) {}
