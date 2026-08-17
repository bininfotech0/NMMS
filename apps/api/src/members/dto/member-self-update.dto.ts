import { createZodDto } from "nestjs-zod";
import { memberSelfUpdateSchema } from "@nmms/shared";

export class MemberSelfUpdateDto extends createZodDto(memberSelfUpdateSchema) {}
