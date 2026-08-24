import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { AuthUser, CardTokenResponse, CardVerifyResponse } from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { MembersService } from "../members/members.service";

const VALID_CARD_STATUSES = ["APPROVED", "ACTIVE", "RENEWED"];

interface CardTokenPayload {
  sub: string;
  purpose: "card-verify";
}

@Injectable()
export class CardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membersService: MembersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async mintToken(memberId: string, user: AuthUser): Promise<CardTokenResponse> {
    // Authorizes (org-scoped) and 404s if the member isn't visible to this user.
    await this.membersService.findOne(memberId, user);
    return this.sign(memberId);
  }

  // Member-portal self-service — memberId comes only from the verified
  // member JWT, so no authorization lookup is needed (a member can only
  // ever mint a token for themselves).
  async mintOwnToken(memberId: string): Promise<CardTokenResponse> {
    return this.sign(memberId);
  }

  private sign(memberId: string): CardTokenResponse {
    const payload: CardTokenPayload = { sub: memberId, purpose: "card-verify" };
    const token = this.jwtService.sign(payload, {
      secret: this.config.getOrThrow<string>("CARD_QR_SECRET"),
      expiresIn: "5y",
    });
    return { token };
  }

  // No org/user scoping here by design — a valid signed token IS the
  // authorization. Anyone who can scan the physical card can call this.
  async verify(token: string): Promise<CardVerifyResponse> {
    let payload: CardTokenPayload;
    try {
      payload = this.jwtService.verify<CardTokenPayload>(token, {
        secret: this.config.getOrThrow<string>("CARD_QR_SECRET"),
      });
    } catch {
      throw new NotFoundException("Invalid or expired card");
    }
    if (payload.purpose !== "card-verify") {
      throw new NotFoundException("Invalid or expired card");
    }

    const member = await this.prisma.member.findUnique({ where: { id: payload.sub } });
    if (!member || !VALID_CARD_STATUSES.includes(member.status)) {
      throw new NotFoundException("Invalid or expired card");
    }
    if (member.validUntil && member.validUntil < new Date()) {
      throw new NotFoundException("Invalid or expired card");
    }

    return {
      fullName: member.fullName,
      membershipNumber: member.membershipNumber,
      status: member.status as CardVerifyResponse["status"],
      validUntil: member.validUntil,
    };
  }
}
