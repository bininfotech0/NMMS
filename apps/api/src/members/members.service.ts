import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { FeatureFlagKey } from "@prisma/client";
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
import { DocumentStorageService } from "../common/document-storage.service";
import { NumberingService } from "../common/numbering.service";
import { buildJurisdictionWhere } from "../common/scope.util";
import { jaroWinklerSimilarity } from "../common/string-similarity.util";
import { IntegrationsService } from "../integrations/integrations.service";
import { UsersService } from "../users/users.service";
import { toMemberResponse } from "./member.mapper";

// AI_DEDUPE's fuzzy name pass: below this Jaro-Winkler score, two names are
// treated as unrelated rather than a likely duplicate registration.
const NAME_MATCH_THRESHOLD = 0.88;

// Editable pre-submission — DRAFT while filling the form, PAYMENT_COLLECTED
// after the registration fee is recorded but before the wizard's later steps
// (documents/declaration/review) are saved. Locked once SUBMITTED (through
// SUBMITTED/APPROVED) so a pending application can't be altered mid-review.
const EDITABLE_STATUSES = ["DRAFT", "PAYMENT_COLLECTED"] as const;
// ACTIVE/SUSPENDED members can still have their profile corrected by staff
// (e.g. a typo'd address or phone number) — but only by ADMIN/SUPER_ADMIN,
// not the field executive who created them, since the record is now
// lifecycle-locked and out of that field executive's day-to-day workflow.
const STAFF_ONLY_EDITABLE_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
const CAN_EDIT_ACTIVE_MEMBER: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

