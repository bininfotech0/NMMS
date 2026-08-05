import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

// Magic-byte signatures for the fixed 3-type allowlist above — checked
// against the actual file content, not the client-supplied Content-Type,
// which a caller can set to anything regardless of what bytes it sends.
const MAGIC_BYTES: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
};

@Injectable()
export class DocumentStorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = config.get<string>(
      "STORAGE_ROOT",
      path.join(process.cwd(), "..", "..", "storage"),
    );
  }

  isAllowedMimeType(mimeType: string): boolean {
    return mimeType in EXTENSION_BY_MIME;
  }

  allowedMimeTypes(): string[] {
    return Object.keys(EXTENSION_BY_MIME);
  }

  // Only meaningful once isAllowedMimeType() has already confirmed mimeType
  // is a known key — returns false for anything else, including a byte
  // buffer that doesn't match the declared type's real signature.
  matchesDeclaredType(mimeType: string, buffer: Buffer): boolean {
    const signature = MAGIC_BYTES[mimeType];
    if (!signature) return false;
    if (buffer.length < signature.length) return false;
    return signature.every((byte, i) => buffer[i] === byte);
  }

  // filePath is always server-generated (organizationId/memberId/uuid.ext) —
  // never derived from client-supplied file names, to rule out path traversal.
  async save(
    organizationId: string,
    memberId: string,
    mimeType: string,
    buffer: Buffer,
  ): Promise<string> {
    const ext = EXTENSION_BY_MIME[mimeType];
    const relativeDir = path.join(organizationId, memberId);
    await mkdir(path.join(this.root, relativeDir), { recursive: true });
    const relativePath = path.join(relativeDir, `${randomUUID()}.${ext}`);
    await writeFile(path.join(this.root, relativePath), buffer);
    return relativePath;
  }

  readStream(filePath: string) {
    return createReadStream(path.join(this.root, filePath));
  }

  async remove(filePath: string): Promise<void> {
    await unlink(path.join(this.root, filePath)).catch(() => {});
  }
}
