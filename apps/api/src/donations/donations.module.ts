import { Module } from "@nestjs/common";
import { ReferralsModule } from "../referrals/referrals.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { NumberingService } from "../common/numbering.service";
import { RazorpayProvider } from "../payments/gateway/razorpay-provider";
import { DonationController } from "./donation.controller";
import { DonationsAdminController } from "./donations-admin.controller";
import { MemberDonationsController } from "./member-donations.controller";
import { DonationsService } from "./donations.service";
import { DonationGatewayService } from "./donation-gateway.service";

@Module({
  imports: [ReferralsModule, IntegrationsModule],
  // DonationController ("donations/me") registered before
  // DonationsAdminController ("donations/:id") so "me" isn't shadowed by
  // ":id" — same route-order caution as WithdrawalsModule.
  controllers: [DonationController, DonationsAdminController, MemberDonationsController],
  providers: [DonationsService, DonationGatewayService, NumberingService, RazorpayProvider],
})
export class DonationsModule {}
