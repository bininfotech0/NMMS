import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser, WithdrawalStatus } from "@nmms/shared";
import { Role } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WithdrawalsService } from "./withdrawals.service";
import { ReviewWithdrawalDto } from "./dto/review-withdrawal.dto";
import { MarkWithdrawalPaidDto } from "./dto/mark-withdrawal-paid.dto";

const CAN_MANAGE_WITHDRAWALS: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

@ApiTags("withdrawals")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("withdrawals")
export class WithdrawalsAdminController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Get()
  @Roles(...CAN_MANAGE_WITHDRAWALS)
  list(@Query("status") status: WithdrawalStatus | undefined, @CurrentUser() user: AuthUser) {
    return this.withdrawalsService.adminList(user.organizationId, status);
  }

  @Get(":id")
  @Roles(...CAN_MANAGE_WITHDRAWALS)
  get(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.withdrawalsService.adminGet(id, user.organizationId);
  }

  @Post(":id/approve")
  @Roles(...CAN_MANAGE_WITHDRAWALS)
  approve(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.withdrawalsService.approve(id, user.organizationId, user.id);
  }

  @Post(":id/reject")
  @Roles(...CAN_MANAGE_WITHDRAWALS)
  reject(@Param("id") id: string, @Body() dto: ReviewWithdrawalDto, @CurrentUser() user: AuthUser) {
    return this.withdrawalsService.reject(id, user.organizationId, user.id, dto.note);
  }

  @Post(":id/mark-paid")
  @Roles(...CAN_MANAGE_WITHDRAWALS)
  markPaid(@Param("id") id: string, @Body() dto: MarkWithdrawalPaidDto, @CurrentUser() user: AuthUser) {
    return this.withdrawalsService.markPaid(id, user.organizationId, user.id, dto.paymentReference);
  }
}
