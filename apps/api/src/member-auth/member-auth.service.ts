import { randomBytes } from "node:crypto";
import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { Prisma } from "@prisma/client";
import type { AuthMember, MemberRegisterInput, ResolveReferralCodeResponse } from "@nmms/shared";
import { Role } from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { NumberingService } from "../common/numbering.service";
import { AadhaarHashService } from "../common/aadhaar-hash.service";
import { BLOCKED_STATUSES } from "./blocked-statuses.const";

// Sentinel account attributed as Member.createdById for self-registered
// members (createdById is NOT NULL and there's no staff user to point to).
// isActive: false means it can never log in via the staff /auth/login route.
const SYSTEM_USER_EMAIL_PREFIX = "self-registration+";
const SYSTEM_USER_EMAIL_SUFFIX = "@system.nmms.internal";

@Injectable()
export class MemberAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly numbering: NumberingService,
    private readonly aadhaar: AadhaarHashService,
  ) {}

  async register(dto: MemberRegisterInput): Promise<AuthMember> {
    const org = await this.prisma.organization.findFirst();
    if (!org) {
      throw new NotFoundException("Organization is not configured yet");
    }

    const existingPortalAccount = await this.prisma.member.findFirst({
      where: { organizationId: org.id, mobile: dto.mobile, passwordHash: { not: null } },
    });
    if (existingPortalAccount) {
      throw new ConflictException("An account with this mobile number is already registered — please log in");
    }

    // Also catches a mobile match against a staff-entered record with no
    // portal password yet (e.g. a field executive's in-person DRAFT) — the
    // check above only fires once a password exists, so without this a
    // second, disconnected Member row could be created for someone staff
    // already has on file.
    const existingMobileDraft = await this.prisma.member.findFirst({
      where: { organizationId: org.id, mobile: dto.mobile, passwordHash: null, status: { not: "REJECTED" } },
    });
    if (existingMobileDraft) {
      throw new ConflictException(
        "This mobile number is already on file with your organization — please contact your field executive to complete your registration",
      );
    }

    // Aadhaar is the strongest identity signal this form collects — a 12-digit
    // match to an existing member (staff-entered draft or otherwise) is
    // effectively never a coincidence, unlike mobile (which the check above
    // only catches once a portal password exists). Blocks the public form
    // from creating a second, disconnected Member row for someone a field
    // executive already registered in person but who hasn't set a password yet.
    const aadhaarHash = this.aadhaar.hash(dto.aadhaarNumber);
    const existingByAadhaar = await this.prisma.member.findFirst({
      where: { organizationId: org.id, aadhaarHash, status: { not: "REJECTED" } },
    });
    if (existingByAadhaar) {
      throw new ConflictException(
        "A member with this Aadhaar number is already registered — please contact your field executive or log in if you already have an account",
      );
    }

    let referralMemberId: string | undefined;
    if (dto.referralCode) {
      const referrer = await this.prisma.member.findFirst({
        where: { organizationId: org.id, referralCode: dto.referralCode },
      });
      // A referrer who's since become ineligible (matches MembersService.
      // assertReferrerValid / ReferralsService.awardPointsForApproval) should
      // stop accepting new signups on their link, not silently keep working
      // forever with the referral never actually paying out.
      if (!referrer || (BLOCKED_STATUSES as readonly string[]).includes(referrer.status)) {
        throw new NotFoundException("Referral code not found");
      }
      referralMemberId = referrer.id;
    }

    const [systemUserId, registrationNumber, passwordHash] = await Promise.all([
      this.getOrCreateSystemUser(org.id),
      this.numbering.nextRegistrationNumber(org.id),
      argon2.hash(dto.password),
    ]);

    const member = await this.prisma.member.create({
      data: {
        organizationId: org.id,
        fullName: dto.fullName,
        mobile: dto.mobile,
        email: dto.email ?? null,
        aadhaarHash,
        aadhaarLast4: this.aadhaar.last4(dto.aadhaarNumber),
        passwordHash,
        referralMemberId,
        selfRegistered: true,
        createdById: systemUserId,
        registrationNumber,
        registrationMode: "ONLINE",
        registeredAt: new Date(),
      },
    });
    return this.toAuthMember(member);
  }

  async validateCredentials(mobile: string, password: string): Promise<AuthMember> {
    const member = await this.prisma.member.findFirst({
      where: { mobile, passwordHash: { not: null } },
      include: { plan: { select: { name: true, tier: true } } },
    });
    if (!member?.passwordHash || !(await argon2.verify(member.passwordHash, password))) {
      throw new UnauthorizedException("Invalid mobile number or password");
    }
    this.assertPortalAllowed(member.status);
    return this.toAuthMember(member);
  }

  async issueTokens(member: AuthMember) {
    const accessPayload = {
      sub: member.id,
      fullName: member.fullName,
      mobile: member.mobile,
      organizationId: member.organizationId,
      status: member.status,
      referralCode: member.referralCode,
      planName: member.planName,
      planTier: member.planTier,
    };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.getOrThrow<string>("MEMBER_JWT_ACCESS_SECRET"),
      expiresIn: "15m",
    });
    const refreshToken = await this.jwt.signAsync(
      { sub: member.id },
      {
        secret: this.config.getOrThrow<string>("MEMBER_JWT_REFRESH_SECRET"),
        expiresIn: "30d",
      },
    );
    return { accessToken, refreshToken };
  }

  async getAuthMemberById(id: string): Promise<AuthMember> {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: { plan: { select: { name: true, tier: true } } },
    });
    if (!member || !member.passwordHash) {
      throw new UnauthorizedException("Member account no longer exists");
    }
    this.assertPortalAllowed(member.status);
    return this.toAuthMember(member);
  }

  async resolveReferralCode(code: string): Promise<ResolveReferralCodeResponse> {
    const referrer = await this.prisma.member.findFirst({ where: { referralCode: code } });
    if (!referrer || (BLOCKED_STATUSES as readonly string[]).includes(referrer.status)) {
      throw new NotFoundException("Referral code not found");
    }
    return { fullName: referrer.fullName };
  }

  // Public: also used as the StatusHistory actor for system-triggered
  // transitions with no human actor (e.g. MemberExpiryScheduler), since
  // actorId is a required FK — reuses the same per-org sentinel user
  // self-registration already lazily creates.
  async getOrCreateSystemUser(organizationId: string): Promise<string> {
    const email = `${SYSTEM_USER_EMAIL_PREFIX}${organizationId}${SYSTEM_USER_EMAIL_SUFFIX}`;
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return existing.id;
    }
    try {
      const created = await this.prisma.user.create({
        data: {
          email,
          passwordHash: await argon2.hash(randomBytes(32).toString("hex")),
          role: Role.FIELD_EXECUTIVE,
          isActive: false,
          isSystem: true,
          organizationId,
        },
      });
      return created.id;
    } catch (err) {
      // Concurrent first-ever self-registration for this org — the other
      // request won the race to create the sentinel user; use theirs.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const existingAfterRace = await this.prisma.user.findUniqueOrThrow({ where: { email } });
        return existingAfterRace.id;
      }
      throw err;
    }
  }

  private assertPortalAllowed(status: string) {
    if (BLOCKED_STATUSES.includes(status as (typeof BLOCKED_STATUSES)[number])) {
      throw new UnauthorizedException("Your membership is not active — please contact support");
    }
  }

  private toAuthMember(member: {
    id: string;
    fullName: string;
    mobile: string;
    organizationId: string;
    status: string;
    referralCode: string | null;
    plan?: { name: string; tier: string | null } | null;
  }): AuthMember {
    return {
      id: member.id,
      fullName: member.fullName,
      mobile: member.mobile,
      organizationId: member.organizationId,
      status: member.status,
      referralCode: member.referralCode,
      planName: member.plan?.name ?? null,
      planTier: (member.plan?.tier as AuthMember["planTier"]) ?? null,
    };
  }
}
