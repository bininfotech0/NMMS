import { Module } from "@nestjs/common";
import { PlanRewardsService } from "./plan-rewards.service";
import { PlansController } from "./plans.controller";
import { PlansService } from "./plans.service";

@Module({
  controllers: [PlansController],
  providers: [PlansService, PlanRewardsService],
  exports: [PlanRewardsService],
})
export class PlansModule {}
