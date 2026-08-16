import { Module } from "@nestjs/common";
import { KycModule } from "../kyc/kyc.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { CryptoService } from "../common/crypto.service";
import { WithdrawalsController } from "./withdrawals.controller";
import { WithdrawalsAdminController } from "./withdrawals-admin.controller";
import { PayoutWebhookController } from "./payout-webhook.controller";
import { WithdrawalsService } from "./withdrawals.service";
import { PayoutGatewayService } from "./gateway/payout-gateway.service";
import { RazorpayXPayoutProvider } from "./gateway/razorpayx-payout-provider";

@Module({
  imports: [KycModule, IntegrationsModule],
  // WithdrawalsController before WithdrawalsAdminController — see the
  // routing comment on WithdrawalsController for why the order matters.
  controllers: [WithdrawalsController, WithdrawalsAdminController, PayoutWebhookController],
  providers: [WithdrawalsService, PayoutGatewayService, RazorpayXPayoutProvider, CryptoService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
