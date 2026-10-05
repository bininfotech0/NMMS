import { Injectable, Logger } from "@nestjs/common";

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

// Thin wrapper around Twilio's Messages REST API — no SDK, same "one POST,
// Basic auth" shape as RazorpayProvider. Used for both SMS (fromNumber as-is)
// and WhatsApp (fromNumber/to prefixed "whatsapp:", per Twilio's WhatsApp API).
// Members' mobiles are stored as 10-digit Indian numbers, but Twilio only
// accepts E.164 ("+91XXXXXXXXXX") — without this every SMS/WhatsApp to a
// member was rejected.
export function toE164(mobile: string): string {
  const digits = mobile.replace(/[\s-]/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return digits;
}

@Injectable()
export class TwilioProvider {
  private readonly logger = new Logger(TwilioProvider.name);

  private async send(to: string, from: string, body: string, credentials: TwilioCredentials): Promise<void> {
    const auth = Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      this.logger.error(`Twilio send failed (${res.status}): ${text}`);
      throw new Error("Twilio message send failed");
    }
  }

  async sendSms(to: string, body: string, credentials: TwilioCredentials): Promise<void> {
    await this.send(toE164(to), credentials.fromNumber, body, credentials);
  }

  async sendWhatsApp(to: string, body: string, credentials: TwilioCredentials): Promise<void> {
    await this.send(`whatsapp:${toE164(to)}`, `whatsapp:${credentials.fromNumber}`, body, credentials);
  }
}
