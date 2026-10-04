import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import type { MemberStatus } from "@prisma/client";
import type {
  AuthUser,
  LifecycleActionInput,
  MemberResponse,
  StatusHistoryResponse,
} from "@nmms/shared";
import { Role } from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { buildJurisdictionWhere } from "../common/scope.util";
import { MembersService } from "../members/members.service";
import { toMemberResponse } from "../members/member.mapper";

// Membership lifecycle changes remain restricted to Admin and Super Admin.
const CAN_MANAGE_LIFECYCLE: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membersService: MembersService,
  ) {}

  // Registrations awaiting payment, including legacy SUBMITTED rows that can
  // now be activated by completing payment without staff approval.
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

  private assertRole(user: AuthUser, allowed: Role[]) {
    if (!allowed.includes(user.role)) {
      throw new ForbiddenException("You do not have permission to act on this application");
    }
  }

}
