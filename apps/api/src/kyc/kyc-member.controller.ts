import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthMember } from "@nmms/shared";
import { CurrentMember } from "../member-auth/decorators/current-member.decorator";
import { MemberJwtAuthGuard } from "../member-auth/guards/member-jwt-auth.guard";
import { KycService } from "./kyc.service";
import { SubmitKycDto } from "./dto/submit-kyc.dto";

// Own KYC status + payout details. Registered before KycAdminController in
// kyc.module.ts so "GET /kyc/me" isn't shadowed by the admin controller's
// "GET /kyc/:memberId" treating "me" as an id.
@ApiTags("kyc")
@ApiBearerAuth()
@UseGuards(MemberJwtAuthGuard)
@Controller("kyc")
export class KycMemberController {
  constructor(private readonly kycService: KycService) {}

  @Get("me")
  getMyKyc(@CurrentMember() member: AuthMember) {
    return this.kycService.getMyKyc(member.id);
  }

  @Put("me")
  submitKyc(@Body() dto: SubmitKycDto, @CurrentMember() member: AuthMember) {
    return this.kycService.submitKyc(member.id, dto);
  }
}
