import { toE164 } from "./twilio-provider";

describe("toE164", () => {
  it("adds +91 to a 10-digit Indian mobile", () => {
    expect(toE164("9876543210")).toBe("+919876543210");
    expect(toE164("98765 43210")).toBe("+919876543210");
  });

  it("adds + to a number that already starts with 91", () => {
    expect(toE164("919876543210")).toBe("+919876543210");
  });

  it("leaves numbers already in international format alone", () => {
    expect(toE164("+15551234567")).toBe("+15551234567");
  });
});
