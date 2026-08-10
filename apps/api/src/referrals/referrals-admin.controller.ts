import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser, RewardStatus } from "@nmms/shared";
import { Role } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ReferralsService } from "./referrals.service";
import { FulfillRewardDto } from "./dto/fulfill-reward.dto";
import { UpsertReferralPointRuleMatrixDto } from "./dto/upsert-referral-point-rule-matrix.dto";

// Staff oversight: downline tree, org-wide reward queue + fulfillment, and the
// referrer leaderboard. Same role set used for approvals elsewhere
// (ApplicationsService.CAN_APPROVE).
const CAN_VIEW: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];
const CAN_FULFILL: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

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
  @Roles(...CAN_FULFILL)
  async generateCode(@Param("memberId") memberId: string, @CurrentUser() user: AuthUser) {
    const referralCode = await this.referralsService.ensureReferralCodeForAdmin(memberId, user.organizationId);
    return { referralCode };
  }

  @Get("rewards")
  @Roles(...CAN_VIEW)
  listRewards(@Query("status") status: RewardStatus | undefined, @CurrentUser() user: AuthUser) {
    return this.referralsService.listRewards(user.organizationId, status);
  }

  @Post("rewards/:id/fulfill")
  @Roles(...CAN_FULFILL)
  fulfillReward(@Param("id") id: string, @Body() dto: FulfillRewardDto, @CurrentUser() user: AuthUser) {
    return this.referralsService.fulfillReward(id, user.organizationId, user.id, dto.note);
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
  @Roles(...CAN_FULFILL)
  upsertPointRules(@Body() dto: UpsertReferralPointRuleMatrixDto, @CurrentUser() user: AuthUser) {
    return this.referralsService.upsertReferralPointRuleMatrix(user.organizationId, dto.rules);
  }
}
