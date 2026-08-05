import { createZodDto } from "nestjs-zod";
import { lifecycleActionSchema } from "@nmms/shared";

export class LifecycleActionDto extends createZodDto(lifecycleActionSchema) {}
