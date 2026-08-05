import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { VerifyGatewayPaymentDto } from "./dto/verify-gateway-payment.dto";
import { PaymentsService } from "./payments.service";
import { PaymentGatewayService } from "./gateway/payment-gateway.service";

@ApiTags("payments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("members/:memberId/payments")
export class MemberPaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymentGatewayService: PaymentGatewayService,
  ) {}

  @Get()
  findByMember(@Param("memberId") memberId: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.findByMember(memberId, user);
  }

  @Post()
  recordPayment(
    @Param("memberId") memberId: string,
    @Body() dto: RecordPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.recordPayment(memberId, dto, user);
  }

  @Post("gateway/order")
  createGatewayOrder(@Param("memberId") memberId: string, @CurrentUser() user: AuthUser) {
    return this.paymentGatewayService.createOrder(memberId, user);
  }

  @Post("gateway/verify")
  verifyGatewayPayment(
    @Param("memberId") memberId: string,
    @Body() dto: VerifyGatewayPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentGatewayService.verifyAndRecord(memberId, dto, user);
  }
}
