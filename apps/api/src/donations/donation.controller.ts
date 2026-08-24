import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthMember } from "@nmms/shared";
import { CurrentMember } from "../member-auth/decorators/current-member.decorator";
import { MemberJwtAuthGuard } from "../member-auth/guards/member-jwt-auth.guard";
import { DonationsService } from "./donations.service";
import { DonationGatewayService } from "./donation-gateway.service";
import { SubmitDonationDto } from "./dto/submit-donation.dto";
import { CreateDonationOrderDto } from "./dto/create-donation-order.dto";
import { VerifyDonationGatewayPaymentDto } from "./dto/verify-donation-gateway-payment.dto";

// Own donation submissions — registered before DonationsAdminController in
// donations.module.ts, same "me" vs ":id" route-ordering caution as
// WithdrawalsController.
@ApiTags("donations")
@ApiBearerAuth()
@UseGuards(MemberJwtAuthGuard)
@Controller("donations")
export class DonationController {
  constructor(
    private readonly donationsService: DonationsService,
    private readonly donationGatewayService: DonationGatewayService,
  ) {}

  @Get("me")
  listMine(@CurrentMember() member: AuthMember) {
    return this.donationsService.listMine(member.id);
  }

  @Post("me")
  submitMine(@Body() dto: SubmitDonationDto, @CurrentMember() member: AuthMember) {
    return this.donationsService.submitMine(member.id, dto);
  }

  @Get("me/gateway/status")
  async gatewayStatus(@CurrentMember() member: AuthMember) {
    return { enabled: await this.donationGatewayService.isEnabled(member.organizationId) };
  }

  @Post("me/gateway/order")
  createGatewayOrder(@Body() dto: CreateDonationOrderDto, @CurrentMember() member: AuthMember) {
    return this.donationGatewayService.createOrder(member, dto.amount, {
      donorAddress: dto.donorAddress,
      donorPan: dto.donorPan,
    });
  }

  @Post("me/gateway/verify")
  verifyGatewayPayment(@Body() dto: VerifyDonationGatewayPaymentDto, @CurrentMember() member: AuthMember) {
    return this.donationGatewayService.verifyAndRecord(member, dto);
  }
}
