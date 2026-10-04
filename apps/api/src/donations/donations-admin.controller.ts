import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser, DonationStatus } from "@nmms/shared";
import { Role } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { DonationsService } from "./donations.service";
import { DonationGatewayService } from "./donation-gateway.service";

// Staff can view donations org-wide or within their jurisdiction.
const CAN_MANAGE_DONATIONS: Role[] = [Role.FIELD_EXECUTIVE, Role.ADMIN, Role.SUPER_ADMIN];

@ApiTags("donations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("donations")
export class DonationsAdminController {
  constructor(
    private readonly donationsService: DonationsService,
    private readonly donationGatewayService: DonationGatewayService,
  ) {}

  // No @Roles() restriction — matches PaymentsController.gatewayStatus, any
  // authenticated staff can check whether the "Pay Online" option should show.
  @Get("gateway/status")
  async gatewayStatus(@CurrentUser() user: AuthUser) {
    return { enabled: await this.donationGatewayService.isEnabled(user.organizationId) };
  }

  @Get()
  @Roles(...CAN_MANAGE_DONATIONS)
  list(@Query("status") status: DonationStatus | undefined, @CurrentUser() user: AuthUser) {
    return this.donationsService.adminList(user.organizationId, user, status);
  }

  @Get(":id")
  @Roles(...CAN_MANAGE_DONATIONS)
  get(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.donationsService.adminGet(id, user.organizationId, user);
  }

}