const MEMBER_INCLUDE = {
  nominee: true,
  plan: { select: { name: true as const, tier: true as const } },
};

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
    private readonly storage: DocumentStorageService,
    private readonly integrations: IntegrationsService,
  ) {}

  async findAll(user: AuthUser): Promise<MemberResponse[]> {
    const members = await this.prisma.member.findMany({
      where: { organizationId: user.organizationId, ...this.scopeFilter(user) },
      orderBy: { createdAt: "desc" },
      include: MEMBER_INCLUDE,
    });
    return members.map(toMemberResponse);
  }

  async findOne(id: string, user: AuthUser): Promise<MemberResponse> {
    const member = await this.prisma.member.findFirst({
      where: { id, organizationId: user.organizationId, ...this.scopeFilter(user) },
      include: MEMBER_INCLUDE,
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
    // against must not silently drift — PAYMENT_COLLECTED/ACTIVE/SUSPENDED
    // all stay editable for other profile fields, but changing what was
    // actually paid for requires a new payment cycle (or a dedicated
    // upgrade flow, not yet built), not a PATCH.
    if (existing.status !== "DRAFT") {
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
      include: MEMBER_INCLUDE,
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
    const member = await this.prisma.member.findUniqueOrThrow({
      where: { id: existing.id },
      include: MEMBER_INCLUDE,
    });
    return toMemberResponse(member);
  }

  async dedupeCheck(
    mobile: string | undefined,
    aadhaarNumber: string | undefined,
    fullName: string | undefined,
    organizationId: string,
  ): Promise<DedupeMatch[]> {
    const aadhaarHash = aadhaarNumber ? this.aadhaar.hash(aadhaarNumber) : undefined;
    const results = new Map<string, DedupeMatch>();

    if (mobile || aadhaarHash) {
      const exactMatches = await this.prisma.member.findMany({
        where: {
          organizationId,
          status: { not: "REJECTED" },
          OR: [
            ...(mobile ? [{ mobile }] : []),
            ...(aadhaarHash ? [{ aadhaarHash }] : []),
          ],
        },
      });
      for (const m of exactMatches) {
        results.set(m.id, {
          id: m.id,
          fullName: m.fullName,
          status: m.status as DedupeMatch["status"],
          matchedOn: aadhaarHash && m.aadhaarHash === aadhaarHash ? "aadhaar" : "mobile",
        });
      }
    }

    // AI_DEDUPE: a fuzzy pass on top of the exact mobile/Aadhaar match above,
    // catching near-duplicate registrations (typos, family members with
    // slightly varied names) that share neither contact field.
    if (fullName && fullName.trim().length > 1) {
      const enabled = await this.integrations.isEnabled(FeatureFlagKey.AI_DEDUPE, organizationId);
      if (enabled) {
        const candidates = await this.prisma.member.findMany({
          where: { organizationId, status: { not: "REJECTED" } },
          select: { id: true, fullName: true, status: true },
        });
        for (const c of candidates) {
          if (results.has(c.id)) continue;
          if (jaroWinklerSimilarity(fullName, c.fullName) >= NAME_MATCH_THRESHOLD) {
            results.set(c.id, {
              id: c.id,
              fullName: c.fullName,
              status: c.status as DedupeMatch["status"],
              matchedOn: "name",
            });
          }
        }
      }
    }

    return Array.from(results.values());
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
      include: MEMBER_INCLUDE,
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
      include: MEMBER_INCLUDE,
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

  // Deletable only pre-payment (DRAFT) — once a fee has been collected the
  // record is financial history, not a discardable draft; use the (not yet
  // built) suspend/reject workflow instead. Same owner-or-admin rule as edit.
  async remove(id: string, user: AuthUser): Promise<void> {
    const member = await this.findOwned(id, user);
    if (member.status !== "DRAFT") {
      throw new ConflictException("Only members in DRAFT status can be deleted");
    }

    const documents = await this.prisma.memberDocument.findMany({
      where: { memberId: member.id },
      select: { filePath: true },
    });

    // Child rows with a required (non-nullable) memberId are deleted outright;
    // rows that merely *reference* this member optionally (another member's
    // referralMemberId, a ledger entry's relatedMemberId) are unlinked instead
    // so deleting a draft never cascades into deleting someone else's history.
    await this.prisma.$transaction([
      this.prisma.member.updateMany({
        where: { referralMemberId: member.id },
        data: { referralMemberId: null },
      }),
      this.prisma.referralPointsLedger.updateMany({
        where: { relatedMemberId: member.id },
        data: { relatedMemberId: null },
      }),
      this.prisma.referralPointsLedger.deleteMany({ where: { memberId: member.id } }),
      this.prisma.referralReward.deleteMany({ where: { memberId: member.id } }),
      this.prisma.eventRegistration.deleteMany({ where: { memberId: member.id } }),
      this.prisma.statusHistory.deleteMany({ where: { memberId: member.id } }),
      this.prisma.payment.deleteMany({ where: { memberId: member.id } }),
      this.prisma.memberDocument.deleteMany({ where: { memberId: member.id } }),
      this.prisma.nominee.deleteMany({ where: { memberId: member.id } }),
      this.prisma.member.delete({ where: { id: member.id } }),
    ]);

    await Promise.all(documents.map((doc) => this.storage.remove(doc.filePath)));
  }

  // Visible to and actionable by its creator or by an org admin — the shared
  // ownership check behind both findEditable (edit) and remove (delete).
  // Returns "not found" rather than "forbidden" for non-owners so a field
  // executive can't probe for the existence of another's member records.
  private async findOwned(id: string, user: AuthUser): Promise<Member> {
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
    return member;
  }

  // Editable by its creator or by an org admin, pre-submission (DRAFT or
  // PAYMENT_COLLECTED — see EDITABLE_STATUSES). ACTIVE/SUSPENDED members are
  // also editable, but only by an ADMIN/SUPER_ADMIN (see
  // STAFF_ONLY_EDITABLE_STATUSES) — not by the field executive who created
  // them, since the record is lifecycle-locked at that point.
  private async findEditable(id: string, user: AuthUser): Promise<Member> {
    const member = await this.findOwned(id, user);
    const preSubmissionEditable = EDITABLE_STATUSES.includes(
      member.status as (typeof EDITABLE_STATUSES)[number],
    );
    const staffCorrectable =
      CAN_EDIT_ACTIVE_MEMBER.includes(user.role) &&
      STAFF_ONLY_EDITABLE_STATUSES.includes(member.status as (typeof STAFF_ONLY_EDITABLE_STATUSES)[number]);
    if (!preSubmissionEditable && !staffCorrectable) {
      throw new ConflictException(
        "Only members in DRAFT or PAYMENT_COLLECTED status can be edited (ACTIVE/SUSPENDED members can be corrected by an admin)",
      );
    }
    return member;
  }

  private scopeFilter(user: AuthUser): Prisma.MemberWhereInput {
    return buildJurisdictionWhere(user);
  }
}
