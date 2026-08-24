import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { AuthMember, AuthUser, GatewayOrderResponse, PaymentLinkResponse, PaymentResponse } from "@nmms/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { buildJurisdictionWhere } from "../../common/scope.util";
import { PaymentsService } from "../payments.service";
import { DonationGatewayService } from "../../donations/donation-gateway.service";
import { RazorpayConfigService } from "./razorpay-config.service";
import { RazorpayProvider } from "./razorpay-provider";

interface WebhookEvent {
  type: string;
  orderId: string;
  paymentId: string;
  amountPaise: number;
  memberId: string | null;
  // "donation" for an order/link created by DonationGatewayService, absent
  // for a membership-fee order — routes handleWebhook to the right service
  // instead of always recording into Payment.
  purpose: string | null;
  donorAddress: string | null;
  donorPan: string | null;
}

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayConfig: RazorpayConfigService,
    private readonly razorpay: RazorpayProvider,
    private readonly paymentsService: PaymentsService,
    private readonly donationGatewayService: DonationGatewayService,
  ) {}

  async isEnabled(organizationId: string): Promise<boolean> {
    return this.razorpayConfig.isEnabled(organizationId);
  }

  private async getCredentials(organizationId: string) {
    return this.razorpayConfig.getCredentials(organizationId);
  }

  // Shared by createOrder (embedded checkout) and createPaymentLink (hosted
  // link shared with the member) — same eligibility rule and fee amount for
  // both, since they're two ways of collecting the same due.
  private async getPayableMember(memberId: string, user: AuthUser) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, organizationId: user.organizationId, ...buildJurisdictionWhere(user) },
      include: { plan: true },
    });
    if (!member) {
      throw new NotFoundException("Member not found");
    }
    if (member.status !== "DRAFT" && member.status !== "ACTIVE" && member.status !== "EXPIRED") {
      throw new ConflictException(
        "Payments can only be recorded for a DRAFT member (initial registration fee) or an ACTIVE/EXPIRED member (renewal)",
      );
    }
    if (!member.plan) {
      throw new ConflictException("Member has no membership plan assigned");
    }

    const amount = member.feeOverride?.toNumber() ?? member.plan.fee.toNumber();
    return { member, amountPaise: Math.round(amount * 100) };
  }

  // Member-portal self-service variant — memberId comes only from the
  // verified member JWT, so no jurisdiction check is needed (a member can
  // only ever pay for themselves). Same eligibility rule as getPayableMember.
  private async getPayableMemberForSelf(memberId: string) {
    const member = await this.prisma.member.findUniqueOrThrow({ where: { id: memberId }, include: { plan: true } });
    if (member.status !== "DRAFT" && member.status !== "ACTIVE" && member.status !== "EXPIRED") {
      throw new ConflictException(
        "Payments can only be made while your registration is in DRAFT (initial fee) or once ACTIVE/EXPIRED (renewal)",
      );
    }
    if (!member.plan) {
      throw new ConflictException("Select a membership plan before paying");
    }
    const amount = member.feeOverride?.toNumber() ?? member.plan.fee.toNumber();
    return { member, amountPaise: Math.round(amount * 100) };
  }

  async createOrderForSelf(member: AuthMember): Promise<GatewayOrderResponse> {
    const credentials = await this.getCredentials(member.organizationId);
    const { member: fullMember, amountPaise } = await this.getPayableMemberForSelf(member.id);

    const order = await this.razorpay.createOrder({
      ...credentials,
      amountPaise,
      currency: "INR",
      receipt: `member-${member.id}-${Date.now()}`,
      notes: { memberId: member.id, organizationId: member.organizationId },
    });

    return {
      orderId: order.orderId,
      amountPaise: order.amountPaise,
      currency: order.currency,
      keyId: credentials.keyId,
      name: "Membership Fee",
      description: `Registration/renewal fee for ${fullMember.fullName}`,
    };
  }

  // The member-portal analogue of verifyAndRecord — same signature/order-
  // status/notes checks (never trust the client), but records via
  // recordGatewayPaymentFromWebhook since there's no staff AuthUser in
  // context, same as the server-to-server webhook path.
  async verifyAndRecordForSelf(
    member: AuthMember,
    input: { orderId: string; paymentId: string; signature: string },
  ): Promise<PaymentResponse> {
    const credentials = await this.getCredentials(member.organizationId);
    const valid = this.razorpay.verifyPaymentSignature({ ...input, keySecret: credentials.keySecret });
    if (!valid) {
      throw new ConflictException("Payment signature verification failed");
    }

    const order = await this.razorpay.getOrder(input.orderId, credentials);
    if (order.status !== "paid") {
      throw new ConflictException("This order has not been captured yet");
    }
    if (order.notes.memberId !== member.id) {
      throw new ConflictException("This order does not belong to you");
    }
    if (order.notes.organizationId !== member.organizationId) {
      throw new ConflictException("This order belongs to a different organization");
    }

    return this.paymentsService.recordGatewayPaymentFromWebhook(
      member.id,
      { orderId: input.orderId, paymentId: input.paymentId, amount: order.amountPaise / 100 },
      member.organizationId,
    );
  }

  async createOrder(memberId: string, user: AuthUser): Promise<GatewayOrderResponse> {
    const credentials = await this.getCredentials(user.organizationId);
    const { member, amountPaise } = await this.getPayableMember(memberId, user);

    const order = await this.razorpay.createOrder({
      ...credentials,
      amountPaise,
      currency: "INR",
      receipt: `member-${member.id}-${Date.now()}`,
      notes: { memberId: member.id, organizationId: user.organizationId },
    });

    return {
      orderId: order.orderId,
      amountPaise: order.amountPaise,
      currency: order.currency,
      keyId: credentials.keyId,
      name: "Membership Fee",
      description: `Registration/renewal fee for ${member.fullName}`,
    };
  }

  async createPaymentLink(memberId: string, user: AuthUser): Promise<PaymentLinkResponse> {
    const credentials = await this.getCredentials(user.organizationId);
    const { member, amountPaise } = await this.getPayableMember(memberId, user);

    const link = await this.razorpay.createPaymentLink({
      ...credentials,
      amountPaise,
      currency: "INR",
      description: `Registration/renewal fee for ${member.fullName}`,
      referenceId: `member-${member.id}-${Date.now()}`,
      customer: { name: member.fullName, contact: member.mobile, email: member.email ?? undefined },
      notes: { memberId: member.id, organizationId: user.organizationId },
    });

    return { shortUrl: link.shortUrl };
  }

  async verifyAndRecord(
    memberId: string,
    input: { orderId: string; paymentId: string; signature: string },
    user: AuthUser,
  ): Promise<PaymentResponse> {
    const credentials = await this.getCredentials(user.organizationId);
    const valid = this.razorpay.verifyPaymentSignature({ ...input, keySecret: credentials.keySecret });
    if (!valid) {
      throw new ConflictException("Payment signature verification failed");
    }

    // Never trust a client-supplied amount — re-fetch the order from Razorpay,
    // whose `amount` was fixed server-side at createOrder() time. Equally
    // important: never trust the client-supplied *member* — the order's notes
    // record which member actually created it, so crediting another member
    // (misattribution) is rejected rather than honored.
    const order = await this.razorpay.getOrder(input.orderId, credentials);
    if (order.status !== "paid") {
      throw new ConflictException("This order has not been captured yet");
    }
    if (order.notes.memberId !== memberId) {
      throw new ConflictException("This order does not belong to the requested member");
    }
    if (order.notes.organizationId !== user.organizationId) {
      throw new ConflictException("This order belongs to a different organization");
    }

    return this.paymentsService.recordGatewayPayment(
      memberId,
      { orderId: input.orderId, paymentId: input.paymentId, amount: order.amountPaise / 100 },
      user,
    );
  }

  async handleWebhook(
    organizationId: string,
    rawBody: string,
    signatureHeader: string | undefined,
  ): Promise<void> {
    if (!signatureHeader) {
      throw new ConflictException("Missing webhook signature");
    }
    // Test-mode and live-mode Razorpay accounts are entirely separate, but
    // both post to this same org-scoped URL — so a webhook could legitimately
    // arrive from either one regardless of which mode is currently "active"
    // for new checkouts (e.g. an order started in test mode, completed after
    // an admin flips to live). Try every configured mode's webhook secret
    // rather than only the active one.
    const webhookSecrets = await this.razorpayConfig.getWebhookSecrets(organizationId);
    if (webhookSecrets.length === 0) {
      throw new ConflictException("Payment gateway webhook is not configured");
    }
    const valid = webhookSecrets.some((webhookSecret) =>
      this.razorpay.verifyWebhookSignature({ rawBody, signature: signatureHeader, webhookSecret }),
    );
    if (!valid) {
      throw new ConflictException("Invalid webhook signature");
    }

    const event = this.parseEvent(rawBody);
    if (!event || event.type !== "payment.captured" || !event.memberId) {
      return;
    }

    // Best-effort from here: a business-rule conflict (member already in a
    // non-payable status, plan removed, etc.) must not make us return a
    // non-2xx to Razorpay, which would just trigger retries for a payment
    // that already succeeded on their end. Log it for manual reconciliation.
    try {
      if (event.purpose === "donation") {
        await this.donationGatewayService.recordFromWebhook(
          event.memberId,
          { orderId: event.orderId, paymentId: event.paymentId, amount: event.amountPaise / 100 },
          organizationId,
          { donorAddress: event.donorAddress, donorPan: event.donorPan },
        );
      } else {
        await this.paymentsService.recordGatewayPaymentFromWebhook(
          event.memberId,
          { orderId: event.orderId, paymentId: event.paymentId, amount: event.amountPaise / 100 },
          organizationId,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to record webhook payment ${event.paymentId} for member ${event.memberId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  private parseEvent(rawBody: string): WebhookEvent | null {
    try {
      const payload = JSON.parse(rawBody) as {
        event?: string;
        payload?: { payment?: { entity?: Record<string, unknown> } };
      };
      const entity = payload.payload?.payment?.entity;
      if (!payload.event || !entity) return null;
      const notes = (entity.notes ?? {}) as Record<string, string>;
      return {
        type: payload.event,
        orderId: String(entity.order_id ?? ""),
        paymentId: String(entity.id ?? ""),
        amountPaise: Number(entity.amount ?? 0),
        memberId: notes.memberId ?? null,
        purpose: notes.purpose ?? null,
        donorAddress: notes.donorAddress || null,
        donorPan: notes.donorPan || null,
      };
    } catch {
      return null;
    }
  }
}
