import { Module } from "@nestjs/common";
import { DocumentStorageService } from "../common/document-storage.service";
import { MembersModule } from "../members/members.module";
import { DocumentsController } from "./documents.controller";
import { MemberDocumentsController } from "./member-documents.controller";
import { DocumentsService } from "./documents.service";

@Module({
  imports: [MembersModule],
  controllers: [MemberDocumentsController, DocumentsController],
  providers: [DocumentsService, DocumentStorageService],
})
export class DocumentsModule {}
