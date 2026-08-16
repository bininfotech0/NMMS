import { Injectable, Logger } from "@nestjs/common";

export interface ResendCredentials {
  apiKey: string;
  fromAddress: string;
}

// Thin wrapper around Resend's REST API — no SDK, one POST with a bearer
// token, same "no SDK" philosophy as every other gateway provider here.
@Injectable()
export class ResendEmailProvider {
  private readonly logger = new Logger(ResendEmailProvider.name);

  async sendEmail(to: string, subject: string, body: string, credentials: ResendCredentials): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: credentials.fromAddress,
        to: [to],
        subject,
        text: body,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      this.logger.error(`Resend send failed (${res.status}): ${text}`);
      throw new Error("Resend email send failed");
    }
  }
}
