import { Module } from "@nestjs/common";
import { PlansModule } from "../plans/plans.module";
import { ReferralsController } from "./referrals.controller";
import { ReferralsAdminController } from "./referrals-admin.controller";
import { ReferralsService } from "./referrals.service";

@Module({
  imports: [PlansModule],
  controllers: [ReferralsController, ReferralsAdminController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
