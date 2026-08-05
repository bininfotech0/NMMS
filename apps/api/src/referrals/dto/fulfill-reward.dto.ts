import { createZodDto } from "nestjs-zod";
import { fulfillRewardSchema } from "@nmms/shared";

export class FulfillRewardDto extends createZodDto(fulfillRewardSchema) {}
