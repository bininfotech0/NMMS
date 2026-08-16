import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { FeatureFlagKey } from "@prisma/client";
import type { AuthUser, GatewayOrderResponse, PaymentResponse } from "@nmms/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { IntegrationsService } from "../../integrations/integrations.service";
import { buildJurisdictionWhere } from "../../common/scope.util";
import { PaymentsService } from "../payments.service";
import { RazorpayCredentials, RazorpayProvider } from "./razorpay-provider";

interface WebhookEvent {
  type: string;
  orderId: string;
  paymentId: string;
  amountPaise: number;
  memberId: string | null;
}

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
    private readonly razorpay: RazorpayProvider,
    private readonly paymentsService: PaymentsService,
  ) {}

  async isEnabled(organizationId: string): Promise<boolean> {
    return this.integrations.isEnabled(FeatureFlagKey.PAYMENT_GATEWAY, organizationId);
  }

  private async getCredentials(organizationId: string): Promise<RazorpayCredentials> {
    const enabled = await this.isEnabled(organizationId);
    const config = await this.integrations.getDecryptedConfig<Partial<RazorpayCredentials>>(
      FeatureFlagKey.PAYMENT_GATEWAY,
      organizationId,
    );
    if (!enabled || !config?.keyId || !config?.keySecret) {
      throw new ConflictException("Payment gateway is not configured");
    }
    return { keyId: config.keyId, keySecret: config.keySecret, webhookSecret: config.webhookSecret };
  }

  async createOrder(memberId: string, user: AuthUser): Promise<GatewayOrderResponse> {
    const credentials = await this.getCredentials(user.organizationId);

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
    const amountPaise = Math.round(amount * 100);

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
    // whose `amount` was fixed server-side at createOrder() time.
    const order = await this.razorpay.getOrder(input.orderId, credentials);
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
    const config = await this.integrations.getDecryptedConfig<Partial<RazorpayCredentials>>(
      FeatureFlagKey.PAYMENT_GATEWAY,
      organizationId,
    );
    if (!config?.webhookSecret) {
      throw new ConflictException("Payment gateway webhook is not configured");
    }
    const valid = this.razorpay.verifyWebhookSignature({
      rawBody,
      signature: signatureHeader,
      webhookSecret: config.webhookSecret,
    });
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
      await this.paymentsService.recordGatewayPaymentFromWebhook(
        event.memberId,
        { orderId: event.orderId, paymentId: event.paymentId, amount: event.amountPaise / 100 },
        organizationId,
      );
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
      };
    } catch {
      return null;
    }
  }
}
