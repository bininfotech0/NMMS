import { Module } from "@nestjs/common";
import { IntegrationsModule } from "../integrations/integrations.module";
import { NotificationService } from "./notification.service";
import { TwilioProvider } from "./providers/twilio-provider";
import { ResendEmailProvider } from "./providers/resend-provider";

@Module({
  imports: [IntegrationsModule],
  providers: [NotificationService, TwilioProvider, ResendEmailProvider],
  exports: [NotificationService],
})
export class NotificationsModule {}
