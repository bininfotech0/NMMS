import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { FeatureFlagKey } from "@prisma/client";
import { Role, type AuthUser } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { UpdateFeatureFlagDto } from "./dto/update-feature-flag.dto";
import { UpdatePaymentGatewayCredentialsDto } from "./dto/update-payment-gateway-credentials.dto";
import { SetPaymentGatewayModeDto } from "./dto/set-payment-gateway-mode.dto";
import { IntegrationsService } from "./integrations.service";

const CAN_MANAGE_INTEGRATIONS = [Role.SUPER_ADMIN, Role.ADMIN];

@ApiTags("integrations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("integrations")
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.integrationsService.findAll(user.organizationId);
  }

  // Two path segments — never shadowed by the single-segment ":key" route
  // below regardless of declaration order.
  @Get("payment-gateway/credentials-status")
  @UseGuards(RolesGuard)
  @Roles(...CAN_MANAGE_INTEGRATIONS)
  getPaymentGatewayCredentialsStatus(@CurrentUser() user: AuthUser) {
    return this.integrationsService.getPaymentGatewayCredentialsStatus(user.organizationId);
  }

  @Patch("payment-gateway/credentials")
  @UseGuards(RolesGuard)
  @Roles(...CAN_MANAGE_INTEGRATIONS)
  updatePaymentGatewayCredentials(
    @Body() dto: UpdatePaymentGatewayCredentialsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.integrationsService.updatePaymentGatewayCredentials(dto.mode, dto.credentials, user.organizationId);
  }

  @Patch("payment-gateway/mode")
  @UseGuards(RolesGuard)
  @Roles(...CAN_MANAGE_INTEGRATIONS)
  setPaymentGatewayMode(@Body() dto: SetPaymentGatewayModeDto, @CurrentUser() user: AuthUser) {
    return this.integrationsService.setPaymentGatewayMode(dto.mode, user.organizationId);
  }

  @Patch(":key")
  @UseGuards(RolesGuard)
  @Roles(...CAN_MANAGE_INTEGRATIONS)
  update(
    @Param("key") key: string,
    @Body() dto: UpdateFeatureFlagDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.integrationsService.update(key as FeatureFlagKey, dto, user.organizationId);
  }
}
