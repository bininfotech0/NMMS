import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { FeatureFlagKey } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { IntegrationsService } from "../../integrations/integrations.service";
import { CryptoService } from "../../common/crypto.service";
import { WithdrawalsService } from "../withdrawals.service";
import { RazorpayXCredentials, RazorpayXPayoutProvider } from "./razorpayx-payout-provider";

interface WebhookPayoutEvent {
  type: string;
  payoutId: string;
  status: string;
  utr: string | null;
  failureReason: string | null;
}

@Injectable()
export class PayoutGatewayService {
  private readonly logger = new Logger(PayoutGatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
    private readonly crypto: CryptoService,
    private readonly razorpayx: RazorpayXPayoutProvider,
    private readonly withdrawalsService: WithdrawalsService,
  ) {}

  async isEnabled(organizationId: string): Promise<boolean> {
    return this.integrations.isEnabled(FeatureFlagKey.PAYMENT_GATEWAY_PAYOUTS, organizationId);
  }

  private async getCredentials(organizationId: string): Promise<RazorpayXCredentials> {
    const enabled = await this.isEnabled(organizationId);
    const config = await this.integrations.getDecryptedConfig<Partial<RazorpayXCredentials>>(
      FeatureFlagKey.PAYMENT_GATEWAY_PAYOUTS,
      organizationId,
    );
    if (!enabled || !config?.keyId || !config?.keySecret || !config?.accountNumber) {
      throw new ConflictException("Payout gateway is not configured");
    }
    return {
      keyId: config.keyId,
      keySecret: config.keySecret,
      webhookSecret: config.webhookSecret,
      accountNumber: config.accountNumber,
    };
  }

  async initiatePayout(withdrawalRequestId: string, organizationId: string, actorId: string) {
    const credentials = await this.getCredentials(organizationId);

    const request = await this.prisma.withdrawalRequest.findFirst({
      where: { id: withdrawalRequestId, organizationId },
      include: { member: true },
    });
    if (!request) {
      throw new NotFoundException("Withdrawal request not found");
    }
    // APPROVED is the normal path; PAYOUT_FAILED allows retrying a payout
    // that RazorpayX reported as failed/reversed without a reject-and-recreate
    // round trip (same fallback philosophy as WithdrawalsService.markPaid).
    if (request.status !== "APPROVED" && request.status !== "PAYOUT_FAILED") {
      throw new ConflictException("Only an approved (or failed-payout) request can have a payout initiated");
    }
    // Must run before any RazorpayX call below — markPayoutProcessing() also
    // re-checks this, but only after the transfer has already been created,
    // which is too late to actually stop the money from moving.
    await this.withdrawalsService.assertMemberPayoutEligible(request.memberId);

    const member = request.member;
    const { contactId } = await this.razorpayx.ensureContact({
      ...credentials,
      referenceId: member.id,
      name: member.fullName,
    });
    const { fundAccountId } = await this.razorpayx.ensureFundAccount({
      ...credentials,
      contactId,
      payoutMethod: request.payoutMethod,
      bankAccountName: request.payoutBankAccountName,
      // Use the account number snapshotted at request time, never the
      // member's current KYC record — the destination must not change after
      // approval (see the encrypted field on WithdrawalRequest). Fall back to
      // the member's current KYC record only for requests created before the
      // snapshot column existed (no backfill migration was written for them).
      bankAccountNumber: request.payoutBankAccountNumberEncrypted
        ? this.crypto.decrypt(request.payoutBankAccountNumberEncrypted)
        : member.bankAccountNumberEncrypted
          ? this.crypto.decrypt(member.bankAccountNumberEncrypted)
          : null,
      bankIfscCode: request.payoutBankIfscCode,
      upiId: request.payoutUpiId,
    });
    const payout = await this.razorpayx.createPayout({
      ...credentials,
      fundAccountId,
      amountPaise: Math.round(request.netAmount.toNumber() * 100),
      referenceId: request.id,
      narration: `Withdrawal payout ${request.id}`,
    });

    return this.withdrawalsService.markPayoutProcessing(request.id, organizationId, actorId, {
      payoutGatewayContactId: contactId,
      payoutGatewayFundAccountId: fundAccountId,
      payoutGatewayPayoutId: payout.payoutId,
    });
  }

  // Manual reconciliation action for a request stuck in PAYOUT_PROCESSING —
  // polls RazorpayX directly instead of waiting on the webhook.
  async checkStatus(withdrawalRequestId: string, organizationId: string) {
    const credentials = await this.getCredentials(organizationId);
    const request = await this.prisma.withdrawalRequest.findFirst({
      where: { id: withdrawalRequestId, organizationId },
    });
    if (!request?.payoutGatewayPayoutId) {
      throw new NotFoundException("No gateway payout found for this request");
    }
    const payout = await this.razorpayx.getPayout(request.payoutGatewayPayoutId, credentials);
    return this.applyPayoutResult(payout.payoutId, payout.status, payout.utr, payout.failureReason);
  }

  async handleWebhook(organizationId: string, rawBody: string, signatureHeader: string | undefined): Promise<void> {
    if (!signatureHeader) {
      throw new ConflictException("Missing webhook signature");
    }
    const config = await this.integrations.getDecryptedConfig<Partial<RazorpayXCredentials>>(
      FeatureFlagKey.PAYMENT_GATEWAY_PAYOUTS,
      organizationId,
    );
    if (!config?.webhookSecret) {
      throw new ConflictException("Payout gateway webhook is not configured");
    }
    const valid = this.razorpayx.verifyWebhookSignature({
      rawBody,
      signature: signatureHeader,
      webhookSecret: config.webhookSecret,
    });
    if (!valid) {
      throw new ConflictException("Invalid webhook signature");
    }

    const event = this.parseEvent(rawBody);
    if (!event) {
      return;
    }

    // Best-effort from here — a business-rule conflict (request already
    // resolved, no longer PAYOUT_PROCESSING) must not surface as a non-2xx,
    // which would just trigger a RazorpayX retry for an event we already
    // handled. Log for manual reconciliation instead.
    try {
      await this.applyPayoutResult(event.payoutId, event.status, event.utr, event.failureReason);
    } catch (err) {
      this.logger.error(
        `Failed to apply payout webhook for payout ${event.payoutId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  private async applyPayoutResult(
    payoutId: string,
    status: string,
    utr: string | null,
    failureReason: string | null,
  ) {
    if (status === "processed") {
      return this.withdrawalsService.markPaidFromPayout(payoutId, utr);
    }
    if (status === "failed" || status === "reversed" || status === "rejected") {
      return this.withdrawalsService.markPayoutFailed(payoutId, failureReason ?? `RazorpayX payout ${status}`);
    }
    // queued / pending / processing — no state change on our side yet.
    return null;
  }

  private parseEvent(rawBody: string): WebhookPayoutEvent | null {
    try {
      const payload = JSON.parse(rawBody) as {
        event?: string;
        payload?: { payout?: { entity?: Record<string, unknown> } };
      };
      const entity = payload.payload?.payout?.entity;
      if (!payload.event || !entity) return null;
      return {
        type: payload.event,
        payoutId: String(entity.id ?? ""),
        status: String(entity.status ?? ""),
        utr: entity.utr ? String(entity.utr) : null,
        failureReason: entity.failure_reason ? String(entity.failure_reason) : null,
      };
    } catch {
      return null;
    }
  }
}
