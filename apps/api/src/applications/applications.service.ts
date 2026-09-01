import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import type { MemberStatus } from "@prisma/client";
import type {
  AuthUser,
  LifecycleActionInput,
  MemberResponse,
  PlanTier,
  RejectMemberInput,
  StatusHistoryResponse,
} from "@nmms/shared";
import { Role } from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { NumberingService } from "../common/numbering.service";
import { buildJurisdictionWhere } from "../common/scope.util";
import { MembersService } from "../members/members.service";
import { toMemberResponse } from "../members/member.mapper";
import { activateMemberOnce } from "../members/member-activation.util";
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

  // Registrations awaiting payment (the standard pre-activation state since
  // the form-first/payment-last redesign) plus any legacy SUBMITTED rows
  // predating it, so staff have one place to see and reject either kind.
  async queue(user: AuthUser): Promise<MemberResponse[]> {
    const members = await this.prisma.member.findMany({
      where: {
        organizationId: user.organizationId,
        status: { in: ["AWAITING_PAYMENT", "SUBMITTED"] },
        ...buildJurisdictionWhere(user),
      },
      orderBy: { updatedAt: "asc" },
    });
    return members.map(toMemberResponse);
  }

  // A manual/admin-override activation path, kept for legacy SUBMITTED rows
  // predating the form-first/payment-last redesign (see PaymentsService,
  // which now auto-activates a member straight from AWAITING_PAYMENT on
  // successful payment — the standard path for every new registration).
  async approve(memberId: string, user: AuthUser): Promise<MemberResponse> {
    const member = await this.getSubmitted(memberId, user);
    this.assertCanApprove(user, member);

    // Interactive transaction so the CAS check, membership-number
    // assignment, and StatusHistory write are atomic: a concurrent duplicate
    // approve() loses the race cleanly (member no longer SUBMITTED) instead
    // of both requests assigning a membership number.
    const updated = await this.prisma.$transaction(async (tx) => {
      const activation = await activateMemberOnce(tx, this.numbering, member, member.plan, "SUBMITTED", user.id);
      if (!activation) {
        throw new ConflictException("This member's status just changed — please refresh and try again");
      }
      await this.referrals.awardBatchRewardForTier(
        tx,
        user.organizationId,
        member.id,
        (member.plan?.tier as PlanTier | null) ?? null,
        member.referralPointsBalance,
      );
      return tx.member.findUniqueOrThrow({ where: { id: member.id } });
    });
    await this.notifications.notify({
      type: "APPROVAL_WELCOME",
      organizationId: user.organizationId,
      memberName: updated.fullName,
      mobile: updated.mobile,
      email: updated.email,
      membershipNumber: updated.membershipNumber,
    });
    await this.referrals.awardPointsForApproval(updated.id);
    return toMemberResponse(updated);
  }

  // Accepts AWAITING_PAYMENT (the standard pre-activation state — this is
  // the fraud-prevention backstop now that payment auto-activates with no
  // manual approval) as well as legacy SUBMITTED rows predating that redesign.
  async reject(memberId: string, dto: RejectMemberInput, user: AuthUser): Promise<MemberResponse> {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, organizationId: user.organizationId, ...buildJurisdictionWhere(user) },
    });
    if (!member || (member.status !== "AWAITING_PAYMENT" && member.status !== "SUBMITTED")) {
      throw new ConflictException("Only AWAITING_PAYMENT or SUBMITTED members can be rejected");
    }
    this.assertCanApprove(user, member);
    const fromStatus = member.status;

    // Compare-and-swap inside an interactive transaction: two concurrent
    // rejects both pass the status read above, but only one updateMany can
    // match the row — the loser fails cleanly instead of double-writing
    // StatusHistory.
    const updated = await this.prisma.$transaction(async (tx) => {
      const cas = await tx.member.updateMany({
        where: { id: member.id, status: fromStatus },
        data: { status: "REJECTED" },
      });
      if (cas.count === 0) {
        throw new ConflictException("This member's status just changed — please refresh and try again");
      }
      await tx.statusHistory.create({
        data: {
          memberId: member.id,
          fromStatus,
          toStatus: "REJECTED",
          actorId: user.id,
          remarks: dto.remarks,
        },
      });
      return tx.member.findUniqueOrThrow({ where: { id: member.id } });
    });
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
    // CAS on the ACTIVE-or-SUSPENDED precondition: the pre-read member could
    // be either, so the history's fromStatus comes from that read while the
    // updateMany guards against a concurrent transition racing us.
    const updated = await this.prisma.$transaction(async (tx) => {
      const cas = await tx.member.updateMany({
        where: { id: member.id, status: { in: ["ACTIVE", "SUSPENDED"] } },
        data: { status: "DECEASED" },
      });
      if (cas.count === 0) {
        throw new ConflictException("This member's status just changed — please refresh and try again");
      }
      await tx.statusHistory.create({
        data: {
          memberId: member.id,
          fromStatus: member.status,
          toStatus: "DECEASED",
          actorId: user.id,
          remarks: dto.remarks,
        },
      });
      return tx.member.findUniqueOrThrow({ where: { id: member.id } });
    });
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
    // Compare-and-swap inside an interactive transaction so a concurrent
    // suspend/reactivate can't double-write StatusHistory or act on a status
    // that changed since the read above.
    const updated = await this.prisma.$transaction(async (tx) => {
      const cas = await tx.member.updateMany({
        where: { id: member.id, status: fromStatus },
        data: { status: toStatus },
      });
      if (cas.count === 0) {
        throw new ConflictException("This member's status just changed — please refresh and try again");
      }
      await tx.statusHistory.create({
        data: { memberId: member.id, fromStatus, toStatus, actorId: user.id, remarks },
      });
      return tx.member.findUniqueOrThrow({ where: { id: member.id } });
    });
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
}
