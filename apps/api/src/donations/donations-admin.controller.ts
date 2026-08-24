import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser, DonationStatus } from "@nmms/shared";
import { Role } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { DonationsService } from "./donations.service";
import { ReviewDonationDto } from "./dto/review-donation.dto";

// Deliberately includes FIELD_EXECUTIVE — diverging from the withdrawal/KYC
// precedent (ADMIN/SUPER_ADMIN-only review) per explicit product requirement
// that a Field Executive can approve a member-submitted donation, not just
// record one received directly (MemberDonationsController.recordDirect).
const CAN_MANAGE_DONATIONS: Role[] = [Role.FIELD_EXECUTIVE, Role.ADMIN, Role.SUPER_ADMIN];

@ApiTags("donations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("donations")
export class DonationsAdminController {
  constructor(private readonly donationsService: DonationsService) {}

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

  @Post(":id/approve")
  @Roles(...CAN_MANAGE_DONATIONS)
  approve(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.donationsService.approve(id, user.organizationId, user.id, user);
  }

  @Post(":id/reject")
  @Roles(...CAN_MANAGE_DONATIONS)
  reject(@Param("id") id: string, @Body() dto: ReviewDonationDto, @CurrentUser() user: AuthUser) {
    return this.donationsService.reject(id, user.organizationId, user.id, dto.note, user);
  }
}
