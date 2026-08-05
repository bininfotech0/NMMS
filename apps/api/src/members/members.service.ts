import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, Member } from "@prisma/client";
import type {
  AuthUser,
  CreateMemberInput,
  DedupeMatch,
  MemberResponse,
  PromoteToExecutiveInput,
  ReferrerSearchResult,
  UpdateMemberInput,
  UserResponse,
} from "@nmms/shared";
import { Role } from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AadhaarHashService } from "../common/aadhaar-hash.service";
import { NumberingService } from "../common/numbering.service";
import { buildJurisdictionWhere } from "../common/scope.util";
import { UsersService } from "../users/users.service";
import { toMemberResponse } from "./member.mapper";

// Editable pre-submission — DRAFT while filling the form, PAYMENT_COLLECTED
// after the registration fee is recorded but before the wizard's later steps
// (documents/declaration/review) are saved. Locked once SUBMITTED.
const EDITABLE_STATUSES = ["DRAFT", "PAYMENT_COLLECTED"] as const;

const REQUIRED_FOR_SUBMIT = [
  "fullName",
  "mobile",
  "planId",
  "addressLine",
  "pincode",
  "declarationInfoCorrect",
  "declarationAcceptConstitution",
  "declarationAcceptPrivacyPolicy",
  "declarationAcceptTerms",
] as const;

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aadhaar: AadhaarHashService,
    private readonly numbering: NumberingService,
    private readonly usersService: UsersService,
  ) {}

  async findAll(user: AuthUser): Promise<MemberResponse[]> {
    const members = await this.prisma.member.findMany({
      where: { organizationId: user.organizationId, ...this.scopeFilter(user) },
      orderBy: { createdAt: "desc" },
      include: { nominee: true },
    });
    return members.map(toMemberResponse);
  }

  async findOne(id: string, user: AuthUser): Promise<MemberResponse> {
    const member = await this.prisma.member.findFirst({
      where: { id, organizationId: user.organizationId, ...this.scopeFilter(user) },
      include: { nominee: true },
    });
    if (!member) {
      throw new NotFoundException("Member not found");
    }
    return toMemberResponse(member);
  }

  async create(dto: CreateMemberInput, user: AuthUser): Promise<MemberResponse> {
    const registrationNumber = await this.numbering.nextRegistrationNumber(user.organizationId);
    const member = await this.prisma.member.create({
      data: {
        organizationId: user.organizationId,
        fullName: dto.fullName,
        mobile: dto.mobile,
        createdById: user.id,
        registrationNumber,
        registrationLatitude: dto.registrationLatitude ?? undefined,
        registrationLongitude: dto.registrationLongitude ?? undefined,
        deviceId: dto.deviceId ?? undefined,
        registrationMode: dto.registrationMode ?? undefined,
        registeredAt: dto.registeredAt ?? undefined,
      },
    });
    return toMemberResponse(member);
  }

  async update(id: string, dto: UpdateMemberInput, user: AuthUser): Promise<MemberResponse> {
    const existing = await this.findEditable(id, user);

    // Once the registration fee is collected, the plan/fee it was collected
    // against must not silently drift — PAYMENT_COLLECTED stays editable for
    // the wizard's later steps (documents/declaration/review), but changing
    // what was actually paid for requires a new payment cycle, not a PATCH.
    if (existing.status === "PAYMENT_COLLECTED") {
      const planChanged = dto.planId !== undefined && dto.planId !== existing.planId;
      const feeChanged =
        dto.feeOverride !== undefined &&
        (dto.feeOverride ?? null) !== (existing.feeOverride?.toNumber() ?? null);
      if (planChanged || feeChanged) {
        throw new ConflictException(
          "Cannot change the membership plan or fee after the registration fee has been collected",
        );
      }
    }

    const { aadhaarNumber, nominee, ...rest } = dto;
    const data: Prisma.MemberUpdateInput = { ...rest };
    if (aadhaarNumber === null) {
      data.aadhaarHash = null;
      data.aadhaarLast4 = null;
    } else if (aadhaarNumber !== undefined) {
      data.aadhaarHash = this.aadhaar.hash(aadhaarNumber);
      data.aadhaarLast4 = this.aadhaar.last4(aadhaarNumber);
    }

    await this.prisma.member.update({ where: { id: existing.id }, data });

    // Handled as separate calls rather than a nested write: a nested
    // `nominee: { delete: true }` throws if no nominee row exists yet, and
    // `deleteMany`/`upsert` are the safe create-or-update-or-clear primitives.
    if (nominee === null) {
      await this.prisma.nominee.deleteMany({ where: { memberId: existing.id } });
    } else if (nominee !== undefined) {
      await this.prisma.nominee.upsert({
        where: { memberId: existing.id },
        create: { memberId: existing.id, ...nominee },
        update: nominee,
      });
    }

    const member = await this.prisma.member.findUniqueOrThrow({
      where: { id: existing.id },
      include: { nominee: true },
    });
    return toMemberResponse(member);
  }

  async submit(id: string, user: AuthUser): Promise<MemberResponse> {
    const existing = await this.findEditable(id, user);
    if (existing.status !== "PAYMENT_COLLECTED") {
      throw new ConflictException(
        "Cannot submit: the registration fee must be collected first (see /members/:id/payments)",
      );
    }

    const missing = REQUIRED_FOR_SUBMIT.filter((field) => !existing[field]);
    if (missing.length > 0) {
      throw new ConflictException(`Cannot submit: missing ${missing.join(", ")}`);
    }

    // Compare-and-swap: a concurrent duplicate submit loses the race cleanly
    // instead of both requests succeeding and double-writing StatusHistory.
    const cas = await this.prisma.member.updateMany({
      where: { id: existing.id, status: "PAYMENT_COLLECTED" },
      data: { status: "SUBMITTED" },
    });
    if (cas.count === 0) {
      throw new ConflictException("This member's status just changed — please refresh and try again");
    }
    await this.prisma.statusHistory.create({
      data: { memberId: existing.id, fromStatus: "PAYMENT_COLLECTED", toStatus: "SUBMITTED", actorId: user.id },
    });
    const member = await this.prisma.member.findUniqueOrThrow({ where: { id: existing.id } });
    return toMemberResponse(member);
  }

  async dedupeCheck(
    mobile: string | undefined,
    aadhaarNumber: string | undefined,
    organizationId: string,
  ): Promise<DedupeMatch[]> {
    const aadhaarHash = aadhaarNumber ? this.aadhaar.hash(aadhaarNumber) : undefined;
    if (!mobile && !aadhaarHash) {
      return [];
    }

    const matches = await this.prisma.member.findMany({
      where: {
        organizationId,
        status: { not: "REJECTED" },
        OR: [
          ...(mobile ? [{ mobile }] : []),
          ...(aadhaarHash ? [{ aadhaarHash }] : []),
        ],
      },
    });

    return matches.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      status: m.status as DedupeMatch["status"],
      matchedOn: aadhaarHash && m.aadhaarHash === aadhaarHash ? ("aadhaar" as const) : ("mobile" as const),
    }));
  }

  // Powers the "Referred by" typeahead in the registration wizard — any
  // authenticated staff role, matching how the flat dropdown it replaces was
  // available to everyone who could open the wizard.
  async searchReferrer(q: string, organizationId: string): Promise<ReferrerSearchResult[]> {
    if (q.trim().length < 2) {
      return [];
    }
    const members = await this.prisma.member.findMany({
      where: {
        organizationId,
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { referralCode: { equals: q, mode: "insensitive" } },
          { membershipNumber: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, fullName: true, referralCode: true, membershipNumber: true },
      take: 10,
      orderBy: { fullName: "asc" },
    });
    return members;
  }

  // Self-registrations (via a referral link) land attributed to the org's
  // system user — see MemberAuthService. A Field Executive "claims" one to
  // confirm it in person, which reassigns createdById to themselves; from
  // then on it behaves exactly like any other field-executive-created
  // member for scoping/editing, and — per ApplicationsService.assertCanApprove
  // — the same Field Executive can approve it once submitted.
  async claim(id: string, user: AuthUser): Promise<MemberResponse> {
    const member = await this.prisma.member.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { createdBy: { select: { isSystem: true } } },
    });
    if (!member) {
      throw new NotFoundException("Member not found");
    }
    if (!member.selfRegistered || !member.createdBy.isSystem) {
      throw new ConflictException("This member is not an unclaimed self-registration");
    }
    const updated = await this.prisma.member.update({
      where: { id },
      data: { createdById: user.id },
      include: { nominee: true },
    });
    return toMemberResponse(updated);
  }

  // The queue Field Executives (and admins) work from — self-registered
  // members nobody has claimed yet.
  async findUnclaimedReferrals(organizationId: string): Promise<MemberResponse[]> {
    const members = await this.prisma.member.findMany({
      where: {
        organizationId,
        selfRegistered: true,
        status: "DRAFT",
        createdBy: { isSystem: true },
      },
      orderBy: { createdAt: "asc" },
      include: { nominee: true },
    });
    return members.map(toMemberResponse);
  }

  // Admin-initiated: an ACTIVE member gains a separate Field Executive staff
  // account so they can start registering other members door-to-door. The
  // member's own login/portal access is untouched.
  async promoteToExecutive(
    id: string,
    dto: PromoteToExecutiveInput,
    actingUser: AuthUser,
  ): Promise<UserResponse> {
    const member = await this.prisma.member.findFirst({
      where: { id, organizationId: actingUser.organizationId },
    });
    if (!member) {
      throw new NotFoundException("Member not found");
    }
    if (member.status !== "ACTIVE") {
      throw new ConflictException("Only an ACTIVE member can be promoted to Field Executive");
    }
    if (member.promotedToUserId) {
      throw new ConflictException("This member has already been promoted to a Field Executive");
    }

    const newUser = await this.usersService.create(
      { email: dto.email, password: dto.password, role: Role.FIELD_EXECUTIVE },
      actingUser,
    );
    await this.prisma.member.update({ where: { id }, data: { promotedToUserId: newUser.id } });
    return newUser;
  }

  // Editable by its creator or by an org admin, only pre-submission (DRAFT or
  // PAYMENT_COLLECTED — see EDITABLE_STATUSES).
  private async findEditable(id: string, user: AuthUser): Promise<Member> {
    const member = await this.prisma.member.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!member) {
      throw new NotFoundException("Member not found");
    }
    const isOwner = member.createdById === user.id;
    const isAdmin = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
    if (!isOwner && !isAdmin) {
      throw new NotFoundException("Member not found");
    }
    if (!EDITABLE_STATUSES.includes(member.status as (typeof EDITABLE_STATUSES)[number])) {
      throw new ConflictException("Only members in DRAFT or PAYMENT_COLLECTED status can be edited");
    }
    return member;
  }

  private scopeFilter(user: AuthUser): Prisma.MemberWhereInput {
    return buildJurisdictionWhere(user);
  }
}
