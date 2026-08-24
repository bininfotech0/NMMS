import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { DonationsService } from "./donations.service";
import { RecordDonationDto } from "./dto/record-donation.dto";

// No @Roles() restriction — any staff role (Field Executive included) can
// view or record a member's donations, jurisdiction-scoped via
// buildJurisdictionWhere inside DonationsService, mirrors
// MemberPaymentsController exactly.
@ApiTags("donations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("members/:memberId/donations")
export class MemberDonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Get()
  findByMember(@Param("memberId") memberId: string, @CurrentUser() user: AuthUser) {
    return this.donationsService.findByMember(memberId, user);
  }

  @Post()
  recordDirect(
    @Param("memberId") memberId: string,
    @Body() dto: RecordDonationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.donationsService.recordDirect(memberId, dto, user);
  }
}
