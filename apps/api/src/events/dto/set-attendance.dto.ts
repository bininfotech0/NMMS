import { createZodDto } from "nestjs-zod";
import { setAttendanceSchema } from "@nmms/shared";

export class SetAttendanceDto extends createZodDto(setAttendanceSchema) {}
