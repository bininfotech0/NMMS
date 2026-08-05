import { Module } from "@nestjs/common";
import { IntegrationsModule } from "../integrations/integrations.module";
import { NotificationService } from "./notification.service";

@Module({
  imports: [IntegrationsModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}
