import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "@nmms/shared";
import { Role } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ReferralsService } from "./referrals.service";
import { UpsertReferralPointRuleMatrixDto } from "./dto/upsert-referral-point-rule-matrix.dto";

// Staff oversight: downline tree, earned rewards, and the referrer leaderboard.
const CAN_VIEW: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];
const CAN_MANAGE: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

@ApiTags("referrals")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("referrals")
export class ReferralsAdminController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get("network/:memberId")
  @Roles(...CAN_VIEW)
  getNetwork(@Param("memberId") memberId: string, @CurrentUser() user: AuthUser) {
    return this.referralsService.getNetwork(memberId, user.organizationId);
  }

  @Post(":memberId/generate-code")
  @Roles(...CAN_MANAGE)
  async generateCode(@Param("memberId") memberId: string, @CurrentUser() user: AuthUser) {
    const referralCode = await this.referralsService.ensureReferralCodeForAdmin(memberId, user.organizationId);
    return { referralCode };
  }

  @Get("rewards")
  @Roles(...CAN_VIEW)
  listRewards(@CurrentUser() user: AuthUser) {
    return this.referralsService.listRewards(user.organizationId);
  }

  @Get("leaderboard")
  @Roles(...CAN_VIEW)
  leaderboard(@CurrentUser() user: AuthUser) {
    return this.referralsService.leaderboard(user.organizationId);
  }

  @Get("point-rules")
  @Roles(...CAN_VIEW)
  listPointRules(@CurrentUser() user: AuthUser) {
    return this.referralsService.listReferralPointRules(user.organizationId);
  }

  @Put("point-rules")
  @Roles(...CAN_MANAGE)
  upsertPointRules(@Body() dto: UpsertReferralPointRuleMatrixDto, @CurrentUser() user: AuthUser) {
    return this.referralsService.upsertReferralPointRuleMatrix(user.organizationId, dto.rules);
  }
}
