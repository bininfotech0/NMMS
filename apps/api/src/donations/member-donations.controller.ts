import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { DonationsService } from "./donations.service";
import { DonationGatewayService } from "./donation-gateway.service";
import { RecordDonationDto } from "./dto/record-donation.dto";
import { CreateDonationOrderDto } from "./dto/create-donation-order.dto";
import { VerifyDonationGatewayPaymentDto } from "./dto/verify-donation-gateway-payment.dto";

// No @Roles() restriction — any staff role (Field Executive included) can
// view or record a member's donations, jurisdiction-scoped via
// buildJurisdictionWhere inside DonationsService, mirrors
// MemberPaymentsController exactly.
@ApiTags("donations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("members/:memberId/donations")
export class MemberDonationsController {
  constructor(
    private readonly donationsService: DonationsService,
    private readonly donationGatewayService: DonationGatewayService,
  ) {}

  @Get()
  findByMember(@Param("memberId") memberId: string, @CurrentUser() user: AuthUser) {
    return this.donationsService.findByMember(memberId, user);
  }

  @Post()
  recordDirect(
    @Param("memberId") memberId: string,
    @Body() dto: RecordDonationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.donationsService.recordDirect(memberId, dto, user);
  }

  // Field Executive/Admin starts an embedded Razorpay checkout on behalf of a
  // donor who's physically present with them but paying by card/UPI rather
  // than handing over cash — the donor still enters their own payment
  // details, staff just facilitates the flow. Jurisdiction-checked inside
  // DonationGatewayService, same scope as recordDirect above.
  @Post("gateway/order")
  createGatewayOrder(
    @Param("memberId") memberId: string,
    @Body() dto: CreateDonationOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.donationGatewayService.createOrderForMember(memberId, user, dto.amount, {
      donorAddress: dto.donorAddress,
      donorPan: dto.donorPan,
    });
  }

  @Post("gateway/verify")
  verifyGatewayPayment(
    @Param("memberId") memberId: string,
    @Body() dto: VerifyDonationGatewayPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.donationGatewayService.verifyAndRecordForMember(memberId, user, dto);
  }

  // Hosted Razorpay link instead of an in-app checkout — for a donor who'd
  // rather complete payment on their own device/time. Reuses
  // CreateDonationOrderDto (same amount/donorAddress/donorPan shape); the
  // resulting Donation is created later by the webhook, not this call.
  @Post("gateway/payment-link")
  createPaymentLink(
    @Param("memberId") memberId: string,
    @Body() dto: CreateDonationOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.donationGatewayService.createPaymentLinkForMember(memberId, user, dto.amount, {
      donorAddress: dto.donorAddress,
      donorPan: dto.donorPan,
    });
  }
}
