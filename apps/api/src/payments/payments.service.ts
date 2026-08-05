import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthUser, MemberResponse, PaymentMode, PaymentResponse, RecordPaymentInput } from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { NumberingService } from "../common/numbering.service";
import { buildJurisdictionWhere } from "../common/scope.util";
import { MembersService } from "../members/members.service";
import { toMemberResponse } from "../members/member.mapper";
import { NotificationService } from "../notifications/notification.service";

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

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
    if (member.status !== "DRAFT" && member.status !== "ACTIVE") {
      throw new ConflictException(
        "Payments can only be recorded for a DRAFT member (initial registration fee) or an ACTIVE member (renewal)",
      );
    }
    if (!member.plan) {
      throw new ConflictException("Member has no membership plan assigned");
    }
  }

  // Shared by the manual and gateway paths: creates the Payment row and
  // applies its side effects (status transition / validUntil extension /
  // notification), reusing the same DRAFT→PAYMENT_COLLECTED CAS guard either
  // way so two concurrent requests (retry, double click, verify+webhook
  // racing) can't both succeed and create duplicate payments.
  private async finalizePayment(
    member: MemberWithPlan,
    data: PaymentInput,
    actor: { id: string; organizationId: string },
  ): Promise<PaymentResponse> {
    const paidAt = new Date();

    if (member.status === "DRAFT") {
      const cas = await this.prisma.member.updateMany({
        where: { id: member.id, status: "DRAFT" },
        data: { status: "PAYMENT_COLLECTED", joiningDate: member.joiningDate ?? paidAt },
      });
      if (cas.count === 0) {
        throw new ConflictException("This member's status just changed — please refresh and try again");
      }
    }

    const receiptNumber = await this.numbering.nextReceiptNumber(actor.organizationId);
    const payment = await this.prisma.payment.create({
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
      await this.prisma.statusHistory.create({
        data: {
          memberId: member.id,
          fromStatus: "DRAFT",
          toStatus: "PAYMENT_COLLECTED",
          actorId: actor.id,
        },
      });
      await this.notifications.notify({
        type: "PAYMENT_RECEIPT",
        organizationId: actor.organizationId,
        memberName: member.fullName,
        mobile: member.mobile,
        amount: payment.amount.toNumber(),
        receiptNumber: payment.receiptNumber,
      });
    } else {
      const validUntil =
        member.plan!.validityType === "LIFETIME"
          ? null
          : addMonths(paidAt, member.plan!.validityMonths ?? 0);
      await this.prisma.member.update({
        where: { id: member.id },
        data: { validUntil },
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

  // "Outstanding" now covers both payment contexts recordPayment() accepts:
  // DRAFT members still owing their initial registration fee, and ACTIVE
  // members whose membership is expired or renewing within 30 days.
  async outstanding(user: AuthUser): Promise<MemberResponse[]> {
    const renewalWindow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const members = await this.prisma.member.findMany({
      where: {
        organizationId: user.organizationId,
        ...buildJurisdictionWhere(user),
        OR: [{ status: "DRAFT" }, { status: "ACTIVE", validUntil: { lte: renewalWindow } }],
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
