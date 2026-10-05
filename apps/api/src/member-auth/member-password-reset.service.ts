import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notifications/notification.service";
import { BLOCKED_STATUSES } from "./blocked-statuses.const";

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_RESET_ATTEMPTS = 5;

const EXPIRED_MESSAGE = "This code has expired or is no longer valid. Please ask for a new code.";

// Forgot-password by SMS for members. The request step never reveals
// whether a mobile number is registered (same answer either way), so it
// can't be used to discover who is a member.
@Injectable()
export class MemberPasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
  ) {}

  async status(): Promise<{ available: boolean }> {
    const organization = await this.prisma.organization.findFirst();
    if (!organization) return { available: false };
    return { available: await this.notifications.isSmsAvailable(organization.id) };
  }

  async requestCode(mobile: string, now: Date = new Date()): Promise<{ sent: true }> {
    const organization = await this.prisma.organization.findFirst();
    if (!organization) {
      throw new NotFoundException("Organization is not configured yet");
    }
    if (!(await this.notifications.isSmsAvailable(organization.id))) {
      throw new ServiceUnavailableException(
        "Password reset by SMS isn't available right now. Please contact the NGO office to reset your password.",
      );
    }

    const member = await this.prisma.member.findFirst({
      where: { organizationId: organization.id, mobile, passwordHash: { not: null } },
      select: { id: true, status: true },
    });
    if (!member || (BLOCKED_STATUSES as readonly string[]).includes(member.status)) {
      return { sent: true };
    }

    const recent = await this.prisma.memberPasswordReset.findFirst({
      where: { memberId: member.id, createdAt: { gt: new Date(now.getTime() - RESEND_COOLDOWN_MS) } },
    });
    if (recent) {
      return { sent: true }; // a code was just sent — don't spam SMS
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    // Any older unused code stops working once a new one is issued.
    await this.prisma.memberPasswordReset.updateMany({
      where: { memberId: member.id, usedAt: null },
      data: { usedAt: now },
    });
    await this.prisma.memberPasswordReset.create({
      data: { memberId: member.id, codeHash: this.hash(member.id, code), expiresAt: new Date(now.getTime() + CODE_TTL_MS) },
    });
    await this.notifications.sendSmsNow(
      organization.id,
      mobile,
      `Your password reset code is ${code}. It works for 10 minutes. Do not share this code with anyone.`,
    );
    return { sent: true };
  }

  async confirm(mobile: string, code: string, newPassword: string, now: Date = new Date()): Promise<{ reset: true }> {
    const organization = await this.prisma.organization.findFirst();
    if (!organization) {
      throw new NotFoundException("Organization is not configured yet");
    }
    const member = await this.prisma.member.findFirst({
      where: { organizationId: organization.id, mobile, passwordHash: { not: null } },
      select: { id: true },
    });
    if (!member) {
      throw new BadRequestException(EXPIRED_MESSAGE);
    }

    const reset = await this.prisma.memberPasswordReset.findFirst({
      where: { memberId: member.id, usedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
    });
    if (!reset || reset.attempts >= MAX_RESET_ATTEMPTS) {
      throw new BadRequestException(EXPIRED_MESSAGE);
    }

    if (!this.matches(reset.codeHash, this.hash(member.id, code))) {
      await this.prisma.memberPasswordReset.update({ where: { id: reset.id }, data: { attempts: { increment: 1 } } });
      const left = MAX_RESET_ATTEMPTS - reset.attempts - 1;
      throw new BadRequestException(
        left > 0
          ? `That code is not right. Please check the SMS and try again (${left} ${left === 1 ? "try" : "tries"} left).`
          : EXPIRED_MESSAGE,
      );
    }

    // Single-use: CAS on usedAt so the same code can't be used twice.
    const cas = await this.prisma.memberPasswordReset.updateMany({
      where: { id: reset.id, usedAt: null },
      data: { usedAt: now },
    });
    if (cas.count === 0) {
      throw new BadRequestException(EXPIRED_MESSAGE);
    }
    await this.prisma.member.update({
      where: { id: member.id },
      data: { passwordHash: await argon2.hash(newPassword) },
    });
    return { reset: true };
  }

  // Keyed hash: the code space is only 10^6, so a plain hash could be
  // reversed offline from a database copy.
  private hash(memberId: string, code: string): string {
    const secret = this.config.getOrThrow<string>("MEMBER_JWT_ACCESS_SECRET");
    return createHmac("sha256", secret).update(`${memberId}:${code}`).digest("hex");
  }

  private matches(a: string, b: string): boolean {
    const ab = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  }
}
