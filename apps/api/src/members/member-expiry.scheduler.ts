import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { MemberAuthService } from "../member-auth/member-auth.service";

// First scheduled job in the repo — a lapsed ACTIVE member (validUntil in
// the past) otherwise stays ACTIVE forever; nothing else ever revisits it.
// CAS'd per-member so a renewal payment racing this job can't be clobbered:
// if the member already moved off ACTIVE between the findMany and the
// update, the update matches zero rows and is silently skipped.
@Injectable()
export class MemberExpiryScheduler {
  private readonly logger = new Logger(MemberExpiryScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly memberAuth: MemberAuthService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async expireOverdueMembers(): Promise<void> {
    const overdue = await this.prisma.member.findMany({
      where: { status: "ACTIVE", validUntil: { lt: new Date() } },
      select: { id: true, organizationId: true },
    });
    if (overdue.length === 0) {
      return;
    }

    let expired = 0;
    for (const m of overdue) {
      const actorId = await this.memberAuth.getOrCreateSystemUser(m.organizationId);
      const cas = await this.prisma.member.updateMany({
        where: { id: m.id, status: "ACTIVE" },
        data: { status: "EXPIRED" },
      });
      if (cas.count === 0) {
        continue; // renewed or otherwise transitioned since the findMany above
      }
      await this.prisma.statusHistory.create({
        data: { memberId: m.id, fromStatus: "ACTIVE", toStatus: "EXPIRED", actorId },
      });
      expired++;
    }
    this.logger.log(`Expired ${expired} overdue member(s) of ${overdue.length} candidate(s)`);
  }
}
