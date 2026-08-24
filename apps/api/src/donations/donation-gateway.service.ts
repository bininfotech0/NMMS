import { ConflictException, Injectable } from "@nestjs/common";
import { FeatureFlagKey } from "@prisma/client";
import type { AuthMember, DonationGatewayOrderResponse, DonationResponse } from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { IntegrationsService } from "../integrations/integrations.service";
import { NumberingService } from "../common/numbering.service";
import { ReferralsService } from "../referrals/referrals.service";
import { RazorpayCredentials, RazorpayProvider } from "../payments/gateway/razorpay-provider";
import { toDonationResponse } from "./donation.mapper";

// Member-initiated online donation, mirroring PaymentGatewayService's
// createOrder/verifyAndRecord — the same RazorpayProvider and PAYMENT_GATEWAY
// integration config power both, just recording into Donation instead of
// Payment. Unlike a self-submitted offline donation, a gateway-verified one
// skips the PENDING/Field-Executive-review window entirely: Razorpay's own
// signature + order-status check IS the verification, so it's created
// straight to APPROVED with points credited immediately — mirroring how
// PaymentsService.recordGatewayPayment never goes through staff review either.
@Injectable()
export class DonationGatewayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
    private readonly razorpay: RazorpayProvider,
    private readonly numbering: NumberingService,
    private readonly referrals: ReferralsService,
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

  async createOrder(
    member: AuthMember,
    amount: number,
    donorDetails?: { donorAddress?: string | null; donorPan?: string | null },
  ): Promise<DonationGatewayOrderResponse> {
    const credentials = await this.getCredentials(member.organizationId);
    const amountPaise = Math.round(amount * 100);

    const order = await this.razorpay.createOrder({
      ...credentials,
      amountPaise,
      currency: "INR",
      receipt: `donation-${member.id}-${Date.now()}`,
      // purpose distinguishes this from a membership-fee order in Razorpay's
      // dashboard/notes — verifyAndRecord doesn't need it (this service only
      // ever records into Donation), but it's useful for support/reconciliation.
      // donorAddress/donorPan ride along here too since the Donation row
      // isn't created until verifyAndRecord succeeds — notes are the only
      // place to stash them in between.
      notes: {
        memberId: member.id,
        organizationId: member.organizationId,
        purpose: "donation",
        donorAddress: donorDetails?.donorAddress ?? "",
        donorPan: donorDetails?.donorPan ?? "",
      },
    });

    return {
      orderId: order.orderId,
      amountPaise: order.amountPaise,
      currency: order.currency,
      keyId: credentials.keyId,
      name: "Donation",
      description: "Online donation",
    };
  }

  async verifyAndRecord(
    member: AuthMember,
    input: { orderId: string; paymentId: string; signature: string },
  ): Promise<DonationResponse> {
    const credentials = await this.getCredentials(member.organizationId);
    const valid = this.razorpay.verifyPaymentSignature({ ...input, keySecret: credentials.keySecret });
    if (!valid) {
      throw new ConflictException("Payment signature verification failed");
    }

    // Never trust a client-supplied amount/member — re-fetch the order from
    // Razorpay, whose `amount` and `notes` were fixed server-side at
    // createOrder() time, same reasoning as PaymentGatewayService.verifyAndRecord.
    const order = await this.razorpay.getOrder(input.orderId, credentials);
    if (order.status !== "paid") {
      throw new ConflictException("This order has not been captured yet");
    }
    if (order.notes.memberId !== member.id) {
      throw new ConflictException("This order does not belong to the requesting member");
    }
    if (order.notes.organizationId !== member.organizationId) {
      throw new ConflictException("This order belongs to a different organization");
    }

    // Idempotency: a retried verify call (e.g. the member's browser resubmits
    // after a network hiccup) for the same already-recorded payment must not
    // double-credit — same role as Payment.gatewayPaymentId's unique constraint.
    const existing = await this.prisma.donation.findUnique({
      where: { gatewayPaymentId: input.paymentId },
      include: { member: { select: { fullName: true } } },
    });
    if (existing) {
      return toDonationResponse(existing);
    }

    const settings = await this.prisma.orgSettings.upsert({
      where: { organizationId: member.organizationId },
      update: {},
      create: { organizationId: member.organizationId },
    });
    const amount = order.amountPaise / 100;
    const pointsAwarded = Math.floor((amount * settings.donationPointsPercent) / 100);

    const donation = await this.prisma.$transaction(async (tx) => {
      const receiptNumber = await this.numbering.nextDonationReceiptNumber(member.organizationId);
      const created = await tx.donation.create({
        data: {
          organizationId: member.organizationId,
          memberId: member.id,
          amount,
          mode: "ONLINE",
          status: "APPROVED",
          receiptNumber,
          pointsAwarded,
          donorAddress: order.notes.donorAddress || null,
          donorPan: order.notes.donorPan || null,
          gatewayOrderId: input.orderId,
          gatewayPaymentId: input.paymentId,
          reviewedAt: new Date(),
        },
        include: { member: { select: { fullName: true } } },
      });
      await this.referrals.creditDonationPoints(tx, member.organizationId, member.id, pointsAwarded, created.id);
      return created;
    });
    return toDonationResponse(donation);
  }
}
