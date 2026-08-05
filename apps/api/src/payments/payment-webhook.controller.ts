import { Controller, Headers, HttpCode, Param, Post, Req } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { PaymentGatewayService } from "./gateway/payment-gateway.service";

// No JwtAuthGuard — this is Razorpay's server-to-server callback, authenticated
// instead via the x-razorpay-signature HMAC header (see PaymentGatewayService.
// handleWebhook). The organizationId in the path tells us which org's webhook
// secret to verify against; each org's Razorpay dashboard is configured to
// POST to its own URL (shown in Settings → Integrations).
@ApiExcludeController()
@Controller("webhooks/razorpay")
export class PaymentWebhookController {
  constructor(private readonly paymentGatewayService: PaymentGatewayService) {}

  @Post(":organizationId")
  @HttpCode(200)
  async handle(
    @Param("organizationId") organizationId: string,
    @Req() req: FastifyRequest & { rawBody?: Buffer },
    @Headers("x-razorpay-signature") signature: string | undefined,
  ) {
    const rawBody = req.rawBody?.toString("utf8") ?? JSON.stringify(req.body ?? {});
    await this.paymentGatewayService.handleWebhook(organizationId, rawBody, signature);
    return { received: true };
  }
}
