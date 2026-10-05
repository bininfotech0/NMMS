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
    }
  | {
      type: "MEMBERSHIP_EXPIRING";
      organizationId: string;
      memberName: string;
      mobile: string;
      email: string | null;
      daysLeft: number;
      validUntil: Date;
    }
  | {
      type: "MEMBERSHIP_EXPIRED";
      organizationId: string;
      memberName: string;
      mobile: string;
      email: string | null;
    };

function formatDay(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

function expiringPhrase(daysLeft: number): string {
  return daysLeft <= 1 ? "tomorrow" : `in ${daysLeft} days`;
}

function smsBody(event: NotificationEvent): string {
  if (event.type === "MEMBERSHIP_EXPIRING") {
    return `Dear ${event.memberName}, your NMMS membership ends ${expiringPhrase(event.daysLeft)} (${formatDay(event.validUntil)}). After it ends you can renew online from the member portal.`;
  }
  if (event.type === "MEMBERSHIP_EXPIRED") {
    return `Dear ${event.memberName}, your NMMS membership has ended. Log in to the member portal and tap "Renew now" to become an active member again.`;
  }
  if (event.type === "PAYMENT_RECEIPT") {
    return `Dear ${event.memberName}, your NMMS membership fee of Rs.${event.amount} was received. Receipt #${event.receiptNumber}.`;
  }
  if (event.type === "PLAN_UPGRADED") {
    return `Dear ${event.memberName}, your NMMS membership has been upgraded from ${event.oldPlanName} to ${event.newPlanName}.${event.amount > 0 ? ` Rs.${event.amount} received, receipt #${event.receiptNumber}.` : ""}`;
  }
  return `Dear ${event.memberName}, welcome to NMMS! Your membership${event.membershipNumber ? ` (#${event.membershipNumber})` : ""} is now active.`;
}

function emailSubject(event: NotificationEvent): string {
  if (event.type === "MEMBERSHIP_EXPIRING") return `Your membership ends ${expiringPhrase(event.daysLeft)}`;
  if (event.type === "MEMBERSHIP_EXPIRED") return "Your membership has ended — renew online";
  if (event.type === "PAYMENT_RECEIPT") return "Payment received";
  if (event.type === "PLAN_UPGRADED") return "Membership plan upgraded";
  return "Welcome to NMMS";
}

function emailBody(event: NotificationEvent): string {
  if (event.type === "MEMBERSHIP_EXPIRING") {
    return `Dear ${event.memberName},\n\nYour NMMS membership ends ${expiringPhrase(event.daysLeft)}, on ${formatDay(event.validUntil)}.\nOnce it ends, log in to the member portal and tap "Renew now" to renew online in a minute.\n\nThank you.`;
  }
  if (event.type === "MEMBERSHIP_EXPIRED") {
    return `Dear ${event.memberName},\n\nYour NMMS membership has ended.\nLog in to the member portal and tap "Renew now" to become an active member again.\n\nThank you.`;
  }
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

  // Whether SMS is switched on and has credentials — used to tell members up
  // front if "forgot password" by SMS can work at all.
  async isSmsAvailable(organizationId: string): Promise<boolean> {
    try {
      if (!(await this.integrations.isEnabled(FeatureFlagKey.SMS, organizationId))) return false;
      const credentials = await this.integrations.getDecryptedConfig<Partial<TwilioCredentials>>(FeatureFlagKey.SMS, organizationId);
      return !!(credentials?.accountSid && credentials.authToken && credentials.fromNumber);
    } catch {
      return false;
    }
  }

  // Sends one SMS right away (e.g. a password reset code). Unlike notify(),
  // returns whether it was actually sent so the caller can react.
  async sendSmsNow(organizationId: string, mobile: string, body: string): Promise<boolean> {
    try {
      if (!(await this.integrations.isEnabled(FeatureFlagKey.SMS, organizationId))) return false;
      const credentials = await this.integrations.getDecryptedConfig<Partial<TwilioCredentials>>(FeatureFlagKey.SMS, organizationId);
      if (!credentials?.accountSid || !credentials.authToken || !credentials.fromNumber) return false;
      await this.twilio.sendSms(mobile, body, {
        accountSid: credentials.accountSid,
        authToken: credentials.authToken,
        fromNumber: credentials.fromNumber,
      });
      return true;
    } catch (err) {
      this.logger.error("Failed to send SMS", err instanceof Error ? err.stack : err);
      return false;
    }
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
