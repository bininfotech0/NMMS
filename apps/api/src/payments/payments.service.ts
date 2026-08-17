import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  PLAN_TIER_ORDER,
  type AuthUser,
  type MemberResponse,
  type PaymentMode,
  type PaymentResponse,
  type PlanTier,
  type RecordPaymentInput,
  type UpgradeMemberPlanInput,
} from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { NumberingService } from "../common/numbering.service";
import { buildJurisdictionWhere } from "../common/scope.util";
import { addMonths } from "../common/date.util";
import { MembersService } from "../members/members.service";
import { toMemberResponse } from "../members/member.mapper";
import { NotificationService } from "../notifications/notification.service";

interface PaymentInput {
  amount: number;
  mode: PaymentMode;
  transactionNumber: string | null;
  remarks: string | null;
  gatewayOrderId?: string | null;
  gatewayPaymentId?: string | null;
}

type MemberWithPlan = Prisma.MemberGetPayload<{ include: { plan: true } }>;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly membersService: MembersService,
    private readonly notifications: NotificationService,
  ) {}

  // A payment can be recorded in two contexts:
  //  - DRAFT: the initial registration fee, collected before submission (see
  //    the spec's Payment Collection step) — moves the member to
  //    PAYMENT_COLLECTED so it can then be submitted.
  //  - ACTIVE: a renewal/additional payment — extends validUntil, no status
  //    change (the member is already active).
  async recordPayment(
    memberId: string,
    dto: RecordPaymentInput,
    user: AuthUser,
  ): Promise<PaymentResponse> {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, organizationId: user.organizationId, ...buildJurisdictionWhere(user) },
      include: { plan: true },
    });
    if (!member) {
      throw new NotFoundException("Member not found");
    }
    this.assertPayable(member);
    this.assertManualAmountMatchesFee(member, dto.amount);

    return this.finalizePayment(
      member,
      {
        amount: dto.amount,
        mode: dto.mode,
        transactionNumber: dto.transactionNumber ?? null,
        remarks: dto.remarks ?? null,
      },
      { id: user.id, organizationId: user.organizationId },
    );
  }

  // Financial control for the manual cash/UPI path: a member's registration
  // or renewal must be paid at the exact effective fee (feeOverride if set,
  // else the plan fee). Without this, a ₹1 "payment" would mark a member
  // PAYMENT_COLLECTED and complete their registration. The gateway path is
  // exempt — its amount is fixed server-side at order-creation time and
  // re-fetched from Razorpay at verify time, never client-supplied.
  private assertManualAmountMatchesFee(member: MemberWithPlan, amount: number): void {
    if (!member.plan) {
      throw new ConflictException("Member has no current membership plan");
    }
    const effectiveFee = member.feeOverride?.toNumber() ?? member.plan.fee.toNumber();
    if (amount !== effectiveFee) {
      throw new ConflictException(`Payment amount must equal the member's fee of ₹${effectiveFee}`);
    }
  }

  // Admin/staff-initiated tier upgrade (e.g. Silver → Gold) for an ACTIVE
  // member. Charges only the fee difference between the current effective
  // fee (feeOverride, if set, else the plan's fee) and the target plan's fee,
  // floored at 0 — no charge if the target happens to be cheaper/equal.
  // Deliberately mirrors finalizePayment's renewal branch (CAS + receipt +
  // StatusHistory + best-effort notify) rather than reusing it, since the
  // status here never actually changes (stays ACTIVE) and there's no
  // validUntil extension.
  async upgradePlan(
    memberId: string,
    dto: UpgradeMemberPlanInput,
    user: AuthUser,
  ): Promise<MemberResponse> {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, organizationId: user.organizationId, ...buildJurisdictionWhere(user) },
      include: { plan: true },
    });
    if (!member) {
      throw new NotFoundException("Member not found");
    }
    if (member.status !== "ACTIVE") {
      throw new ConflictException("Only an ACTIVE member can be upgraded");
    }
    if (!member.plan) {
      throw new ConflictException("Member has no current membership plan to upgrade from");
    }

    const newPlan = await this.prisma.membershipPlan.findFirst({
      where: { id: dto.planId, organizationId: user.organizationId, isActive: true },
    });
    if (!newPlan) {
      throw new NotFoundException("Target plan not found");
    }
    if (newPlan.id === member.planId) {
      throw new ConflictException("Member is already on this plan");
    }

    const currentTier = member.plan.tier as PlanTier | null;
    const newTier = newPlan.tier as PlanTier | null;
    if (currentTier && newTier && PLAN_TIER_ORDER.indexOf(newTier) <= PLAN_TIER_ORDER.indexOf(currentTier)) {
      throw new ConflictException("The selected plan is not an upgrade over the member's current plan");
    }

    const plan = member.plan; // non-null (checked above) — captured so the transaction closure keeps the type
    const currentFee = member.feeOverride ?? plan.fee;
    const amount = Math.max(newPlan.fee.toNumber() - currentFee.toNumber(), 0);

    let receiptNumber: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      const cas = await tx.member.updateMany({
        where: { id: member.id, status: "ACTIVE", planId: member.planId },
        data: { planId: newPlan.id, feeOverride: null },
      });
      if (cas.count === 0) {
        throw new ConflictException("This member's plan just changed — please refresh and try again");
      }

      if (amount > 0) {
        receiptNumber = await this.numbering.nextReceiptNumber(user.organizationId);
        await tx.payment.create({
          data: {
            organizationId: user.organizationId,
            memberId: member.id,
            amount,
            mode: dto.mode,
            receiptNumber,
            transactionNumber: dto.transactionNumber ?? undefined,
            remarks: `Membership upgrade: ${plan.name} → ${newPlan.name}`,
            receivedById: user.id,
            paidAt: new Date(),
          },
        });
      }

      await tx.statusHistory.create({
        data: {
          memberId: member.id,
          fromStatus: "ACTIVE",
          toStatus: "ACTIVE",
          remarks: `Plan upgraded: ${plan.name} → ${newPlan.name}${
            receiptNumber ? ` (receipt ${receiptNumber}, ₹${amount})` : " (no charge)"
          }`,
          actorId: user.id,
        },
      });
    });

    await this.notifications.notify({
      type: "PLAN_UPGRADED",
      organizationId: user.organizationId,
      memberName: member.fullName,
      mobile: member.mobile,
      email: member.email,
      oldPlanName: plan.name,
      newPlanName: newPlan.name,
      amount,
      receiptNumber,
    });

    const updated = await this.prisma.member.findUniqueOrThrow({
      where: { id: member.id },
      include: { plan: true, nominee: true },
    });
    return toMemberResponse(updated);
  }

  // Records a Razorpay-originated payment reached via the authenticated
  // verify-callback endpoint (staff/member just completed checkout). Scoped
  // by the caller's jurisdiction, same as the manual path.
  async recordGatewayPayment(
    memberId: string,
    gw: { orderId: string; paymentId: string; amount: number },
    user: AuthUser,
  ): Promise<PaymentResponse> {
    return this.recordGatewayPaymentInternal(memberId, gw, {
      organizationId: user.organizationId,
      jurisdictionWhere: buildJurisdictionWhere(user),
      receivedById: user.id,
    });
  }

  // Records a Razorpay-originated payment reached via the server-to-server
  // webhook — the authoritative path, with no authenticated user in context.
  // Attributed to whichever staff member registered the member, since a
  // gateway payment has no human "received by" in the same sense.
  async recordGatewayPaymentFromWebhook(
    memberId: string,
    gw: { orderId: string; paymentId: string; amount: number },
    organizationId: string,
  ): Promise<PaymentResponse> {
    return this.recordGatewayPaymentInternal(memberId, gw, { organizationId, jurisdictionWhere: {} });
  }

  private async recordGatewayPaymentInternal(
    memberId: string,
    gw: { orderId: string; paymentId: string; amount: number },
    opts: { organizationId: string; jurisdictionWhere: Prisma.MemberWhereInput; receivedById?: string },
  ): Promise<PaymentResponse> {
    // Idempotency: the verify callback and the webhook both race to record
    // the same successful Razorpay payment — whichever gets here first wins.
    const existing = await this.prisma.payment.findUnique({ where: { gatewayPaymentId: gw.paymentId } });
    if (existing) {
      return this.toResponse(existing);
    }

    const member = await this.prisma.member.findFirst({
      where: { id: memberId, organizationId: opts.organizationId, ...opts.jurisdictionWhere },
      include: { plan: true },
    });
    if (!member) {
      throw new NotFoundException("Member not found");
    }
    this.assertPayable(member);

    const receivedById = opts.receivedById ?? member.createdById;

    try {
      return await this.finalizePayment(
        member,
        {
          amount: gw.amount,
          mode: "ONLINE",
          transactionNumber: gw.paymentId,
          remarks: null,
          gatewayOrderId: gw.orderId,
          gatewayPaymentId: gw.paymentId,
        },
        { id: receivedById, organizationId: opts.organizationId },
      );
    } catch (err) {
      // Narrow race: both callers passed the idempotency check above before
      // either had written its row. The loser hits the unique constraint —
      // fetch and return the winner's row instead of surfacing an error for
      // a payment that, from the caller's perspective, did succeed.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const winner = await this.prisma.payment.findUnique({ where: { gatewayPaymentId: gw.paymentId } });
        if (winner) return this.toResponse(winner);
      }
      throw err;
    }
  }

  private assertPayable(member: MemberWithPlan): void {
    if (member.status !== "DRAFT" && member.status !== "ACTIVE" && member.status !== "EXPIRED") {
      throw new ConflictException(
        "Payments can only be recorded for a DRAFT member (initial registration fee) or an ACTIVE/EXPIRED member (renewal)",
      );
    }
    if (!member.plan) {
      throw new ConflictException("Member has no membership plan assigned");
    }
  }

  // Shared by the manual and gateway paths: creates the Payment row and
  // applies its side effects (status transition / validUntil extension) in a
  // single transaction, so a failure to persist the payment (receipt collision,
  // DB error) can never leave a committed status change with no payment row.
  // The notification fires afterwards, best-effort and outside the transaction.
  private async finalizePayment(
    member: MemberWithPlan,
    data: PaymentInput,
    actor: { id: string; organizationId: string },
  ): Promise<PaymentResponse> {
    const paidAt = new Date();

    const payment = await this.prisma.$transaction(async (tx) => {
      if (member.status === "DRAFT") {
        const cas = await tx.member.updateMany({
          where: { id: member.id, status: "DRAFT" },
          data: { status: "PAYMENT_COLLECTED", joiningDate: member.joiningDate ?? paidAt },
        });
        if (cas.count === 0) {
          throw new ConflictException("This member's status just changed — please refresh and try again");
        }
      } else {
        // member.status is ACTIVE or EXPIRED here (assertPayable's guard) — a
        // renewal payment always lands the member back on ACTIVE, resetting
        // validUntil from today rather than stacking onto whatever was left.
        // CAS'd against the status we loaded so a renewal racing
        // MemberExpiryScheduler's nightly sweep can't be silently clobbered.
        // A MONTHS plan with no validityMonths configured would compute an
        // instantly-expired member (validUntil === paidAt) — treat it as a
        // config error and refuse the renewal rather than silently granting
        // zero validity.
        if (member.plan!.validityType !== "LIFETIME" && !member.plan!.validityMonths) {
          throw new ConflictException("This plan has no validity configured — please fix the plan settings first");
        }
        const validUntil =
          member.plan!.validityType === "LIFETIME"
            ? null
            : addMonths(paidAt, member.plan!.validityMonths ?? 0);
        const cas = await tx.member.updateMany({
          where: { id: member.id, status: member.status },
          data: { status: "ACTIVE", validUntil },
        });
        if (cas.count === 0) {
          throw new ConflictException("This member's status just changed — please refresh and try again");
        }
      }

      // Allocated only after the CAS above has succeeded — nextReceiptNumber
      // commits its own increment immediately (it isn't `tx`-aware), so
      // fetching it before the CAS would burn a sequential receipt number
      // every time a concurrent double-submit loses the race this guard
      // exists to catch, leaving a permanent gap in the org's receipt series.
      const receiptNumber = await this.numbering.nextReceiptNumber(actor.organizationId);
      const created = await tx.payment.create({
        data: {
          organizationId: actor.organizationId,
          memberId: member.id,
          amount: data.amount,
          mode: data.mode,
          receiptNumber,
          transactionNumber: data.transactionNumber ?? undefined,
          remarks: data.remarks ?? undefined,
          gatewayOrderId: data.gatewayOrderId ?? undefined,
          gatewayPaymentId: data.gatewayPaymentId ?? undefined,
          receivedById: actor.id,
          paidAt,
        },
      });

      if (member.status === "DRAFT") {
        await tx.statusHistory.create({
          data: {
            memberId: member.id,
            fromStatus: "DRAFT",
            toStatus: "PAYMENT_COLLECTED",
            actorId: actor.id,
          },
        });
      } else {
        // Real status jumps straight to ACTIVE (never persists as RENEWED,
        // exactly like APPROVED never persists in ApplicationsService.approve),
        // but the audit trail records every renewal, which it didn't before.
        await tx.statusHistory.create({
          data: { memberId: member.id, fromStatus: member.status, toStatus: "RENEWED", actorId: actor.id },
        });
        await tx.statusHistory.create({
          data: { memberId: member.id, fromStatus: "RENEWED", toStatus: "ACTIVE", actorId: actor.id },
        });
      }

      return created;
    });

    if (member.status === "DRAFT") {
      await this.notifications.notify({
        type: "PAYMENT_RECEIPT",
        organizationId: actor.organizationId,
        memberName: member.fullName,
        mobile: member.mobile,
        email: member.email,
        amount: payment.amount.toNumber(),
        receiptNumber: payment.receiptNumber,
      });
    }

    return this.toResponse(payment);
  }

  async findByMember(memberId: string, user: AuthUser): Promise<PaymentResponse[]> {
    await this.membersService.findOne(memberId, user); // authorizes visibility, 404s if out of scope
    const payments = await this.prisma.payment.findMany({
      where: { memberId },
      orderBy: { paidAt: "desc" },
    });
    return payments.map(this.toResponse);
  }

  async findAll(user: AuthUser): Promise<PaymentResponse[]> {
    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId: user.organizationId,
        member: buildJurisdictionWhere(user),
      },
      orderBy: { paidAt: "desc" },
    });
    return payments.map(this.toResponse);
  }

  // "Outstanding" now covers every payment context recordPayment() accepts:
  // DRAFT members still owing their initial registration fee, ACTIVE members
  // renewing within 30 days, and EXPIRED members (MemberExpiryScheduler has
  // already flipped them, so they'd otherwise vanish from this queue instead
  // of showing up more urgently).
  async outstanding(user: AuthUser): Promise<MemberResponse[]> {
    const renewalWindow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const members = await this.prisma.member.findMany({
      where: {
        organizationId: user.organizationId,
        ...buildJurisdictionWhere(user),
        OR: [
          { status: "DRAFT" },
          { status: "ACTIVE", validUntil: { lte: renewalWindow } },
          { status: "EXPIRED" },
        ],
      },
      orderBy: { updatedAt: "asc" },
    });
    return members.map(toMemberResponse);
  }

  private toResponse(payment: {
    id: string;
    memberId: string;
    amount: Prisma.Decimal;
    mode: string;
    receiptNumber: string;
    transactionNumber: string | null;
    remarks: string | null;
    receivedById: string;
    paidAt: Date;
    gatewayOrderId?: string | null;
    gatewayPaymentId?: string | null;
  }): PaymentResponse {
    return {
      id: payment.id,
      memberId: payment.memberId,
      amount: payment.amount.toNumber(),
      mode: payment.mode as PaymentResponse["mode"],
      receiptNumber: payment.receiptNumber,
      transactionNumber: payment.transactionNumber,
      remarks: payment.remarks,
      receivedById: payment.receivedById,
      paidAt: payment.paidAt,
      gatewayOrderId: payment.gatewayOrderId ?? null,
      gatewayPaymentId: payment.gatewayPaymentId ?? null,
    };
  }
}
