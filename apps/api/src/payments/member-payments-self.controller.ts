import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthMember } from "@nmms/shared";
import { CurrentMember } from "../member-auth/decorators/current-member.decorator";
import { MemberJwtAuthGuard } from "../member-auth/guards/member-jwt-auth.guard";
import { PaymentsService } from "./payments.service";
import { PaymentGatewayService } from "./gateway/payment-gateway.service";
import { VerifyGatewayPaymentDto } from "./dto/verify-gateway-payment.dto";

// Own payments — registered before MemberPaymentsController in
// payments.module.ts so "GET /members/me/payments" isn't shadowed by
// ":memberId" treating "me" as an id.
@ApiTags("payments")
@ApiBearerAuth()
@UseGuards(MemberJwtAuthGuard)
@Controller("members/me/payments")
export class MemberPaymentsSelfController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymentGatewayService: PaymentGatewayService,
  ) {}

  @Get()
  findMine(@CurrentMember() member: AuthMember) {
    return this.paymentsService.findMine(member.id);
  }

  @Get("gateway/status")
  async gatewayStatus(@CurrentMember() member: AuthMember) {
    return { enabled: await this.paymentGatewayService.isEnabled(member.organizationId) };
  }

  @Post("gateway/order")
  createGatewayOrder(@CurrentMember() member: AuthMember) {
    return this.paymentGatewayService.createOrderForSelf(member);
  }

  @Post("gateway/verify")
  verifyGatewayPayment(@Body() dto: VerifyGatewayPaymentDto, @CurrentMember() member: AuthMember) {
    return this.paymentGatewayService.verifyAndRecordForSelf(member, dto);
  }
}
