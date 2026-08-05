import { Module } from "@nestjs/common";
import { ReferralsController } from "./referrals.controller";
import { ReferralsAdminController } from "./referrals-admin.controller";
import { ReferralsService } from "./referrals.service";

@Module({
  controllers: [ReferralsController, ReferralsAdminController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
