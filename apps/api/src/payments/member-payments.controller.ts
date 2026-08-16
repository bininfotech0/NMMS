import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "@nmms/shared";
import { Role } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { UpgradeMemberPlanDto } from "./dto/upgrade-member-plan.dto";
import { VerifyGatewayPaymentDto } from "./dto/verify-gateway-payment.dto";
import { PaymentsService } from "./payments.service";
import { PaymentGatewayService } from "./gateway/payment-gateway.service";

const CAN_UPGRADE_PLAN: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

@ApiTags("payments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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

  @Post("upgrade-plan")
  @Roles(...CAN_UPGRADE_PLAN)
  upgradePlan(
    @Param("memberId") memberId: string,
    @Body() dto: UpgradeMemberPlanDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.upgradePlan(memberId, dto, user);
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
