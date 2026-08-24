import { Module } from "@nestjs/common";
import { DocumentStorageService } from "../common/document-storage.service";
import { MembersModule } from "../members/members.module";
import { DocumentsController } from "./documents.controller";
import { MemberDocumentsController } from "./member-documents.controller";
import { MemberDocumentsSelfController } from "./member-documents-self.controller";
import { DocumentsService } from "./documents.service";

@Module({
  imports: [MembersModule],
  // MemberDocumentsSelfController ("members/me/documents") registered before
  // MemberDocumentsController ("members/:memberId/documents") so "me" isn't
  // shadowed by ":memberId".
  controllers: [MemberDocumentsSelfController, MemberDocumentsController, DocumentsController],
  providers: [DocumentsService, DocumentStorageService],
})
export class DocumentsModule {}
