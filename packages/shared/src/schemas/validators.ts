import { z } from "zod";

// Reusable format checks for India-specific fields used across several
// schemas (member, KYC payout details) — centralized so every call site
// enforces the same rule instead of drifting (e.g. one form accepting a
// mobile number with letters because it only checked length).

// TRAI numbering plan: 10 digits, first digit 6-9.
export const indianMobileSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number");

// Indian PIN code: 6 digits, first digit 1-9 (no leading zero).
export const indianPincodeSchema = z.string().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode");

// Bank IFSC: 4-letter bank code + '0' + 6-character branch code.
export const ifscSchema = z
  .string()
  .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC code (e.g. SBIN0001234)");

// UPI VPA: handle@bank, e.g. 9876543210@paytm or name@okicici.
export const upiIdSchema = z.string().regex(/^[\w.-]{2,256}@[a-zA-Z]{2,64}$/, "Enter a valid UPI ID (e.g. name@bank)");
