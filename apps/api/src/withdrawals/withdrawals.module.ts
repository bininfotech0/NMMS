import { Module } from "@nestjs/common";
import { KycModule } from "../kyc/kyc.module";
import { WithdrawalsController } from "./withdrawals.controller";
import { WithdrawalsAdminController } from "./withdrawals-admin.controller";
import { WithdrawalsService } from "./withdrawals.service";

@Module({
  imports: [KycModule],
  // WithdrawalsController before WithdrawalsAdminController — see the
  // routing comment on WithdrawalsController for why the order matters.
  controllers: [WithdrawalsController, WithdrawalsAdminController],
  providers: [WithdrawalsService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
