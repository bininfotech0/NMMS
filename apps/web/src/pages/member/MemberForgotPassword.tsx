import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContactUs } from "@/components/member/ContactUs";
import { ApiError } from "@/lib/api-client";
import { memberApiFetch } from "@/lib/member-api-client";

// Two steps: (1) mobile number -> we text a 6-digit code, (2) code + new password.
export function MemberForgotPassword() {
  const navigate = useNavigate();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [step, setStep] = useState<"mobile" | "code">("mobile");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    memberApiFetch<{ available: boolean }>("/public/member-auth/password-reset/status")
      .then((res) => setAvailable(res.available))
      .catch(() => setAvailable(false));
  }, []);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await memberApiFetch("/public/member-auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify({ mobile }),
      });
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function setPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await memberApiFetch("/public/member-auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ mobile, code, newPassword }),
      });
      toast.success("Your password has been changed. Please sign in with your new password.");
      navigate("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg-soft px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-8 shadow-sm">
        <div className="flex justify-center">
          <Logo variant="stacked" size={44} />
        </div>
        <h1 className="mt-6 text-center font-heading text-lg font-semibold">Forgot your password?</h1>

        {available === null ? (
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Please wait…
          </p>
        ) : !available ? (
          <div className="mt-6 space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              We can't send a code by SMS right now. Please contact us and we'll reset your password for you.
            </p>
            <ContactUs title="Contact the NGO office" />
          </div>
        ) : step === "mobile" ? (
          <form className="mt-6 space-y-4" onSubmit={sendCode}>
            <p className="text-center text-sm text-muted-foreground">
              Enter the mobile number you joined with. We'll send you a 6-digit code by SMS.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="mobile">Mobile number</Label>
              <Input
                id="mobile"
                type="tel"
                inputMode="numeric"
                pattern="[6-9][0-9]{9}"
                maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full bg-brand-green hover:bg-brand-green/90">
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? "Sending…" : "Send me a code"}
            </Button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={setPassword}>
            <p className="text-center text-sm text-muted-foreground">
              If {mobile} is registered with us, you'll get an SMS with a 6-digit code in a minute.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="code">6-digit code from the SMS</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full bg-brand-green hover:bg-brand-green/90">
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? "Saving…" : "Set new password"}
            </Button>
            <div className="flex justify-between text-xs">
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setStep("mobile")}>
                Change number
              </button>
              <button type="button" className="font-medium text-brand-green hover:underline" disabled={busy} onClick={() => sendCode()}>
                Didn't get it? Send again
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Remembered it?{" "}
          <Link to="/login" className="font-medium text-brand-green hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
