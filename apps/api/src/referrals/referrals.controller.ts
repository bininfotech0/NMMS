import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthMember } from "@nmms/shared";
import { CurrentMember } from "../member-auth/decorators/current-member.decorator";
import { MemberJwtAuthGuard } from "../member-auth/guards/member-jwt-auth.guard";
import { ReferralsService } from "./referrals.service";

// Own referral dashboard — a member's own code/link, wallet balance, rank,
// direct referrals, ledger, and rewards.
@ApiTags("referrals")
@ApiBearerAuth()
@UseGuards(MemberJwtAuthGuard)
@Controller("referrals")
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get("me")
  getMySummary(@CurrentMember() member: AuthMember) {
    return this.referralsService.getMySummary(member.id);
  }

  @Get("me/ledger")
  getMyLedger(@CurrentMember() member: AuthMember) {
    return this.referralsService.getMyLedger(member.id);
  }

  @Get("me/rewards")
  getMyRewards(@CurrentMember() member: AuthMember) {
    return this.referralsService.getMyRewards(member.id);
  }
}
