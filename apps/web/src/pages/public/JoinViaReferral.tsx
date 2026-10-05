import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
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
      setError("Please wait a moment while we check the invite code.");
      return;
    }
    if (normalizedReferralCode && resolvedReferralCode !== normalizedReferralCode) {
      setError("We couldn't find the invite code. Check it, or leave the box empty.");
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

        <h1 className="mt-6 text-center font-heading text-lg font-semibold">Become a member</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          It takes about 5 minutes. Keep your Aadhaar card and a photo ready.
        </p>

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
            <Label htmlFor="referralCode">Who invited you? (optional)</Label>
            <Input
              id="referralCode"
              placeholder="Their code or member number"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              autoComplete="off"
              aria-describedby="referralCode-help referralCode-status"
            />
            <p id="referralCode-help" className="text-xs text-muted-foreground">
              If a member invited you, enter their code or member number. Otherwise leave this empty.
            </p>
            <p id="referralCode-status" className="min-h-4 text-xs text-muted-foreground" aria-live="polite">
              {isResolvingReferral
                ? "Checking…"
                : referrerName
                  ? `Referred by ${referrerName}`
                  : referralCode.trim()
                    ? "We couldn't find this code. Check it, or leave the box empty."
                    : ""}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile">Mobile number</Label>
            <p className="text-xs text-muted-foreground">10 digits. You will use this to sign in.</p>
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
              title="Aadhaar number has 12 digits"
              maxLength={12}
              required
            />
            <p className="text-xs text-muted-foreground">Kept private. Only used to stop duplicate accounts.</p>
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
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Write it down somewhere safe — you'll need it to sign in.</p>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
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
