import { createHmac } from "node:crypto";
import { RazorpayProvider } from "./razorpay-provider";

describe("RazorpayProvider.verifyPaymentSignature", () => {
  const provider = new RazorpayProvider();
  const keySecret = "test_key_secret";

  it("accepts a signature computed the same way Razorpay's checkout handler does", () => {
    const orderId = "order_ABC123";
    const paymentId = "pay_XYZ789";
    const signature = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");

    expect(provider.verifyPaymentSignature({ orderId, paymentId, signature, keySecret })).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const orderId = "order_ABC123";
    const paymentId = "pay_XYZ789";
    const signature = createHmac("sha256", "wrong_secret").update(`${orderId}|${paymentId}`).digest("hex");

    expect(provider.verifyPaymentSignature({ orderId, paymentId, signature, keySecret })).toBe(false);
  });

  it("rejects a tampered payment id even with an otherwise-valid signature", () => {
    const orderId = "order_ABC123";
    const signature = createHmac("sha256", keySecret).update(`${orderId}|pay_original`).digest("hex");

    expect(
      provider.verifyPaymentSignature({ orderId, paymentId: "pay_tampered", signature, keySecret }),
    ).toBe(false);
  });

  it("rejects a malformed/garbage signature without throwing", () => {
    expect(
      provider.verifyPaymentSignature({
        orderId: "order_ABC123",
        paymentId: "pay_XYZ789",
        signature: "not-a-real-signature",
        keySecret,
      }),
    ).toBe(false);
  });
});

describe("RazorpayProvider.verifyWebhookSignature", () => {
  const provider = new RazorpayProvider();
  const webhookSecret = "test_webhook_secret";

  it("accepts a signature computed over the exact raw body bytes", () => {
    const rawBody = JSON.stringify({ event: "payment.captured", payload: {} });
    const signature = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

    expect(provider.verifyWebhookSignature({ rawBody, signature, webhookSecret })).toBe(true);
  });

  it("rejects when the body differs from what was signed (e.g. re-serialized/reformatted JSON)", () => {
    const originalBody = '{"event":"payment.captured","payload":{}}';
    const signature = createHmac("sha256", webhookSecret).update(originalBody).digest("hex");
    const reformattedBody = JSON.stringify(JSON.parse(originalBody), null, 2);

    expect(provider.verifyWebhookSignature({ rawBody: reformattedBody, signature, webhookSecret })).toBe(
      false,
    );
  });

  it("rejects a signature signed with a different webhook secret", () => {
    const rawBody = JSON.stringify({ event: "payment.captured" });
    const signature = createHmac("sha256", "other_secret").update(rawBody).digest("hex");

    expect(provider.verifyWebhookSignature({ rawBody, signature, webhookSecret })).toBe(false);
  });
});
