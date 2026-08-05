import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser, GatewayStatusResponse } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PaymentsService } from "./payments.service";
import { PaymentGatewayService } from "./gateway/payment-gateway.service";

@ApiTags("payments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("payments")
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymentGatewayService: PaymentGatewayService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.paymentsService.findAll(user);
  }

  @Get("outstanding")
  outstanding(@CurrentUser() user: AuthUser) {
    return this.paymentsService.outstanding(user);
  }

  @Get("gateway/status")
  async gatewayStatus(@CurrentUser() user: AuthUser): Promise<GatewayStatusResponse> {
    return { enabled: await this.paymentGatewayService.isEnabled(user.organizationId) };
  }
}
