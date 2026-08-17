import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser, KycStatus } from "@nmms/shared";
import { Role } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { KycService } from "./kyc.service";
import { RejectKycDto } from "./dto/reject-kyc.dto";
import { SubmitKycDto } from "./dto/submit-kyc.dto";

const CAN_MANAGE_KYC: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

// Staff review queue: list/inspect KYC submissions, verify/reject, and
// reveal a member's full bank account number for making a manual transfer.
@ApiTags("kyc")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("kyc")
export class KycAdminController {
  constructor(private readonly kycService: KycService) {}

  @Get()
  @Roles(...CAN_MANAGE_KYC)
  list(@Query("status") status: KycStatus | undefined, @CurrentUser() user: AuthUser) {
    return this.kycService.listForAdmin(user.organizationId, status);
  }

  @Get(":memberId")
  @Roles(...CAN_MANAGE_KYC)
  get(@Param("memberId") memberId: string, @CurrentUser() user: AuthUser) {
    return this.kycService.getForAdmin(memberId, user.organizationId);
  }

  // Lets staff enter/correct a member's payout details directly (e.g. a
  // member without internet access, or a typo staff spotted while reviewing)
  // — always lands back in PENDING for a (possibly separate) review, same as
  // a member's own self-submission.
  @Put(":memberId")
  @Roles(...CAN_MANAGE_KYC)
  update(@Param("memberId") memberId: string, @Body() dto: SubmitKycDto, @CurrentUser() user: AuthUser) {
    return this.kycService.updateKycAsAdmin(memberId, user.organizationId, dto);
  }

  @Post(":memberId/verify")
  @Roles(...CAN_MANAGE_KYC)
  verify(@Param("memberId") memberId: string, @CurrentUser() user: AuthUser) {
    return this.kycService.verify(memberId, user.organizationId, user.id);
  }

  @Post(":memberId/reject")
  @Roles(...CAN_MANAGE_KYC)
  reject(@Param("memberId") memberId: string, @Body() dto: RejectKycDto, @CurrentUser() user: AuthUser) {
    return this.kycService.reject(memberId, user.organizationId, user.id, dto.note);
  }

  @Post(":memberId/reveal-bank-account")
  @Roles(...CAN_MANAGE_KYC)
  revealBankAccount(@Param("memberId") memberId: string, @CurrentUser() user: AuthUser) {
    return this.kycService.revealBankAccountNumber(memberId, user.organizationId);
  }
}
