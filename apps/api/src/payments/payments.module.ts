import { Module } from "@nestjs/common";
import { NumberingService } from "../common/numbering.service";
import { MembersModule } from "../members/members.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { MemberPaymentsController } from "./member-payments.controller";
import { PaymentsController } from "./payments.controller";
import { PaymentWebhookController } from "./payment-webhook.controller";
import { PaymentsService } from "./payments.service";
import { PaymentGatewayService } from "./gateway/payment-gateway.service";
import { RazorpayProvider } from "./gateway/razorpay-provider";

@Module({
  imports: [MembersModule, NotificationsModule, IntegrationsModule],
  controllers: [MemberPaymentsController, PaymentsController, PaymentWebhookController],
  providers: [PaymentsService, NumberingService, PaymentGatewayService, RazorpayProvider],
})
export class PaymentsModule {}
