import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import type { MemberStatus } from "@prisma/client";
import type {
  AuthUser,
  LifecycleActionInput,
  MemberResponse,
  RejectMemberInput,
  StatusHistoryResponse,
} from "@nmms/shared";
import { Role } from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { NumberingService } from "../common/numbering.service";
import { buildJurisdictionWhere } from "../common/scope.util";
import { MembersService } from "../members/members.service";
import { toMemberResponse } from "../members/member.mapper";
import { NotificationService } from "../notifications/notification.service";
import { ReferralsService } from "../referrals/referrals.service";

// One-level approval: ADMIN/SUPER_ADMIN can approve or reject directly — no
// separate verify step.
const CAN_APPROVE: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];
// Admins who can approve a member also manage its full post-activation
// lifecycle (suspend/reactivate/deceased) — same role set as CAN_APPROVE.
const CAN_MANAGE_LIFECYCLE: Role[] = CAN_APPROVE;

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly membersService: MembersService,
    private readonly notifications: NotificationService,
    private readonly referrals: ReferralsService,
  ) {}

  async queue(user: AuthUser): Promise<MemberResponse[]> {
    const members = await this.prisma.member.findMany({
      where: {
        organizationId: user.organizationId,
        status: "SUBMITTED",
        ...buildJurisdictionWhere(user),
      },
      orderBy: { updatedAt: "asc" },
    });
    return members.map(toMemberResponse);
  }

  // Fee was already collected before submission (see PaymentsService), so
  // approval assigns the membership number and activates the member in one
  // step — no separate APPROVED holding state in the persisted status. The
  // StatusHistory trail still records the SUBMITTED → APPROVED → ACTIVE
  // sequence for audit purposes.
  async approve(memberId: string, user: AuthUser): Promise<MemberResponse> {
    const member = await this.getSubmitted(memberId, user);
    this.assertCanApprove(user, member);

    const membershipNumber = await this.numbering.nextMembershipNumber(user.organizationId);
    const approvedAt = new Date();
    const validUntil =
      member.plan?.validityType === "MONTHS" && member.plan.validityMonths
        ? addMonths(member.joiningDate ?? approvedAt, member.plan.validityMonths)
        : null;

    // Interactive transaction so the CAS check and the two StatusHistory
    // writes are atomic: a concurrent duplicate approve() loses the race via
    // updateMany matching zero rows (member no longer SUBMITTED) rather than
    // both requests assigning a membership number.
    const updated = await this.prisma.$transaction(async (tx) => {
      const cas = await tx.member.updateMany({
        where: { id: member.id, status: "SUBMITTED" },
        data: {
          status: "ACTIVE",
          membershipNumber,
          validUntil,
          approvedById: user.id,
          approvedAt,
        },
      });
      if (cas.count === 0) {
        throw new ConflictException("This member's status just changed — please refresh and try again");
      }
      await tx.statusHistory.create({
        data: { memberId: member.id, fromStatus: "SUBMITTED", toStatus: "APPROVED", actorId: user.id },
      });
      await tx.statusHistory.create({
        data: { memberId: member.id, fromStatus: "APPROVED", toStatus: "ACTIVE", actorId: user.id },
      });
      return tx.member.findUniqueOrThrow({ where: { id: member.id } });
    });
    await this.notifications.notify({
      type: "APPROVAL_WELCOME",
      organizationId: user.organizationId,
      memberName: updated.fullName,
      mobile: updated.mobile,
      membershipNumber: updated.membershipNumber,
    });
    await this.referrals.awardPointsForApproval(updated.id);
    return toMemberResponse(updated);
  }

  async reject(memberId: string, dto: RejectMemberInput, user: AuthUser): Promise<MemberResponse> {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, organizationId: user.organizationId, ...buildJurisdictionWhere(user) },
    });
    if (!member || member.status !== "SUBMITTED") {
      throw new ConflictException("Only SUBMITTED members can be rejected");
    }
    this.assertCanApprove(user, member);

    const updated = await this.prisma.member.update({
      where: { id: member.id },
      data: { status: "REJECTED" },
    });
    await this.recordHistory(member.id, member.status, "REJECTED", user.id, dto.remarks);
    return toMemberResponse(updated);
  }

  async suspend(memberId: string, dto: LifecycleActionInput, user: AuthUser): Promise<MemberResponse> {
    this.assertRole(user, CAN_MANAGE_LIFECYCLE);
    return this.transition(memberId, "ACTIVE", "SUSPENDED", dto.remarks, user);
  }

  async reactivate(memberId: string, dto: LifecycleActionInput, user: AuthUser): Promise<MemberResponse> {
    this.assertRole(user, CAN_MANAGE_LIFECYCLE);
    return this.transition(memberId, "SUSPENDED", "ACTIVE", dto.remarks, user);
  }

  async markDeceased(memberId: string, dto: LifecycleActionInput, user: AuthUser): Promise<MemberResponse> {
    this.assertRole(user, CAN_MANAGE_LIFECYCLE);
    const member = await this.prisma.member.findFirst({
      where: {
        id: memberId,
        organizationId: user.organizationId,
        status: { in: ["ACTIVE", "SUSPENDED"] },
        ...buildJurisdictionWhere(user),
      },
    });
    if (!member) {
      throw new ConflictException("Only ACTIVE or SUSPENDED members can be marked deceased");
    }
    const updated = await this.prisma.member.update({
      where: { id: member.id },
      data: { status: "DECEASED" },
    });
    await this.recordHistory(member.id, member.status, "DECEASED", user.id, dto.remarks);
    return toMemberResponse(updated);
  }

  private async transition(
    memberId: string,
    fromStatus: MemberStatus,
    toStatus: MemberStatus,
    remarks: string,
    user: AuthUser,
  ): Promise<MemberResponse> {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, organizationId: user.organizationId, status: fromStatus, ...buildJurisdictionWhere(user) },
    });
    if (!member) {
      throw new ConflictException(`Member is not in ${fromStatus} status`);
    }
    const updated = await this.prisma.member.update({
      where: { id: member.id },
      data: { status: toStatus },
    });
    await this.recordHistory(member.id, fromStatus, toStatus, user.id, remarks);
    return toMemberResponse(updated);
  }

  async history(memberId: string, user: AuthUser): Promise<StatusHistoryResponse[]> {
    await this.membersService.findOne(memberId, user); // authorizes visibility, 404s if out of scope
    const rows = await this.prisma.statusHistory.findMany({
      where: { memberId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      memberId: row.memberId,
      fromStatus: row.fromStatus as StatusHistoryResponse["fromStatus"],
      toStatus: row.toStatus as StatusHistoryResponse["toStatus"],
      remarks: row.remarks,
      actorId: row.actorId,
      createdAt: row.createdAt,
    }));
  }

  private async getSubmitted(memberId: string, user: AuthUser) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, organizationId: user.organizationId, ...buildJurisdictionWhere(user) },
      include: { plan: true },
    });
    if (!member || member.status !== "SUBMITTED") {
      throw new ConflictException("Member is not in SUBMITTED status");
    }
    return member;
  }

  private assertRole(user: AuthUser, allowed: Role[]) {
    if (!allowed.includes(user.role)) {
      throw new ForbiddenException("You do not have permission to act on this application");
    }
  }

  // ADMIN/SUPER_ADMIN can approve/reject anything (unchanged). A
  // FIELD_EXECUTIVE can additionally approve/reject a self-registered member
  // — but only once it's in their own scope, i.e. they claimed it via
  // MembersService.claim (buildJurisdictionWhere already restricted the
  // lookup that produced `member` to createdById === user.id for this role,
  // so reaching this check at all means either they created it directly —
  // not self-registered, not allowed — or they claimed it).
  private assertCanApprove(user: AuthUser, member: { selfRegistered: boolean }) {
    if (CAN_APPROVE.includes(user.role)) {
      return;
    }
    if (user.role === Role.FIELD_EXECUTIVE && member.selfRegistered) {
      return;
    }
    throw new ForbiddenException("You do not have permission to act on this application");
  }

  private recordHistory(
    memberId: string,
    fromStatus: MemberStatus,
    toStatus: MemberStatus,
    actorId: string,
    remarks: string | null,
  ) {
    return this.prisma.statusHistory.create({
      data: { memberId, fromStatus, toStatus, actorId, remarks },
    });
  }
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}
