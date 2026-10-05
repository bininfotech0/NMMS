import { Module } from "@nestjs/common";
import { NoticesController } from "./notices.controller";
import { MemberNoticesController } from "./member-notices.controller";
import { NoticesService } from "./notices.service";

@Module({
  controllers: [MemberNoticesController, NoticesController],
  providers: [NoticesService],
  exports: [NoticesService],
})
export class NoticesModule {}
