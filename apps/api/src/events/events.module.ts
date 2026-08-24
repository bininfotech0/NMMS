import { Module } from "@nestjs/common";
import { MembersModule } from "../members/members.module";
import { ReferralsModule } from "../referrals/referrals.module";
import { PlansModule } from "../plans/plans.module";
import { DocumentStorageService } from "../common/document-storage.service";
import { EventsController } from "./events.controller";
import { MemberEventsController } from "./member-events.controller";
import { PublicEventBannerController } from "./public-event-banner.controller";
import { EventsService } from "./events.service";

@Module({
  imports: [MembersModule, ReferralsModule, PlansModule],
  controllers: [EventsController, MemberEventsController, PublicEventBannerController],
  providers: [EventsService, DocumentStorageService],
})
export class EventsModule {}
