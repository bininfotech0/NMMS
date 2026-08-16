import { createHmac, timingSafeEqual } from "node:crypto";

// Constant-time string comparison — length check first since timingSafeEqual
// throws (rather than returning false) when buffer lengths differ.
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyHmacSha256(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  return safeEqual(expected, signature);
}
