import { Module } from "@nestjs/common";
import { MembersModule } from "../members/members.module";
import { ReferralsModule } from "../referrals/referrals.module";
import { DocumentStorageService } from "../common/document-storage.service";
import { EventsController } from "./events.controller";
import { MemberEventsController } from "./member-events.controller";
import { EventsService } from "./events.service";

@Module({
  imports: [MembersModule, ReferralsModule],
  controllers: [EventsController, MemberEventsController],
  providers: [EventsService, DocumentStorageService],
})
export class EventsModule {}
