import { Injectable, Logger } from "@nestjs/common";
import { FeatureFlagKey } from "@prisma/client";
import { IntegrationsService } from "../integrations/integrations.service";
import { TwilioCredentials, TwilioProvider } from "./providers/twilio-provider";
import { ResendCredentials, ResendEmailProvider } from "./providers/resend-provider";

export type NotificationEvent =
  | {
      type: "PAYMENT_RECEIPT";
      organizationId: string;
      memberName: string;
      mobile: string;
      email: string | null;
      amount: number;
      receiptNumber: string;
    }
  | {
      type: "APPROVAL_WELCOME";
      organizationId: string;
      memberName: string;
      mobile: string;
      email: string | null;
      membershipNumber: string | null;
    }
  | {
      type: "PLAN_UPGRADED";
      organizationId: string;
      memberName: string;
      mobile: string;
      email: string | null;
      oldPlanName: string;
      newPlanName: string;
      amount: number;
      receiptNumber: string | null;
    };

function smsBody(event: NotificationEvent): string {
  if (event.type === "PAYMENT_RECEIPT") {
    return `Dear ${event.memberName}, your NMMS membership fee of Rs.${event.amount} was received. Receipt #${event.receiptNumber}.`;
  }
  if (event.type === "PLAN_UPGRADED") {
    return `Dear ${event.memberName}, your NMMS membership has been upgraded from ${event.oldPlanName} to ${event.newPlanName}.${event.amount > 0 ? ` Rs.${event.amount} received, receipt #${event.receiptNumber}.` : ""}`;
  }
  return `Dear ${event.memberName}, welcome to NMMS! Your membership${event.membershipNumber ? ` (#${event.membershipNumber})` : ""} is now active.`;
}

function emailSubject(event: NotificationEvent): string {
  if (event.type === "PAYMENT_RECEIPT") return "Payment received";
  if (event.type === "PLAN_UPGRADED") return "Membership plan upgraded";
  return "Welcome to NMMS";
}

function emailBody(event: NotificationEvent): string {
  if (event.type === "PAYMENT_RECEIPT") {
    return `Dear ${event.memberName},\n\nWe received your payment of Rs.${event.amount}.\nReceipt number: ${event.receiptNumber}\n\nThank you.`;
  }
  if (event.type === "PLAN_UPGRADED") {
    return `Dear ${event.memberName},\n\nYour NMMS membership has been upgraded from ${event.oldPlanName} to ${event.newPlanName}.${event.amount > 0 ? `\nAmount received: Rs.${event.amount}\nReceipt number: ${event.receiptNumber}` : ""}\n\nThank you.`;
  }
  return `Dear ${event.memberName},\n\nWelcome to NMMS! Your membership${event.membershipNumber ? ` (number ${event.membershipNumber})` : ""} is now active.\n\nThank you.`;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly twilio: TwilioProvider,
    private readonly resend: ResendEmailProvider,
  ) {}

  // Best-effort: notify() is always called after the primary DB write (payment
  // recorded / member approved) has already committed. A channel failure here
  // must never surface as a failed request for an operation that actually
  // succeeded — each channel is dispatched independently, logged, and
  // swallowed on failure rather than letting it propagate or block siblings.
  async notify(event: NotificationEvent): Promise<void> {
    await Promise.all([
      this.dispatchSms(event),
      this.dispatchWhatsApp(event),
      this.dispatchEmail(event),
    ]);
  }

  private async dispatchSms(event: NotificationEvent): Promise<void> {
    try {
      if (!(await this.integrations.isEnabled(FeatureFlagKey.SMS, event.organizationId))) return;
      const credentials = await this.integrations.getDecryptedConfig<Partial<TwilioCredentials>>(
        FeatureFlagKey.SMS,
        event.organizationId,
      );
      if (!credentials?.accountSid || !credentials.authToken || !credentials.fromNumber) return;
      await this.twilio.sendSms(event.mobile, smsBody(event), {
        accountSid: credentials.accountSid,
        authToken: credentials.authToken,
        fromNumber: credentials.fromNumber,
      });
    } catch (err) {
      this.logger.error(`Failed to send ${event.type} SMS`, err instanceof Error ? err.stack : err);
    }
  }

  private async dispatchWhatsApp(event: NotificationEvent): Promise<void> {
    try {
      if (!(await this.integrations.isEnabled(FeatureFlagKey.WHATSAPP_NOTIFY, event.organizationId))) return;
      const credentials = await this.integrations.getDecryptedConfig<Partial<TwilioCredentials>>(
        FeatureFlagKey.WHATSAPP_NOTIFY,
        event.organizationId,
      );
      if (!credentials?.accountSid || !credentials.authToken || !credentials.fromNumber) return;
      await this.twilio.sendWhatsApp(event.mobile, smsBody(event), {
        accountSid: credentials.accountSid,
        authToken: credentials.authToken,
        fromNumber: credentials.fromNumber,
      });
    } catch (err) {
      this.logger.error(`Failed to send ${event.type} WhatsApp message`, err instanceof Error ? err.stack : err);
    }
  }

  private async dispatchEmail(event: NotificationEvent): Promise<void> {
    try {
      if (!event.email) return;
      if (!(await this.integrations.isEnabled(FeatureFlagKey.EMAIL, event.organizationId))) return;
      const credentials = await this.integrations.getDecryptedConfig<Partial<ResendCredentials>>(
        FeatureFlagKey.EMAIL,
        event.organizationId,
      );
      if (!credentials?.apiKey || !credentials.fromAddress) return;
      await this.resend.sendEmail(event.email, emailSubject(event), emailBody(event), {
        apiKey: credentials.apiKey,
        fromAddress: credentials.fromAddress,
      });
    } catch (err) {
      this.logger.error(`Failed to send ${event.type} email`, err instanceof Error ? err.stack : err);
    }
  }
}
