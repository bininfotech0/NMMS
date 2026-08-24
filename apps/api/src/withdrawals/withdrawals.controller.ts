import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthMember } from "@nmms/shared";
import { CurrentMember } from "../member-auth/decorators/current-member.decorator";
import { MemberJwtAuthGuard } from "../member-auth/guards/member-jwt-auth.guard";
import { WithdrawalsService } from "./withdrawals.service";
import { CreateWithdrawalRequestDto } from "./dto/create-withdrawal-request.dto";

// Own wallet summary + withdrawal requests. Registered before
// WithdrawalsAdminController in withdrawals.module.ts — same "me" vs ":id"
// route-ordering caution as the kyc module.
@ApiTags("withdrawals")
@ApiBearerAuth()
@UseGuards(MemberJwtAuthGuard)
@Controller("withdrawals")
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Get("me/summary")
  getSummary(@CurrentMember() member: AuthMember) {
    return this.withdrawalsService.getWalletSummary(member.id);
  }

  @Get("me/rate")
  getRate(@CurrentMember() member: AuthMember) {
    return this.withdrawalsService.getRate(member.id);
  }

  @Get("me")
  listMine(@CurrentMember() member: AuthMember) {
    return this.withdrawalsService.listMine(member.id);
  }

  @Post("me")
  createRequest(@Body() dto: CreateWithdrawalRequestDto, @CurrentMember() member: AuthMember) {
    return this.withdrawalsService.createRequest(member.id, dto);
  }
}
