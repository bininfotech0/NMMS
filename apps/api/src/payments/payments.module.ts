import { Module } from "@nestjs/common";
import { NumberingService } from "../common/numbering.service";
import { MembersModule } from "../members/members.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { ReferralsModule } from "../referrals/referrals.module";
import { MemberPaymentsController } from "./member-payments.controller";
import { MemberPaymentsSelfController } from "./member-payments-self.controller";
import { PaymentsController } from "./payments.controller";
import { PaymentWebhookController } from "./payment-webhook.controller";
import { PaymentsService } from "./payments.service";
import { PaymentGatewayService } from "./gateway/payment-gateway.service";
import { RazorpayProvider } from "./gateway/razorpay-provider";

@Module({
  imports: [MembersModule, NotificationsModule, IntegrationsModule, ReferralsModule],
  // MemberPaymentsSelfController ("members/me/payments") registered before
  // MemberPaymentsController ("members/:memberId/payments") so "me" isn't
  // shadowed by ":memberId".
  controllers: [MemberPaymentsSelfController, MemberPaymentsController, PaymentsController, PaymentWebhookController],
  providers: [PaymentsService, NumberingService, PaymentGatewayService, RazorpayProvider],
})
export class PaymentsModule {}
