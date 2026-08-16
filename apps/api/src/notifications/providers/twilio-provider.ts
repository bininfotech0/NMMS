import { Injectable, Logger } from "@nestjs/common";

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

// Thin wrapper around Twilio's Messages REST API — no SDK, same "one POST,
// Basic auth" shape as RazorpayProvider. Used for both SMS (fromNumber as-is)
// and WhatsApp (fromNumber/to prefixed "whatsapp:", per Twilio's WhatsApp API).
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
    await this.send(to, credentials.fromNumber, body, credentials);
  }

  async sendWhatsApp(to: string, body: string, credentials: TwilioCredentials): Promise<void> {
    await this.send(`whatsapp:${to}`, `whatsapp:${credentials.fromNumber}`, body, credentials);
  }
}
