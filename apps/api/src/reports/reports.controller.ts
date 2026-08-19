import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role, type AuthUser } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ReportsService } from "./reports.service";

const REVIEWER_ROLES = [Role.ADMIN, Role.SUPER_ADMIN] as const;
// summary() scopes by buildJurisdictionWhere, so a field executive gets back
// only their own members/payments — safe to expose, unlike the detailed
// reports below which return org-wide listings not meant for their view.
const SUMMARY_ROLES = [Role.ADMIN, Role.SUPER_ADMIN, Role.FIELD_EXECUTIVE] as const;

@ApiTags("reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("summary")
  @Roles(...SUMMARY_ROLES)
  summary(@CurrentUser() user: AuthUser) {
    return this.reportsService.summary(user);
  }

  @Get("member-register")
  @Roles(...REVIEWER_ROLES)
  memberRegister(@CurrentUser() user: AuthUser) {
    return this.reportsService.memberRegister(user);
  }

  @Get("pending-approval")
  @Roles(...REVIEWER_ROLES)
  pendingApproval(@CurrentUser() user: AuthUser) {
    return this.reportsService.pendingApproval(user);
  }

  @Get("rejected-applications")
  @Roles(...REVIEWER_ROLES)
  rejectedApplications(@CurrentUser() user: AuthUser) {
    return this.reportsService.rejectedApplications(user);
  }

  @Get("payment-collection")
  @Roles(...REVIEWER_ROLES)
  paymentCollection(@CurrentUser() user: AuthUser) {
    return this.reportsService.paymentCollection(user);
  }

  @Get("renewals")
  @Roles(...REVIEWER_ROLES)
  renewals(@CurrentUser() user: AuthUser) {
    return this.reportsService.renewals(user);
  }

  @Get("branch-wise")
  @Roles(...REVIEWER_ROLES)
  branchWise(@CurrentUser() user: AuthUser) {
    return this.reportsService.branchWise(user);
  }

  @Get("field-executive-performance")
  @Roles(...REVIEWER_ROLES)
  fieldExecutivePerformance(@CurrentUser() user: AuthUser) {
    return this.reportsService.fieldExecutivePerformance(user);
  }

  @Get("revenue-collection")
  @Roles(...REVIEWER_ROLES)
  revenueCollection(@CurrentUser() user: AuthUser) {
    return this.reportsService.revenueCollection(user);
  }
}
