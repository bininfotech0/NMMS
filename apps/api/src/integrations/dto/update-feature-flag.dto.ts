import { createZodDto } from "nestjs-zod";
import { updateFeatureFlagSchema } from "@nmms/shared";

export class UpdateFeatureFlagDto extends createZodDto(updateFeatureFlagSchema) {}
