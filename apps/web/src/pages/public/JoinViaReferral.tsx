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
  const referralCode = searchParams.get("ref") ?? undefined;

  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!referralCode) return;
    memberApiFetch<ResolveReferralCodeResponse>(`/public/member-auth/resolve-code?code=${encodeURIComponent(referralCode)}`)
      .then((res) => setReferrerName(res.fullName))
      .catch(() => setReferrerName(null));
  }, [referralCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await registerMember({ fullName, mobile, password, referralCode });
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
        {referralCode && (
          <p className="mt-1 text-center text-sm text-muted-foreground">
            {referrerName ? (
              <>
                You're joining via <span className="font-medium text-foreground">{referrerName}</span>'s invite
              </>
            ) : (
              "Referral link"
            )}
          </p>
        )}

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
            <Label htmlFor="mobile">Mobile number</Label>
            <Input
              id="mobile"
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              required
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
          <a href="/member/login" className="font-medium text-brand-green hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
