import { Injectable, Logger } from "@nestjs/common";
import { verifyHmacSha256 } from "../../common/hmac.util";

export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
}

export interface CreateOrderInput extends RazorpayCredentials {
  amountPaise: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
}

export interface CreateOrderResult {
  orderId: string;
  amountPaise: number;
  currency: string;
}

// Thin wrapper around Razorpay's REST API — deliberately no SDK dependency,
// since order creation is one POST and signature verification is plain HMAC.
@Injectable()
export class RazorpayProvider {
  private readonly logger = new Logger(RazorpayProvider.name);

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const auth = Buffer.from(`${input.keyId}:${input.keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: input.currency,
        receipt: input.receipt,
        notes: input.notes,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      this.logger.error(`Razorpay order creation failed (${res.status}): ${body}`);
      throw new Error("Payment gateway order creation failed");
    }

    const data = (await res.json()) as { id: string; amount: number; currency: string };
    return { orderId: data.id, amountPaise: data.amount, currency: data.currency };
  }

  // Re-fetches an order by id — used by the verify-callback path to get the
  // authoritative paid amount instead of trusting a client-supplied value
  // (the amount was fixed server-side at order-creation time and can't have
  // changed since).
  async getOrder(orderId: string, credentials: RazorpayCredentials): Promise<CreateOrderResult> {
    const auth = Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString("base64");
    const res = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      this.logger.error(`Razorpay order lookup failed (${res.status}): ${body}`);
      throw new Error("Payment gateway order lookup failed");
    }
    const data = (await res.json()) as { id: string; amount: number; currency: string };
    return { orderId: data.id, amountPaise: data.amount, currency: data.currency };
  }

  // Verifies the checkout-callback signature: HMAC-SHA256("orderId|paymentId", keySecret).
  verifyPaymentSignature(params: {
    orderId: string;
    paymentId: string;
    signature: string;
    keySecret: string;
  }): boolean {
    return verifyHmacSha256(`${params.orderId}|${params.paymentId}`, params.signature, params.keySecret);
  }

  // Verifies a webhook request: HMAC-SHA256(rawBody, webhookSecret).
  verifyWebhookSignature(params: { rawBody: string; signature: string; webhookSecret: string }): boolean {
    return verifyHmacSha256(params.rawBody, params.signature, params.webhookSecret);
  }
}
