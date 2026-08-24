import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  AuthMember,
  AuthUser,
  CreateEventInput,
  EventRegistrationResponse,
  EventResponse,
  MyEventSummary,
  PlanTier,
  SubmitEventEvidenceInput,
  UpdateEventInput,
} from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { MembersService } from "../members/members.service";
import { DocumentStorageService } from "../common/document-storage.service";
import { ReferralsService } from "../referrals/referrals.service";
import { PlanRewardsService } from "../plans/plan-rewards.service";

type EventWithCounts = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date | null;
  capacity: number | null;
  status: string;
  targetDescription: string | null;
  targetQuantity: number | null;
  pointsReward: number;
  bannerImagePath: string | null;
  youtubeUrl: string | null;
  createdById: string;
  createdAt: Date;
  registrations: { attended: boolean }[];
  pointRules: { tier: string; points: number }[];
};

function bannerImageUrl(eventId: string, bannerImagePath: string | null): string | null {
  return bannerImagePath ? `/public/events/${eventId}/banner` : null;
}

const BANNER_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

const EVENT_INCLUDE = {
  registrations: { select: { attended: true as const } },
  pointRules: { select: { tier: true as const, points: true as const } },
};

type RegistrationWithMember = {
  id: string;
  eventId: string;
  memberId: string;
  member: { fullName: string; mobile: string };
  attended: boolean;
  evidenceNote: string | null;
  evidenceFileName: string | null;
  quantityAchieved: number | null;
  completionStatus: string;
  reviewedById: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  registeredAt: Date;
};

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membersService: MembersService,
    private readonly documentStorage: DocumentStorageService,
    private readonly referrals: ReferralsService,
    private readonly planRewards: PlanRewardsService,
  ) {}

  async findAll(user: AuthUser): Promise<EventResponse[]> {
    const events = await this.prisma.event.findMany({
      where: { organizationId: user.organizationId },
      include: EVENT_INCLUDE,
      orderBy: { startAt: "desc" },
    });
    return events.map((e) => this.toResponse(e));
  }

  async findOne(id: string, user: AuthUser): Promise<EventResponse> {
    const event = await this.findScoped(id, user.organizationId);
    return this.toResponse(event);
  }

  async create(dto: CreateEventInput, user: AuthUser): Promise<EventResponse> {
    const event = await this.prisma.event.create({
      data: {
        organizationId: user.organizationId,
        title: dto.title,
        description: dto.description,
        location: dto.location,
        startAt: dto.startAt,
        endAt: dto.endAt,
        capacity: dto.capacity,
        targetDescription: dto.targetDescription,
        targetQuantity: dto.targetQuantity,
        pointsReward: dto.pointsReward ?? 0,
        youtubeUrl: dto.youtubeUrl,
        createdById: user.id,
      },
      include: EVENT_INCLUDE,
    });
    if (dto.tierRewardOverrides) {
      await this.syncTierRewardOverrides(user.organizationId, event.id, dto.tierRewardOverrides);
      return this.toResponse(await this.findScoped(event.id, user.organizationId));
    }
    return this.toResponse(event);
  }

  async update(id: string, dto: UpdateEventInput, user: AuthUser): Promise<EventResponse> {
    await this.findScoped(id, user.organizationId);
    const { tierRewardOverrides, ...rest } = dto;
    const event = await this.prisma.event.update({
      where: { id },
      data: rest,
      include: EVENT_INCLUDE,
    });
    if (tierRewardOverrides) {
      await this.syncTierRewardOverrides(user.organizationId, id, tierRewardOverrides);
      return this.toResponse(await this.findScoped(id, user.organizationId));
    }
    return this.toResponse(event);
  }

  async uploadBanner(
    id: string,
    file: { mimeType: string; buffer: Buffer },
    user: AuthUser,
  ): Promise<EventResponse> {
    const existing = await this.findScoped(id, user.organizationId);

    // Image-only, not DocumentStorageService's full allowlist (which also
    // accepts application/pdf for member documents) — a banner is always
    // rendered as <img src=...> on the member events page and the admin
    // edit sheet, so a PDF here would just be a broken image for everyone.
    if (!BANNER_MIME_TYPES.has(file.mimeType)) {
      throw new BadRequestException(`Unsupported file type. Allowed: ${[...BANNER_MIME_TYPES].join(", ")}`);
    }
    if (!this.documentStorage.matchesDeclaredType(file.mimeType, file.buffer)) {
      throw new BadRequestException("File content does not match its declared type");
    }

    const filePath = await this.documentStorage.save(user.organizationId, id, file.mimeType, file.buffer);
    // DB write first, old-file delete only after it commits — if the update
    // throws, bannerImagePath still points at the (still-present) old file
    // instead of a dangling reference to one we already deleted.
    const event = await this.prisma.event.update({
      where: { id },
      data: { bannerImagePath: filePath, bannerImageMimeType: file.mimeType },
      include: EVENT_INCLUDE,
    });
    if (existing.bannerImagePath) {
      await this.documentStorage.remove(existing.bannerImagePath);
    }
    return this.toResponse(event);
  }

  async removeBanner(id: string, user: AuthUser): Promise<EventResponse> {
    const existing = await this.findScoped(id, user.organizationId);
    const event = await this.prisma.event.update({
      where: { id },
      data: { bannerImagePath: null, bannerImageMimeType: null },
      include: EVENT_INCLUDE,
    });
    if (existing.bannerImagePath) {
      await this.documentStorage.remove(existing.bannerImagePath);
    }
    return this.toResponse(event);
  }

  // No org/user scoping by design — called from the unguarded public banner
  // route (event ids are non-enumerable cuids), same precedent as
  // CardService.verify.
  async getBannerFile(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      select: { bannerImagePath: true, bannerImageMimeType: true },
    });
    if (!event?.bannerImagePath || !event.bannerImageMimeType) {
      throw new NotFoundException("No banner image for this event");
    }
    return {
      stream: this.documentStorage.readStream(event.bannerImagePath),
      mimeType: event.bannerImageMimeType,
    };
  }

  // Upserts the tiers present in `overrides`; a tier omitted from the record
  // (e.g. cleared in the edit form) deletes its existing rule row so the
  // event falls back to its base pointsReward for that tier.
  private async syncTierRewardOverrides(
    organizationId: string,
    eventId: string,
    overrides: Partial<Record<PlanTier, number>>,
  ): Promise<void> {
    const rules = (Object.entries(overrides) as [PlanTier, number | undefined][])
      .filter((entry): entry is [PlanTier, number] => entry[1] !== undefined)
      .map(([tier, points]) => ({ tier, points }));
    await this.planRewards.upsertEventRewardRules(organizationId, eventId, rules);
  }

  async listRegistrations(eventId: string, user: AuthUser): Promise<EventRegistrationResponse[]> {
    await this.findScoped(eventId, user.organizationId);
    const registrations = await this.prisma.eventRegistration.findMany({
      where: { eventId },
      include: { member: { select: { fullName: true, mobile: true } } },
      orderBy: { registeredAt: "asc" },
    });
    return registrations.map((r) => this.toRegistrationResponse(r));
  }

  async registerMember(
    eventId: string,
    memberId: string,
    user: AuthUser,
  ): Promise<EventRegistrationResponse> {
    await this.findScoped(eventId, user.organizationId);
    await this.membersService.findOne(memberId, user); // authorizes visibility, 404s if out of scope
    return this.createRegistration(eventId, memberId);
  }

  // --- Member self-service (member-auth guarded) --------------------------

  async listForMember(member: AuthMember): Promise<MyEventSummary[]> {
    const events = await this.prisma.event.findMany({
      where: { organizationId: member.organizationId },
      include: { registrations: { where: { memberId: member.id } } },
      orderBy: { startAt: "desc" },
    });
    return events.map((e) => {
      const reg = e.registrations[0];
      return {
        eventId: e.id,
        title: e.title,
        description: e.description,
        location: e.location,
        startAt: e.startAt,
        endAt: e.endAt,
        targetDescription: e.targetDescription,
        targetQuantity: e.targetQuantity,
        pointsReward: e.pointsReward,
        bannerImageUrl: bannerImageUrl(e.id, e.bannerImagePath),
        youtubeUrl: e.youtubeUrl,
        status: e.status as MyEventSummary["status"],
        registered: !!reg,
        registrationId: reg?.id ?? null,
        completionStatus: (reg?.completionStatus as MyEventSummary["completionStatus"]) ?? null,
        reviewNote: reg?.reviewNote ?? null,
      };
    });
  }

  // Mirrors ReferralsService.awardPointsForApproval's eligibility bar: a
  // member has to have actually been activated at least once (ACTIVE/EXPIRED/
  // RENEWED) to participate. SUSPENDED/DECEASED/REJECTED can't reach this
  // code at all (blocked at auth), so this only needs to catch members who
  // were never approved in the first place (DRAFT/SUBMITTED/PAYMENT_COLLECTED/
  // APPROVED-but-not-yet-ACTIVE).
  private assertMemberEventEligible(status: string) {
    if (status !== "ACTIVE" && status !== "EXPIRED" && status !== "RENEWED") {
      throw new ConflictException("Your membership must be active to participate in events");
    }
  }

  // New registrations only make sense for an event that hasn't happened (or
  // been called off) yet.
  private assertEventOpenForRegistration(status: string) {
    if (status !== "PLANNED") {
      throw new ConflictException(
        status === "CANCELLED" ? "This event has been cancelled" : "This event has already concluded",
      );
    }
  }

  // Evidence submission is expected to happen *after* an event takes place
  // (staff mark it COMPLETED once it's over), so only a cancelled event
  // blocks evidence — a completed one is the normal case.
  private assertEventNotCancelled(status: string) {
    if (status === "CANCELLED") {
      throw new ConflictException("This event has been cancelled");
    }
  }

  async registerSelf(eventId: string, member: AuthMember): Promise<EventRegistrationResponse> {
    this.assertMemberEventEligible(member.status);
    const event = await this.findScoped(eventId, member.organizationId);
    this.assertEventOpenForRegistration(event.status);
    return this.createRegistration(eventId, member.id);
  }

  async submitEvidence(
    eventId: string,
    member: AuthMember,
    dto: SubmitEventEvidenceInput,
    file?: { buffer: Buffer; mimeType: string; fileName: string },
  ): Promise<EventRegistrationResponse> {
    this.assertMemberEventEligible(member.status);
    const event = await this.findScoped(eventId, member.organizationId); // 404s if the event doesn't exist / isn't in this member's org
    this.assertEventNotCancelled(event.status);
    const registration = await this.prisma.eventRegistration.findUnique({
      where: { eventId_memberId: { eventId, memberId: member.id } },
    });
    if (!registration) {
      throw new NotFoundException("You are not registered for this event");
    }
    // One approval per registration — resubmitting after APPROVED would create
    // a second PENDING ledger row and let the member farm the event's points
    // repeatedly (see ReferralsService.recordPendingEventPoints).
    if (registration.completionStatus === "APPROVED") {
      throw new ConflictException("Your evidence has already been approved — it cannot be resubmitted");
    }
    if (!dto.note && !file) {
      throw new BadRequestException("Provide a note or a photo as evidence");
    }

    let fileFields: {
      evidenceFileName: string;
      evidenceMimeType: string;
      evidenceSizeBytes: number;
      evidenceFilePath: string;
    } | undefined;
    if (file) {
      if (!this.documentStorage.isAllowedMimeType(file.mimeType)) {
        throw new BadRequestException(
          `Unsupported file type. Allowed: ${this.documentStorage.allowedMimeTypes().join(", ")}`,
        );
      }
      if (!this.documentStorage.matchesDeclaredType(file.mimeType, file.buffer)) {
        throw new BadRequestException("File content does not match its declared type");
      }
      const filePath = await this.documentStorage.save(
        member.organizationId,
        member.id,
        file.mimeType,
        file.buffer,
      );
      fileFields = {
        evidenceFileName: file.fileName,
        evidenceMimeType: file.mimeType,
        evidenceSizeBytes: file.buffer.length,
        evidenceFilePath: filePath,
      };
    }

    const updated = await this.prisma.eventRegistration.update({
      where: { id: registration.id },
      data: {
        evidenceNote: dto.note ?? registration.evidenceNote,
        quantityAchieved: dto.quantityAchieved ?? registration.quantityAchieved,
        completionStatus: "PENDING_REVIEW",
        ...fileFields,
      },
      include: { member: { select: { fullName: true, mobile: true } } },
    });

    // Lock in the points value now, at submission time — see
    // ReferralsService.recordPendingEventPoints for why review time doesn't
    // recompute it.
    const tier = await this.planRewards.getMemberTier(member.id);
    const points = await this.planRewards.computeEventPoints(member.organizationId, eventId, tier);
    await this.referrals.recordPendingEventPoints(member.organizationId, member.id, registration.id, points);

    return this.toRegistrationResponse(updated);
  }

  // --- Staff evidence review -----------------------------------------------

  async listPendingReview(eventId: string, user: AuthUser): Promise<EventRegistrationResponse[]> {
    await this.findScoped(eventId, user.organizationId);
    const registrations = await this.prisma.eventRegistration.findMany({
      where: { eventId, completionStatus: "PENDING_REVIEW" },
      include: { member: { select: { fullName: true, mobile: true } } },
      orderBy: { registeredAt: "asc" },
    });
    return registrations.map((r) => this.toRegistrationResponse(r));
  }

  async reviewEvidence(
    eventId: string,
    registrationId: string,
    approved: boolean,
    note: string | undefined,
    user: AuthUser,
  ): Promise<EventRegistrationResponse> {
    await this.findScoped(eventId, user.organizationId); // 404s if the event doesn't exist / isn't in this org
    const registration = await this.prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId },
    });
    if (!registration) {
      throw new NotFoundException("Registration not found");
    }
    if (registration.completionStatus !== "PENDING_REVIEW") {
      throw new ConflictException("Only submissions pending review can be approved or rejected");
    }

    const updated = await this.prisma.eventRegistration.update({
      where: { id: registration.id },
      data: {
        completionStatus: approved ? "APPROVED" : "REJECTED",
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNote: note ?? null,
      },
      include: { member: { select: { fullName: true, mobile: true } } },
    });

    await this.referrals.resolveEventEvidence(user.organizationId, registration.memberId, registration.id, approved);

    return this.toRegistrationResponse(updated);
  }

  async getEvidenceFile(eventId: string, registrationId: string, user: AuthUser) {
    await this.findScoped(eventId, user.organizationId);
    const registration = await this.prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId },
    });
    if (!registration?.evidenceFilePath || !registration.evidenceMimeType || !registration.evidenceFileName) {
      throw new NotFoundException("No evidence file for this registration");
    }
    return {
      stream: this.documentStorage.readStream(registration.evidenceFilePath),
      mimeType: registration.evidenceMimeType,
      fileName: registration.evidenceFileName,
    };
  }

  async setAttendance(
    eventId: string,
    registrationId: string,
    attended: boolean,
    user: AuthUser,
  ): Promise<EventRegistrationResponse> {
    await this.findScoped(eventId, user.organizationId);
    const registration = await this.prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId },
    });
    if (!registration) {
      throw new NotFoundException("Registration not found");
    }
    const updated = await this.prisma.eventRegistration.update({
      where: { id: registrationId },
      data: { attended },
      include: { member: { select: { fullName: true, mobile: true } } },
    });
    return this.toRegistrationResponse(updated);
  }

  async unregister(eventId: string, registrationId: string, user: AuthUser): Promise<void> {
    await this.findScoped(eventId, user.organizationId);
    const registration = await this.prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId },
    });
    if (!registration) {
      throw new NotFoundException("Registration not found");
    }
    await this.prisma.eventRegistration.delete({ where: { id: registrationId } });
  }

  private async createRegistration(eventId: string, memberId: string): Promise<EventRegistrationResponse> {
    // Interactive transaction with a row lock on the event: two concurrent
    // registrations both read `count < capacity` at the same time could both
    // insert and overflow the capacity. Locking the event row serializes the
    // check-then-insert so the capacity is never exceeded.
    try {
      const registration = await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ id: string; capacity: number | null }[]>`
          SELECT id, capacity FROM events WHERE id = ${eventId} FOR UPDATE
        `;
        const event = rows[0];
        if (!event) {
          throw new NotFoundException("Event not found");
        }
        if (event.capacity !== null) {
          const count = await tx.eventRegistration.count({ where: { eventId } });
          if (count >= event.capacity) {
            throw new ConflictException("Event has reached its capacity");
          }
        }
        return tx.eventRegistration.create({
          data: { eventId, memberId },
          include: { member: { select: { fullName: true, mobile: true } } },
        });
      });
      return this.toRegistrationResponse(registration);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Member is already registered for this event");
      }
      throw err;
    }
  }

  private async findScoped(id: string, organizationId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id, organizationId },
      include: EVENT_INCLUDE,
    });
    if (!event) {
      throw new NotFoundException("Event not found");
    }
    return event;
  }

  private toResponse(event: EventWithCounts): EventResponse {
    const tierRewardOverrides = Object.fromEntries(
      event.pointRules.map((rule) => [rule.tier, rule.points]),
    ) as EventResponse["tierRewardOverrides"];
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      startAt: event.startAt,
      endAt: event.endAt,
      capacity: event.capacity,
      status: event.status as EventResponse["status"],
      targetDescription: event.targetDescription,
      targetQuantity: event.targetQuantity,
      pointsReward: event.pointsReward,
      tierRewardOverrides,
      bannerImageUrl: bannerImageUrl(event.id, event.bannerImagePath),
      youtubeUrl: event.youtubeUrl,
      createdById: event.createdById,
      registrationCount: event.registrations.length,
      attendedCount: event.registrations.filter((r) => r.attended).length,
      createdAt: event.createdAt,
    };
  }

  private toRegistrationResponse(r: RegistrationWithMember): EventRegistrationResponse {
    return {
      id: r.id,
      eventId: r.eventId,
      memberId: r.memberId,
      memberName: r.member.fullName,
      memberMobile: r.member.mobile,
      attended: r.attended,
      evidenceNote: r.evidenceNote,
      evidenceFileName: r.evidenceFileName,
      quantityAchieved: r.quantityAchieved,
      completionStatus: r.completionStatus as EventRegistrationResponse["completionStatus"],
      reviewedById: r.reviewedById,
      reviewedAt: r.reviewedAt,
      reviewNote: r.reviewNote,
      registeredAt: r.registeredAt,
    };
  }
}
