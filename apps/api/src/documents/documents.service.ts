import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthUser, DocumentType, MemberDocumentResponse } from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { DocumentStorageService } from "../common/document-storage.service";
import { buildJurisdictionWhere } from "../common/scope.util";
import { MembersService } from "../members/members.service";

interface UploadInput {
  type: DocumentType;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

type DocumentWithRelations = {
  id: string;
  memberId: string;
  member: { fullName: string };
  type: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  uploadedBy: { email: string };
  createdAt: Date;
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: DocumentStorageService,
    private readonly membersService: MembersService,
  ) {}

  async upload(memberId: string, input: UploadInput, user: AuthUser): Promise<MemberDocumentResponse> {
    await this.membersService.findOne(memberId, user); // authorizes visibility, 404s if out of scope

    if (!this.storage.isAllowedMimeType(input.mimeType)) {
      throw new BadRequestException(
        `Unsupported file type. Allowed: ${this.storage.allowedMimeTypes().join(", ")}`,
      );
    }
    if (!this.storage.matchesDeclaredType(input.mimeType, input.buffer)) {
      throw new BadRequestException("File content does not match the declared file type");
    }

    const filePath = await this.storage.save(user.organizationId, memberId, input.mimeType, input.buffer);

    const doc = await this.prisma.memberDocument.create({
      data: {
        organizationId: user.organizationId,
        memberId,
        type: input.type,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.buffer.length,
        filePath,
        uploadedById: user.id,
      },
      include: { member: { select: { fullName: true } }, uploadedBy: { select: { email: true } } },
    });
    return this.toResponse(doc);
  }

  // Member-portal self-service — memberId comes only from the verified
  // member JWT, so no authorization lookup is needed. uploadedById (a
  // required FK to User, not Member) is attributed to the member's own
  // createdById — the system sentinel user MemberAuthService.register used
  // — same convention MembersService.submitMine/StatusHistory.actorId use
  // for a self-service action with no staff actor in context.
  async uploadMine(memberId: string, input: UploadInput): Promise<MemberDocumentResponse> {
    const member = await this.prisma.member.findUniqueOrThrow({ where: { id: memberId } });

    if (!this.storage.isAllowedMimeType(input.mimeType)) {
      throw new BadRequestException(
        `Unsupported file type. Allowed: ${this.storage.allowedMimeTypes().join(", ")}`,
      );
    }
    if (!this.storage.matchesDeclaredType(input.mimeType, input.buffer)) {
      throw new BadRequestException("File content does not match the declared file type");
    }

    const filePath = await this.storage.save(member.organizationId, memberId, input.mimeType, input.buffer);

    const doc = await this.prisma.memberDocument.create({
      data: {
        organizationId: member.organizationId,
        memberId,
        type: input.type,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.buffer.length,
        filePath,
        uploadedById: member.createdById,
      },
      include: { member: { select: { fullName: true } }, uploadedBy: { select: { email: true } } },
    });
    return this.toResponse(doc);
  }

  async findByMember(memberId: string, user: AuthUser): Promise<MemberDocumentResponse[]> {
    await this.membersService.findOne(memberId, user);
    const docs = await this.prisma.memberDocument.findMany({
      where: { memberId },
      include: { member: { select: { fullName: true } }, uploadedBy: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return docs.map((d) => this.toResponse(d));
  }

  // Member-portal self-service — memberId comes only from the verified
  // member JWT (never a client-supplied param), so the caller's identity IS
  // the authorization: no jurisdiction/membersService.findOne check needed,
  // a member can only ever be themselves.
  async findMine(memberId: string): Promise<MemberDocumentResponse[]> {
    const docs = await this.prisma.memberDocument.findMany({
      where: { memberId },
      include: { member: { select: { fullName: true } }, uploadedBy: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return docs.map((d) => this.toResponse(d));
  }

  async getFileForMember(documentId: string, memberId: string) {
    const doc = await this.prisma.memberDocument.findFirst({ where: { id: documentId, memberId } });
    if (!doc) {
      throw new NotFoundException("Document not found");
    }
    return {
      stream: this.storage.readStream(doc.filePath),
      mimeType: doc.mimeType,
      fileName: doc.fileName,
    };
  }

  async findAll(user: AuthUser): Promise<MemberDocumentResponse[]> {
    const docs = await this.prisma.memberDocument.findMany({
      where: {
        organizationId: user.organizationId,
        member: buildJurisdictionWhere(user),
      },
      include: { member: { select: { fullName: true } }, uploadedBy: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return docs.map((d) => this.toResponse(d));
  }

  async getFile(id: string, user: AuthUser) {
    const doc = await this.findScoped(id, user);
    return {
      stream: this.storage.readStream(doc.filePath),
      mimeType: doc.mimeType,
      fileName: doc.fileName,
    };
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    const doc = await this.findScoped(id, user);
    await this.prisma.memberDocument.delete({ where: { id } });
    await this.storage.remove(doc.filePath);
  }

  private async findScoped(id: string, user: AuthUser) {
    const doc = await this.prisma.memberDocument.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        member: buildJurisdictionWhere(user),
      },
    });
    if (!doc) {
      throw new NotFoundException("Document not found");
    }
    return doc;
  }

  private toResponse(doc: DocumentWithRelations): MemberDocumentResponse {
    return {
      id: doc.id,
      memberId: doc.memberId,
      memberName: doc.member.fullName,
      type: doc.type as MemberDocumentResponse["type"],
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      uploadedById: doc.uploadedById,
      uploadedByEmail: doc.uploadedBy.email,
      createdAt: doc.createdAt,
    };
  }
}
