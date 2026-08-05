import { Module } from "@nestjs/common";
import { NumberingService } from "../common/numbering.service";
import { MembersModule } from "../members/members.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ReferralsModule } from "../referrals/referrals.module";
import { ApplicationsController } from "./applications.controller";
import { ApplicationsService } from "./applications.service";

@Module({
  imports: [MembersModule, NotificationsModule, ReferralsModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, NumberingService],
})
export class ApplicationsModule {}
