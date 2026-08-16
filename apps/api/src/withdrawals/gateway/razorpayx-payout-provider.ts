import { Injectable, Logger } from "@nestjs/common";
import { verifyHmacSha256 } from "../../common/hmac.util";

export interface RazorpayXCredentials {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
  accountNumber: string;
}

export interface EnsureContactInput extends RazorpayXCredentials {
  referenceId: string;
  name: string;
}

export interface EnsureFundAccountInput extends RazorpayXCredentials {
  contactId: string;
  payoutMethod: "BANK" | "UPI";
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankIfscCode?: string | null;
  upiId?: string | null;
}

export interface CreatePayoutInput extends RazorpayXCredentials {
  fundAccountId: string;
  amountPaise: number;
  referenceId: string;
  narration: string;
}

export interface PayoutResult {
  payoutId: string;
  status: string;
  utr: string | null;
  failureReason: string | null;
}

// Thin wrapper around RazorpayX's REST API — same "no SDK" approach as
// RazorpayProvider (the checkout-side sibling): one auth header, plain fetch.
@Injectable()
export class RazorpayXPayoutProvider {
  private readonly logger = new Logger(RazorpayXPayoutProvider.name);

  private authHeader(keyId: string, keySecret: string): string {
    return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
  }

  private async post<T>(path: string, credentials: RazorpayXCredentials, body: unknown): Promise<T> {
    const res = await fetch(`https://api.razorpay.com/v1/${path}`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader(credentials.keyId, credentials.keySecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      this.logger.error(`RazorpayX ${path} failed (${res.status}): ${text}`);
      throw new Error(`RazorpayX ${path} request failed`);
    }
    return res.json() as Promise<T>;
  }

  // Idempotent via `reference_id` — RazorpayX returns the existing contact
  // instead of erroring if one already exists for this reference_id.
  async ensureContact(input: EnsureContactInput): Promise<{ contactId: string }> {
    const data = await this.post<{ id: string }>("contacts", input, {
      name: input.name,
      type: "employee",
      reference_id: input.referenceId,
    });
    return { contactId: data.id };
  }

  async ensureFundAccount(input: EnsureFundAccountInput): Promise<{ fundAccountId: string }> {
    const body =
      input.payoutMethod === "BANK"
        ? {
            contact_id: input.contactId,
            account_type: "bank_account",
            bank_account: {
              name: input.bankAccountName,
              ifsc: input.bankIfscCode,
              account_number: input.bankAccountNumber,
            },
          }
        : {
            contact_id: input.contactId,
            account_type: "vpa",
            vpa: { address: input.upiId },
          };
    const data = await this.post<{ id: string }>("fund_accounts", input, body);
    return { fundAccountId: data.id };
  }

  // `reference_id` = the withdrawal request id, so a retried initiate-payout
  // call (e.g. after a network timeout on our side) can't create a second
  // real transfer for the same request.
  async createPayout(input: CreatePayoutInput): Promise<PayoutResult> {
    const data = await this.post<{
      id: string;
      status: string;
      utr: string | null;
      failure_reason: string | null;
    }>("payouts", input, {
      account_number: input.accountNumber,
      fund_account_id: input.fundAccountId,
      amount: input.amountPaise,
      currency: "INR",
      mode: "IMPS",
      purpose: "payout",
      queue_if_low_balance: true,
      reference_id: input.referenceId,
      narration: input.narration,
    });
    return { payoutId: data.id, status: data.status, utr: data.utr, failureReason: data.failure_reason };
  }

  // Used by the manual "Check Status" reconciliation action.
  async getPayout(payoutId: string, credentials: RazorpayXCredentials): Promise<PayoutResult> {
    const res = await fetch(`https://api.razorpay.com/v1/payouts/${payoutId}`, {
      headers: { Authorization: this.authHeader(credentials.keyId, credentials.keySecret) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      this.logger.error(`RazorpayX payout lookup failed (${res.status}): ${text}`);
      throw new Error("RazorpayX payout lookup failed");
    }
    const data = (await res.json()) as {
      id: string;
      status: string;
      utr: string | null;
      failure_reason: string | null;
    };
    return { payoutId: data.id, status: data.status, utr: data.utr, failureReason: data.failure_reason };
  }

  // Verifies a payout webhook request: HMAC-SHA256(rawBody, webhookSecret) —
  // same scheme RazorpayX uses across all its webhook products.
  verifyWebhookSignature(params: { rawBody: string; signature: string; webhookSecret: string }): boolean {
    return verifyHmacSha256(params.rawBody, params.signature, params.webhookSecret);
  }
}
