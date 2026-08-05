import { Injectable, Logger } from "@nestjs/common";
import { FeatureFlagKey } from "@prisma/client";
import { IntegrationsService } from "../integrations/integrations.service";

export type NotificationEvent =
  | {
      type: "PAYMENT_RECEIPT";
      organizationId: string;
      memberName: string;
      mobile: string;
      amount: number;
      receiptNumber: string;
    }
  | {
      type: "APPROVAL_WELCOME";
      organizationId: string;
      memberName: string;
      mobile: string;
      membershipNumber: string | null;
    };

export interface NotificationProvider {
  send(event: NotificationEvent): Promise<void>;
}

// No SMS/WhatsApp vendor is integrated yet — this just logs. Swap in a real
// provider (Twilio, MSG91, Gupshup, ...) here once one is chosen; the
// WHATSAPP_NOTIFY/SMS feature flags (checked in NotificationService.notify)
// are the gate that gets flipped on to start actually sending.
class LogNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger(LogNotificationProvider.name);

  async send(event: NotificationEvent): Promise<void> {
    this.logger.log(`[notification stub] ${event.type} -> ${event.mobile}: ${JSON.stringify(event)}`);
  }
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly provider: NotificationProvider = new LogNotificationProvider();

  constructor(private readonly integrations: IntegrationsService) {}

  // Best-effort: notify() is always called after the primary DB write (payment
  // recorded / member approved) has already committed. A provider failure here
  // must never surface as a failed request for an operation that actually
  // succeeded — swallow and log instead of letting it propagate.
  async notify(event: NotificationEvent): Promise<void> {
    try {
      const [whatsappEnabled, smsEnabled] = await Promise.all([
        this.integrations.isEnabled(FeatureFlagKey.WHATSAPP_NOTIFY, event.organizationId),
        this.integrations.isEnabled(FeatureFlagKey.SMS, event.organizationId),
      ]);
      if (!whatsappEnabled && !smsEnabled) {
        return;
      }
      await this.provider.send(event);
    } catch (err) {
      this.logger.error(`Failed to send ${event.type} notification`, err instanceof Error ? err.stack : err);
    }
  }
}
