import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { MemberAuthService } from "../member-auth/member-auth.service";
import { NotificationService } from "../notifications/notification.service";

// Days before the end date on which members get a "your membership ends
// soon" message. Renewal resets validity from the payment date (see
// PaymentsService.finalizePayment), so these only warn — the member renews
// once it has ended.
export const EXPIRY_REMINDER_DAYS = [30, 7, 1] as const;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Start of the India-time calendar day that is `daysAhead` days from `now`,
// as a UTC Date — so "ends in 7 days" means the same calendar day for the
// member regardless of the server's timezone.
export function istDayStart(now: Date, daysAhead: number): Date {
  const istMidnight = Math.floor((now.getTime() + IST_OFFSET_MS) / DAY_MS) * DAY_MS;
  return new Date(istMidnight - IST_OFFSET_MS + daysAhead * DAY_MS);
}

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
    private readonly notifications: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async expireOverdueMembers(): Promise<void> {
    const overdue = await this.prisma.member.findMany({
      where: { status: "ACTIVE", validUntil: { lt: new Date() } },
      select: { id: true, organizationId: true, fullName: true, mobile: true, email: true },
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
      // Best-effort (NotificationService never throws) — tells the member how to renew.
      await this.notifications.notify({
        type: "MEMBERSHIP_EXPIRED",
        organizationId: m.organizationId,
        memberName: m.fullName,
        mobile: m.mobile,
        email: m.email,
      });
      expired++;
    }
    this.logger.log(`Expired ${expired} overdue member(s) of ${overdue.length} candidate(s)`);
  }

  // Runs once a day at 10:00 India time. Each reminder targets members whose
  // end date falls on one exact calendar day, so a member gets each of the
  // 30/7/1-day reminders once without needing a "sent" flag.
  @Cron("0 10 * * *", { timeZone: "Asia/Kolkata" })
  async sendExpiryReminders(now: Date = new Date()): Promise<void> {
    let sent = 0;
    for (const daysLeft of EXPIRY_REMINDER_DAYS) {
      const members = await this.prisma.member.findMany({
        where: {
          status: "ACTIVE",
          validUntil: { gte: istDayStart(now, daysLeft), lt: istDayStart(now, daysLeft + 1) },
        },
        select: { organizationId: true, fullName: true, mobile: true, email: true, validUntil: true },
      });
      for (const m of members) {
        if (!m.validUntil) continue;
        await this.notifications.notify({
          type: "MEMBERSHIP_EXPIRING",
          organizationId: m.organizationId,
          memberName: m.fullName,
          mobile: m.mobile,
          email: m.email,
          daysLeft,
          validUntil: m.validUntil,
        });
        sent++;
      }
    }
    if (sent > 0) {
      this.logger.log(`Sent ${sent} membership expiry reminder(s)`);
    }
  }
}
