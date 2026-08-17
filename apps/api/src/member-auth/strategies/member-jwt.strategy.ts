import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AuthMember, PlanTier } from "@nmms/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { BLOCKED_STATUSES } from "../blocked-statuses.const";

interface MemberAccessTokenPayload {
  sub: string;
  fullName: string;
  mobile: string;
  organizationId: string;
  status: string;
  role: string;
  referralCode: string | null;
  planName: string | null;
  planTier: PlanTier | null;
}

// Separate passport strategy ("member-jwt") from the staff "jwt" strategy —
// signed with MEMBER_JWT_ACCESS_SECRET, so a member token is never valid
// against staff-only routes and vice versa.
@Injectable()
export class MemberJwtStrategy extends PassportStrategy(Strategy, "member-jwt") {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("MEMBER_JWT_ACCESS_SECRET"),
    });
  }

  // The token's claims are only a cache — re-read the member from the DB on
  // every request so the authoritative lifecycle status governs access (a
  // token issued while ACTIVE must not keep working after a suspension), and
  // so the status/plan claims handed to controllers are always current.
  async validate(payload: MemberAccessTokenPayload): Promise<AuthMember> {
    const member = await this.prisma.member.findUnique({
      where: { id: payload.sub },
      include: { plan: { select: { name: true, tier: true } } },
    });
    if (!member?.passwordHash) {
      throw new UnauthorizedException("Member account no longer exists");
    }
    if (BLOCKED_STATUSES.includes(member.status as (typeof BLOCKED_STATUSES)[number])) {
      throw new UnauthorizedException("Your membership is not active — please contact support");
    }
    return {
      id: member.id,
      fullName: member.fullName,
      mobile: member.mobile,
      organizationId: member.organizationId,
      status: member.status,
      role: member.role as AuthMember["role"],
      referralCode: member.referralCode,
      planName: member.plan?.name ?? null,
      planTier: (member.plan?.tier as PlanTier) ?? null,
    };
  }
}
