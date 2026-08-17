import { createZodDto } from "nestjs-zod";
import { auditLogListQuerySchema } from "@nmms/shared";

export class AuditLogListQueryDto extends createZodDto(auditLogListQuerySchema) {}
