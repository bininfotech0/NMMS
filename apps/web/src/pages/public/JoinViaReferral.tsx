import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { memberApiFetch } from "@/lib/member-api-client";
import { registerMember } from "@/lib/member-auth";
import type { ResolveReferralCodeResponse } from "@nmms/shared";

export function JoinViaReferral() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [referralCode, setReferralCode] = useState(() => searchParams.get("ref") ?? "");

  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [resolvedReferralCode, setResolvedReferralCode] = useState<string | null>(null);
  const [isResolvingReferral, setIsResolvingReferral] = useState(false);
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const code = referralCode.trim().toUpperCase();
    setReferrerName(null);
    setResolvedReferralCode(null);
    if (!code) {
      setIsResolvingReferral(false);
      return;
    }

    let isCurrent = true;
    setIsResolvingReferral(true);
    memberApiFetch<ResolveReferralCodeResponse>(`/public/member-auth/resolve-code?code=${encodeURIComponent(code)}`)
      .then((res) => {
        if (!isCurrent) return;
        setReferrerName(res.fullName);
        setResolvedReferralCode(code);
      })
      .catch(() => {
        if (!isCurrent) return;
        setReferrerName(null);
        setResolvedReferralCode(null);
      })
      .finally(() => {
        if (isCurrent) setIsResolvingReferral(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [referralCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalizedReferralCode = referralCode.trim().toUpperCase();
    if (normalizedReferralCode && isResolvingReferral) {
      setError("Please wait while we check the referral code.");
      return;
    }
    if (normalizedReferralCode && resolvedReferralCode !== normalizedReferralCode) {
      setError("Please enter a valid referral code, or clear the optional field to continue without one.");
      return;
    }
    setIsSubmitting(true);
    try {
      await registerMember({
        fullName,
        mobile,
        aadhaarNumber,
        email: email || undefined,
        password,
        referralCode: normalizedReferralCode || undefined,
      });
      navigate("/member");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg-soft px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-8 shadow-sm">
        <div className="flex justify-center">
          <Logo variant="stacked" size={44} />
        </div>

        <h1 className="mt-6 text-center font-heading text-lg font-semibold">Join as a member</h1>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="referralCode">Referral code or Member ID (optional)</Label>
            <Input
              id="referralCode"
              placeholder="Referral code or Member ID"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              autoComplete="off"
              aria-describedby="referralCode-help referralCode-status"
            />
            <p id="referralCode-help" className="text-xs text-muted-foreground">
              Enter the member's referral code, membership number, or Member ID. You can also open their invite link.
              Leave blank if you weren't referred.
            </p>
            <p id="referralCode-status" className="min-h-4 text-xs text-muted-foreground" aria-live="polite">
              {isResolvingReferral
                ? "Checking referral code…"
                : referrerName
                  ? `Referred by ${referrerName}`
                  : referralCode.trim()
                    ? "Code not found. Check it or clear the field to continue without a referral."
                    : ""}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile">Mobile number</Label>
            <Input
              id="mobile"
              type="tel"
              inputMode="numeric"
              pattern="[6-9][0-9]{9}"
              maxLength={10}
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aadhaarNumber">Aadhaar number</Label>
            <Input
              id="aadhaarNumber"
              placeholder="12-digit number"
              value={aadhaarNumber}
              onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, ""))}
              pattern="\d{12}"
              title="Aadhaar number must be exactly 12 digits"
              maxLength={12}
              required
            />
            <p className="text-xs text-muted-foreground">Only stored as a hash for duplicate checks.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Create a password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand-green hover:bg-brand-green/90"
          >
            {isSubmitting ? "Submitting…" : "Join now"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Already a member?{" "}
          <a href="/login" className="font-medium text-brand-green hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
