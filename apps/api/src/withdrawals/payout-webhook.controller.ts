import { Controller, Headers, HttpCode, Param, Post, Req } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { PayoutGatewayService } from "./gateway/payout-gateway.service";

// No JwtAuthGuard — this is RazorpayX's server-to-server callback,
// authenticated via the x-razorpay-signature HMAC header (see
// PayoutGatewayService.handleWebhook), same scheme as the collection-side
// webhook in payments/payment-webhook.controller.ts. organizationId in the
// path selects which org's payout webhook secret to verify against.
@ApiExcludeController()
@Controller("webhooks/razorpayx-payouts")
export class PayoutWebhookController {
  constructor(private readonly payoutGatewayService: PayoutGatewayService) {}

  @Post(":organizationId")
  @HttpCode(200)
  async handle(
    @Param("organizationId") organizationId: string,
    @Req() req: FastifyRequest & { rawBody?: Buffer },
    @Headers("x-razorpay-signature") signature: string | undefined,
  ) {
    const rawBody = req.rawBody?.toString("utf8") ?? JSON.stringify(req.body ?? {});
    await this.payoutGatewayService.handleWebhook(organizationId, rawBody, signature);
    return { received: true };
  }
}
