import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthMember, AuthUser, DonationGatewayOrderResponse, DonationResponse, PaymentLinkResponse } from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { buildJurisdictionWhere } from "../common/scope.util";
import { NumberingService } from "../common/numbering.service";
import { ReferralsService } from "../referrals/referrals.service";
import { RazorpayConfigService } from "../payments/gateway/razorpay-config.service";
import { RazorpayProvider } from "../payments/gateway/razorpay-provider";
import { toDonationResponse } from "./donation.mapper";

type DonorDetails = { donorAddress?: string | null; donorPan?: string | null };

// Member-initiated online donation, mirroring PaymentGatewayService's
// createOrder/verifyAndRecord — the same RazorpayProvider and PAYMENT_GATEWAY
// integration config power both, just recording into Donation instead of
// Payment. Unlike a self-submitted offline donation, a gateway-verified one
// skips the PENDING/Field-Executive-review window entirely: Razorpay's own
// signature + order-status check IS the verification, so it's created
// straight to APPROVED with points credited immediately — mirroring how
// PaymentsService.recordGatewayPayment never goes through staff review either.
//
// Also supports a staff-facilitated variant (createOrderForMember /
// verifyAndRecordForMember): a Field Executive/Admin visiting a donor in
// person can open the same embedded Razorpay checkout on the donor's behalf
// — the donor still enters their own card/UPI details, staff just starts and
// confirms the flow. Jurisdiction-checked like DonationsService.recordDirect,
// and the resulting Donation is still gateway-verified (mode: "ONLINE",
// never hand-picked), same integrity guarantee as the self-service path —
// staff can start/confirm a real payment, not fabricate one.
@Injectable()
export class DonationGatewayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayConfig: RazorpayConfigService,
    private readonly razorpay: RazorpayProvider,
    private readonly numbering: NumberingService,
    private readonly referrals: ReferralsService,
  ) {}

  async isEnabled(organizationId: string): Promise<boolean> {
    return this.razorpayConfig.isEnabled(organizationId);
  }

  private async getCredentials(organizationId: string) {
    return this.razorpayConfig.getCredentials(organizationId);
  }

  async createOrder(
    member: AuthMember,
    amount: number,
    donorDetails?: DonorDetails,
  ): Promise<DonationGatewayOrderResponse> {
    return this.buildOrder(member.id, member.organizationId, amount, donorDetails);
  }

  async createOrderForMember(
    memberId: string,
    user: AuthUser,
    amount: number,
    donorDetails?: DonorDetails,
  ): Promise<DonationGatewayOrderResponse> {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, organizationId: user.organizationId, ...buildJurisdictionWhere(user) },
    });
    if (!member) {
      throw new NotFoundException("Member not found");
    }
    return this.buildOrder(memberId, user.organizationId, amount, donorDetails);
  }

  private async buildOrder(
    memberId: string,
    organizationId: string,
    amount: number,
    donorDetails?: DonorDetails,
  ): Promise<DonationGatewayOrderResponse> {
    const credentials = await this.getCredentials(organizationId);
    const amountPaise = Math.round(amount * 100);

    const order = await this.razorpay.createOrder({
      ...credentials,
      amountPaise,
      currency: "INR",
      receipt: `donation-${memberId}-${Date.now()}`,
      // purpose distinguishes this from a membership-fee order in Razorpay's
      // dashboard/notes — verifyAndRecord doesn't need it (this service only
      // ever records into Donation), but it's useful for support/reconciliation.
      // donorAddress/donorPan ride along here too since the Donation row
      // isn't created until verify succeeds — notes are the only place to
      // stash them in between.
      notes: {
        memberId,
        organizationId,
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

  // Field Executive/Admin generating a Razorpay-hosted link instead of
  // completing checkout in-app right now — e.g. the donor prefers to pay from
  // their own phone. Same webhook/notes-based attribution as an order (a
  // payment link creates an underlying order), so recordFromWebhook below is
  // what actually turns a completed link into a Donation — there's no
  // client-side callback for a link the donor finishes on their own device.
  async createPaymentLinkForMember(
    memberId: string,
    user: AuthUser,
    amount: number,
    donorDetails?: DonorDetails,
  ): Promise<PaymentLinkResponse> {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, organizationId: user.organizationId, ...buildJurisdictionWhere(user) },
    });
    if (!member) {
      throw new NotFoundException("Member not found");
    }

    const credentials = await this.getCredentials(user.organizationId);
    const link = await this.razorpay.createPaymentLink({
      ...credentials,
      amountPaise: Math.round(amount * 100),
      currency: "INR",
      description: "Donation",
      referenceId: `donation-${memberId}-${Date.now()}`,
      customer: { name: member.fullName, contact: member.mobile, email: member.email ?? undefined },
      notes: {
        memberId,
        organizationId: user.organizationId,
        purpose: "donation",
        donorAddress: donorDetails?.donorAddress ?? "",
        donorPan: donorDetails?.donorPan ?? "",
      },
    });

    return { shortUrl: link.shortUrl };
  }

  async verifyAndRecord(
    member: AuthMember,
    input: { orderId: string; paymentId: string; signature: string },
  ): Promise<DonationResponse> {
    return this.finalizeVerify(member.id, member.organizationId, input, null);
  }

  // recordedById/reviewedById are set here (unlike the self-service path)
  // so the receipt/audit trail shows which Field Executive/Admin facilitated
  // the checkout — same convention as DonationsService.recordDirect.
  async verifyAndRecordForMember(
    memberId: string,
    user: AuthUser,
    input: { orderId: string; paymentId: string; signature: string },
  ): Promise<DonationResponse> {
    return this.finalizeVerify(memberId, user.organizationId, input, user.id);
  }

  private async finalizeVerify(
    memberId: string,
    organizationId: string,
    input: { orderId: string; paymentId: string; signature: string },
    staffUserId: string | null,
  ): Promise<DonationResponse> {
    const credentials = await this.getCredentials(organizationId);
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
    if (order.notes.memberId !== memberId) {
      throw new ConflictException("This order does not belong to the requested member");
    }
    if (order.notes.organizationId !== organizationId) {
      throw new ConflictException("This order belongs to a different organization");
    }

    return this.recordApprovedDonation({
      memberId,
      organizationId,
      amount: order.amountPaise / 100,
      orderId: input.orderId,
      paymentId: input.paymentId,
      donorAddress: order.notes.donorAddress || null,
      donorPan: order.notes.donorPan || null,
      staffUserId,
    });
  }

  // The webhook analogue of finalizeVerify — reached only for a payment link
  // completed on the donor's own device, where there's no client-side
  // checkout callback to call verify. The HMAC webhook signature (already
  // checked by PaymentGatewayService.handleWebhook before routing here) IS
  // the authorization; there's no client-supplied checkout signature to
  // re-check, and no staff in context (same as PaymentsService's webhook path).
  async recordFromWebhook(
    memberId: string,
    gw: { orderId: string; paymentId: string; amount: number },
    organizationId: string,
    donorDetails?: DonorDetails,
  ): Promise<DonationResponse> {
    return this.recordApprovedDonation({
      memberId,
      organizationId,
      amount: gw.amount,
      orderId: gw.orderId,
      paymentId: gw.paymentId,
      donorAddress: donorDetails?.donorAddress ?? null,
      donorPan: donorDetails?.donorPan ?? null,
      staffUserId: null,
    });
  }

  // Idempotency: a retried verify call (e.g. a network hiccup mid-checkout)
  // or a redelivered webhook for the same already-recorded payment must not
  // double-credit — same role as Payment.gatewayPaymentId's unique constraint.
  private async recordApprovedDonation(params: {
    memberId: string;
    organizationId: string;
    amount: number;
    orderId: string;
    paymentId: string;
    donorAddress: string | null;
    donorPan: string | null;
    staffUserId: string | null;
  }): Promise<DonationResponse> {
    const existing = await this.prisma.donation.findUnique({
      where: { gatewayPaymentId: params.paymentId },
      include: { member: { select: { fullName: true } } },
    });
    if (existing) {
      return toDonationResponse(existing);
    }

    const settings = await this.prisma.orgSettings.upsert({
      where: { organizationId: params.organizationId },
      update: {},
      create: { organizationId: params.organizationId },
    });
    const pointsAwarded = Math.floor((params.amount * settings.donationPointsPercent) / 100);

    const donation = await this.prisma.$transaction(async (tx) => {
      const receiptNumber = await this.numbering.nextDonationReceiptNumber(params.organizationId);
      const created = await tx.donation.create({
        data: {
          organizationId: params.organizationId,
          memberId: params.memberId,
          amount: params.amount,
          mode: "ONLINE",
          status: "APPROVED",
          receiptNumber,
          pointsAwarded,
          donorAddress: params.donorAddress,
          donorPan: params.donorPan,
          gatewayOrderId: params.orderId,
          gatewayPaymentId: params.paymentId,
          recordedById: params.staffUserId,
          reviewedById: params.staffUserId,
          reviewedAt: new Date(),
        },
        include: { member: { select: { fullName: true } } },
      });
      await this.referrals.creditDonationPoints(tx, params.organizationId, params.memberId, pointsAwarded, created.id);
      return created;
    });
    return toDonationResponse(donation);
  }
}
