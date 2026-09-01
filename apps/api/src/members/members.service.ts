import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { FeatureFlagKey } from "@prisma/client";
import type { DocumentType, Prisma, Member } from "@prisma/client";
import * as argon2 from "argon2";
import type {
  AuthUser,
  CreateMemberInput,
  DedupeMatch,
  MemberResponse,
  MemberSelfUpdateInput,
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

// Editable pre-payment — DRAFT while filling the form, AWAITING_PAYMENT once
// it's submitted but the fee hasn't been paid yet (payment now auto-activates,
// so this is the last status where a correction doesn't require a reject).
// Open to whoever owns/is scoped to the record (see findEditable) —
// typically the field executive who's still actively filling it in.
// PAYMENT_COLLECTED is legacy (pre-redesign: payment collected before
// profile/documents) — still editable for any rows stranded in that status.
const EDITABLE_STATUSES = ["DRAFT", "AWAITING_PAYMENT", "PAYMENT_COLLECTED"] as const;
// ACTIVE/SUSPENDED/EXPIRED/RENEWED members can still have their profile
// corrected by staff (e.g. a typo'd address or phone number) — by
// ADMIN/SUPER_ADMIN, or by the field executive who created them (see
// findOwned/findEditable — a non-owner FIELD_EXECUTIVE still can't reach a
// record they didn't create, this only lifts the extra lock that used to
// apply on top of ownership once the record left DRAFT/AWAITING_PAYMENT).
// EXPIRED/RENEWED are just as much "the member is already active in the org,
// just needs an occasional correction" as ACTIVE itself — a lapsed or
// renewed membership is not a reason to lock the member out of having their
// own address/phone corrected.
// SUBMITTED/APPROVED are legacy statuses from before the form-first/
// payment-last redesign, kept editable for any rows still working through
// the manual-override approval path (see ApplicationsService.approve/reject).
const STAFF_ONLY_EDITABLE_STATUSES = [
  "ACTIVE",
  "SUSPENDED",
  "EXPIRED",
  "RENEWED",
  "SUBMITTED",
  "APPROVED",
] as const;
const CAN_EDIT_ACTIVE_MEMBER: Role[] = [Role.ADMIN, Role.SUPER_ADMIN, Role.FIELD_EXECUTIVE];

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

// At least one photo and one form of ID proof — matches the minimum any
// membership org would need on file, and mirrors StepDocuments.tsx's own
// "Identity verification" section. AADHAAR (legacy single-side type, kept in
// the enum for old rows) counts alongside its AADHAAR_FRONT/BACK split.
const ID_PROOF_DOCUMENT_TYPES: DocumentType[] = [
  "AADHAAR",
  "AADHAAR_FRONT",
  "PAN",
  "VOTER_ID",
  "PASSPORT",
  "DRIVING_LICENCE",
  "GOVERNMENT_ID",
];

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

  // Self-service: a member reading/editing their own record. No jurisdiction
  // or role scoping (that's a staff-vs-staff concern) and no status/plan
  // lock-down (that's this.update()'s staff-editing-a-locked-record concern)
  // — a member may always see and correct their own in-scope profile fields.
  async getMe(memberId: string): Promise<MemberResponse> {
    const member = await this.prisma.member.findUniqueOrThrow({
      where: { id: memberId },
      include: MEMBER_INCLUDE,
    });
    return toMemberResponse(member);
  }

  async updateMe(memberId: string, dto: MemberSelfUpdateInput): Promise<MemberResponse> {
    const data: Prisma.MemberUpdateInput = { ...dto };
    const member = await this.prisma.member.update({
      where: { id: memberId },
      data,
      include: MEMBER_INCLUDE,
    });
    return toMemberResponse(member);
  }

  // A self-registered member choosing their plan for the first time —
  // MemberAuthService.register() creates the row with no planId at all
  // (unlike the staff wizard, whose Membership step requires one before
  // Payment Collection is even reachable), so this is the one place a
  // DRAFT member can set planId themselves. One-shot: only while the member
  // has never had a plan, same lock-down as this.update()'s "plan is frozen
  // once PAYMENT_COLLECTED" rule, just applied one status earlier (frozen
  // from the moment it's first chosen, not just once paid) — changing your
  // mind before paying still means starting a fresh registration, not a PATCH.
  async selectMyPlan(memberId: string, planId: string): Promise<MemberResponse> {
    const existing = await this.prisma.member.findUniqueOrThrow({ where: { id: memberId } });
    if (existing.status !== "DRAFT") {
      throw new ConflictException("A plan can only be selected while your registration is still in draft");
    }
    if (existing.planId) {
      throw new ConflictException("A membership plan has already been selected for this registration");
    }
    const plan = await this.prisma.membershipPlan.findFirst({
      where: { id: planId, organizationId: existing.organizationId, isActive: true },
    });
    if (!plan) {
      throw new NotFoundException("Membership plan not found");
    }
    const member = await this.prisma.member.update({
      where: { id: memberId },
      data: { planId, joiningDate: existing.joiningDate ?? new Date() },
      include: MEMBER_INCLUDE,
    });
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

    // Once submitted (AWAITING_PAYMENT) or beyond, the plan/fee the pending
    // payment is quoted against must not silently drift — AWAITING_PAYMENT/
    // ACTIVE/SUSPENDED all stay editable for other profile fields, but
    // changing what's actually being paid for requires a new payment cycle
    // (or a dedicated upgrade flow, not yet built), not a PATCH.
    if (existing.status !== "DRAFT") {
      const planChanged = dto.planId !== undefined && dto.planId !== existing.planId;
      const feeChanged =
        dto.feeOverride !== undefined &&
        (dto.feeOverride ?? null) !== (existing.feeOverride?.toNumber() ?? null);
      if (planChanged || feeChanged) {
        throw new ConflictException(
          "Cannot change the membership plan or fee once the registration has been submitted",
        );
      }
    }

    // Referenced rows must belong to the same organization as the member — a
    // cross-org plan (its fee gates the collected amount), branch, or
    // referrer would otherwise let staff bind this record to another org's
    // configuration or data.
    if (dto.planId !== undefined && dto.planId !== null) {
      const plan = await this.prisma.membershipPlan.findFirst({
        where: { id: dto.planId, organizationId: user.organizationId },
      });
      if (!plan) {
        throw new NotFoundException("Plan not found");
      }
    }
    if (dto.branchId !== undefined && dto.branchId !== null) {
      const branch = await this.prisma.lookup.findFirst({
        where: { id: dto.branchId, organizationId: user.organizationId, category: "BRANCH" },
      });
      if (!branch) {
        throw new NotFoundException("Branch not found");
      }
    }
    await this.assertReferrerValid(dto.referralMemberId, existing.id, user.organizationId);

    const { aadhaarNumber, nominee, ...rest } = dto;
    const data: Prisma.MemberUpdateInput = { ...rest };
    if (aadhaarNumber === null) {
      data.aadhaarHash = null;
      data.aadhaarLast4 = null;
    } else if (aadhaarNumber !== undefined) {
      data.aadhaarHash = this.aadhaar.hash(aadhaarNumber);
      data.aadhaarLast4 = this.aadhaar.last4(aadhaarNumber);
    }

    // Member + nominee in one interactive transaction so a partial failure
    // (e.g. nominee write) can't leave the member updated without its
    // nominee, or vice versa.
    await this.prisma.$transaction(async (tx) => {
      await tx.member.update({ where: { id: existing.id }, data });

      // Handled as separate calls rather than a nested write: a nested
      // `nominee: { delete: true }` throws if no nominee row exists yet, and
      // `deleteMany`/`upsert` are the safe create-or-update-or-clear primitives.
      if (nominee === null) {
        await tx.nominee.deleteMany({ where: { memberId: existing.id } });
      } else if (nominee !== undefined) {
        await tx.nominee.upsert({
          where: { memberId: existing.id },
          create: { memberId: existing.id, ...nominee },
          update: nominee,
        });
      }
    });

    const member = await this.prisma.member.findUniqueOrThrow({
      where: { id: existing.id },
      include: MEMBER_INCLUDE,
    });
    return toMemberResponse(member);
  }

  // Staff-initiated reset of a member's own member-portal login password —
  // same findEditable() authorization as update() (owner-or-admin, correct
  // status), since being trusted to correct a member's profile implies being
  // trusted to help them back into their own account. Also doubles as
  // "set an initial password" for a staff-created member who never
  // self-registered, unconditionally overwriting whatever passwordHash (or
  // lack of one) is already on the row.
  async resetPassword(id: string, newPassword: string, user: AuthUser): Promise<void> {
    const existing = await this.findEditable(id, user);
    await this.prisma.member.update({
      where: { id: existing.id },
      data: { passwordHash: await argon2.hash(newPassword) },
    });
  }

  async submit(id: string, user: AuthUser): Promise<MemberResponse> {
    const existing = await this.findEditable(id, user);
    return this.submitInternal(existing, user.id);
  }

  // Self-service equivalent of submit() — a self-registered member finishing
  // their own registration (selected a plan, filled in their profile,
  // uploaded documents — payment comes after this, see PaymentsService). No
  // jurisdiction/role check (the memberId comes from the verified member JWT,
  // so the caller is inherently authorized for their own record), but the
  // same DRAFT/required-fields/documents gate as staff submit — attributed to
  // the member's own createdById (the system sentinel user
  // MemberAuthService.register used), same convention
  // PaymentsService.recordGatewayPaymentFromWebhook uses for a "received by"
  // with no staff actor in context.
  async submitMine(memberId: string): Promise<MemberResponse> {
    const existing = await this.prisma.member.findUniqueOrThrow({ where: { id: memberId } });
    return this.submitInternal(existing, existing.createdById);
  }

  private async submitInternal(existing: Member, actorId: string): Promise<MemberResponse> {
    if (existing.status !== "DRAFT") {
      throw new ConflictException("Cannot submit: complete the required profile fields first");
    }

    const missing = REQUIRED_FOR_SUBMIT.filter((field) => !existing[field]);
    if (missing.length > 0) {
      throw new ConflictException(`Cannot submit: missing ${missing.join(", ")}`);
    }

    const [hasPhoto, hasIdProof] = await Promise.all([
      this.prisma.memberDocument.findFirst({ where: { memberId: existing.id, type: "PHOTO" } }),
      this.prisma.memberDocument.findFirst({
        where: { memberId: existing.id, type: { in: ID_PROOF_DOCUMENT_TYPES } },
      }),
    ]);
    const missingDocs = [!hasPhoto && "a passport photo", !hasIdProof && "an ID proof document"].filter(
      (v): v is string => !!v,
    );
    if (missingDocs.length > 0) {
      throw new ConflictException(`Cannot submit: upload ${missingDocs.join(" and ")} first`);
    }

    // Compare-and-swap: a concurrent duplicate submit loses the race cleanly
    // instead of both requests succeeding and double-writing StatusHistory.
    const cas = await this.prisma.member.updateMany({
      where: { id: existing.id, status: "DRAFT" },
      data: { status: "AWAITING_PAYMENT" },
    });
    if (cas.count === 0) {
      throw new ConflictException("This member's status just changed — please refresh and try again");
    }
    await this.prisma.statusHistory.create({
      data: { memberId: existing.id, fromStatus: "DRAFT", toStatus: "AWAITING_PAYMENT", actorId },
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
  // available to everyone who could open the wizard. Results stay inside the
  // caller's jurisdiction (a FIELD_EXECUTIVE only ever sees members they
  // created) exactly like every other member listing.
  async searchReferrer(q: string, user: AuthUser): Promise<ReferrerSearchResult[]> {
    if (q.trim().length < 2) {
      return [];
    }
    const members = await this.prisma.member.findMany({
      where: {
        organizationId: user.organizationId,
        ...buildJurisdictionWhere(user),
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
    // Compare-and-swap: only an unclaimed self-registration (still attributed
    // to the sentinel system user) can be claimed, so two executives racing
    // to claim the same member can't both win — the loser's updateMany
    // matches zero rows.
    const cas = await this.prisma.member.updateMany({
      where: { id, selfRegistered: true, createdBy: { isSystem: true } },
      data: { createdById: user.id },
    });
    if (cas.count === 0) {
      throw new ConflictException("This member was just claimed by another executive — please refresh");
    }
    const updated = await this.prisma.member.findUniqueOrThrow({
      where: { id },
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
    // Compare-and-swap so a concurrent double-promote can't both succeed:
    // the loser's updateMany matches zero rows (status no longer ACTIVE or
    // promotedToUserId already set), and we clean up the staff account we
    // just created rather than leaving an orphaned user behind.
    const cas = await this.prisma.member.updateMany({
      where: { id, status: "ACTIVE", promotedToUserId: null },
      data: { promotedToUserId: newUser.id },
    });
    if (cas.count === 0) {
      try {
        await this.prisma.user.delete({ where: { id: newUser.id } });
      } catch {
        // Already gone — nothing to clean up.
      }
      throw new ConflictException("This member's status just changed — please refresh and try again");
    }
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

  // Editable by its creator or by an org admin, pre-payment (DRAFT or
  // AWAITING_PAYMENT — see EDITABLE_STATUSES). ACTIVE/SUSPENDED (and the
  // other STAFF_ONLY_EDITABLE_STATUSES) members are also editable by an
  // ADMIN/SUPER_ADMIN/FIELD_EXECUTIVE (see CAN_EDIT_ACTIVE_MEMBER) — findOwned
  // above already confines a FIELD_EXECUTIVE to records they created, so this
  // doesn't grant access to any member org-wide.
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
        "Only members in DRAFT or AWAITING_PAYMENT status can be edited (ACTIVE/SUSPENDED members can be corrected by an admin)",
      );
    }
    return member;
  }

  private scopeFilter(user: AuthUser): Prisma.MemberWhereInput {
    return buildJurisdictionWhere(user);
  }

  // Referrer integrity: the referrer must be a real member of the same org,
  // not the member themselves, and not part of a referral cycle. The chain
  // walk starts at the candidate referrer and follows each member's own
  // referrer upward — reaching the member being edited (or looping onto an
  // already-visited id) means the change would create a cycle.
  private async assertReferrerValid(
    referralMemberId: string | null | undefined,
    memberId: string,
    organizationId: string,
  ) {
    if (referralMemberId === undefined || referralMemberId === null) {
      return;
    }
    if (referralMemberId === memberId) {
      throw new ConflictException("A member cannot refer themselves");
    }
    const referrer = await this.prisma.member.findFirst({
      where: { id: referralMemberId, organizationId },
      select: { id: true, referralMemberId: true, status: true },
    });
    if (!referrer) {
      throw new NotFoundException("Referrer not found");
    }
    // Kept in sync with ReferralsService.awardPointsForApproval's own eligibility
    // check — a referrer accepted here but ineligible there would silently earn
    // nothing with no indication why, so reject at selection time instead.
    if (referrer.status === "REJECTED" || referrer.status === "DECEASED" || referrer.status === "SUSPENDED") {
      throw new ConflictException("A rejected, suspended, or deceased member cannot be a referrer");
    }
    const visited = new Set<string>([referralMemberId]);
    let cursor: { id: string; referralMemberId: string | null } | null = referrer;
    while (cursor?.referralMemberId) {
      if (cursor.referralMemberId === memberId || visited.has(cursor.referralMemberId)) {
        throw new ConflictException("Referral chain must not form a loop");
      }
      visited.add(cursor.referralMemberId);
      cursor = await this.prisma.member.findFirst({
        where: { id: cursor.referralMemberId, organizationId },
        select: { id: true, referralMemberId: true, status: true },
      });
    }
  }
}
