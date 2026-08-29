import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";

// Raw wire-level cap (fastify-multipart's registered limit in main.ts) —
// generous enough for an uncompressed phone-camera photo to get through to
// processUpload() below, which then compresses it down under
// MAX_STORED_UPLOAD_BYTES before it's saved or sent anywhere.
export const MAX_RAW_UPLOAD_BYTES = 10 * 1024 * 1024;

// What's actually allowed to be stored/forwarded once processUpload() is
// done — images get compressed to fit this; non-image files (PDF) are
// rejected outright if the raw upload already exceeds it, since there's
// nothing to compress.
export const MAX_STORED_UPLOAD_BYTES = 2 * 1024 * 1024;

const COMPRESSIBLE_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 82;

// Downscales to MAX_DIMENSION on the longer side (never upscales) and
// re-encodes at a lossy-but-clean quality; .rotate() with no args
// auto-applies the EXIF orientation tag and then, like the rest of the
// pipeline, drops EXIF entirely (including GPS) from the output — desirable
// for member photos/ID scans regardless of the size win. A phone photo
// routinely lands at 4-8 MB / 4000px+ on a side, far more than a membership
// photo or ID scan needs to stay legible.
export async function processUpload(mimeType: string, buffer: Buffer): Promise<Buffer> {
  if (!COMPRESSIBLE_MIME_TYPES.has(mimeType)) {
    if (buffer.length > MAX_STORED_UPLOAD_BYTES) {
      throw new BadRequestException("File exceeds the 2 MB upload limit");
    }
    return buffer;
  }

  let compressed: Buffer;
  try {
    const pipeline = sharp(buffer)
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true });
    compressed =
      mimeType === "image/png"
        ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
        : await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
  } catch {
    throw new BadRequestException("Could not process the uploaded image");
  }

  // Never make a pathological/already-tiny input bigger by re-encoding it.
  const result = compressed.length < buffer.length ? compressed : buffer;
  if (result.length > MAX_STORED_UPLOAD_BYTES) {
    throw new BadRequestException("Image exceeds the 2 MB upload limit even after compression");
  }
  return result;
}
