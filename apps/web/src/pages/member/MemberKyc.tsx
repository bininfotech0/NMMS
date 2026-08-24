import { useEffect, useState } from "react";
import { CheckCircle2, Clock, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import { useMyKyc, useSubmitKyc } from "@/hooks/useKyc";
import type { PayoutMethod } from "@nmms/shared";

const STATUS_INFO: Record<string, { icon: typeof ShieldCheck; label: string; className: string }> = {
  NOT_SUBMITTED: { icon: ShieldAlert, label: "Not submitted", className: "bg-muted text-muted-foreground" },
  PENDING: { icon: Clock, label: "Under review", className: "bg-amber-100 text-amber-700" },
  VERIFIED: { icon: CheckCircle2, label: "Verified", className: "bg-emerald-100 text-emerald-700" },
  REJECTED: { icon: ShieldAlert, label: "Rejected", className: "bg-red-100 text-red-700" },
};

export function MemberKyc() {
  const { data: kyc, isLoading } = useMyKyc();
  const submitKyc = useSubmitKyc();

  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("BANK");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfscCode, setBankIfscCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [upiId, setUpiId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!kyc) return;
    setPayoutMethod(kyc.payoutMethod ?? "BANK");
    setBankAccountName(kyc.bankAccountName ?? "");
    setBankIfscCode(kyc.bankIfscCode ?? "");
    setBankName(kyc.bankName ?? "");
    setUpiId(kyc.upiId ?? "");
    // Never pre-filled — the API only ever returns the last-4 digits.
    setBankAccountNumber("");
  }, [kyc]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await submitKyc.mutateAsync({
        payoutMethod,
        ...(payoutMethod === "BANK"
          ? { bankAccountName, bankAccountNumber, bankIfscCode, bankName: bankName || undefined }
          : { upiId }),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (isLoading || !kyc) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const status = STATUS_INFO[kyc.kycStatus];
  const StatusIcon = status.icon;

  return (
    <div className="space-y-4">
      <Card className="gap-3 py-4">
        <CardContent className="flex items-center gap-3 px-4">
          <div className={cn("flex size-10 items-center justify-center rounded-lg", status.className)}>
            <StatusIcon className="size-5" />
          </div>
          <div>
            <p className="font-medium">{status.label}</p>
            {kyc.kycStatus === "REJECTED" && kyc.kycReviewNote && (
              <p className="text-sm text-destructive">{kyc.kycReviewNote}</p>
            )}
            {kyc.kycStatus === "VERIFIED" && (
              <p className="text-sm text-muted-foreground">You can now withdraw earned points as money.</p>
            )}
            {kyc.kycStatus === "PENDING" && (
              <p className="text-sm text-muted-foreground">Our team is reviewing your submission.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Identity on file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Aadhaar</span>
            <span>{kyc.aadhaarLast4 ? `XXXX-XXXX-${kyc.aadhaarLast4}` : "Not on file"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">PAN</span>
            <span>{kyc.pan ?? "Not on file"}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            To update your Aadhaar or PAN, contact staff to update your membership profile.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payout details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className={cn(payoutMethod === "BANK" && "border-brand-green text-brand-green")}
                onClick={() => setPayoutMethod("BANK")}
              >
                Bank Account
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn(payoutMethod === "UPI" && "border-brand-green text-brand-green")}
                onClick={() => setPayoutMethod("UPI")}
              >
                UPI
              </Button>
            </div>

            {payoutMethod === "BANK" ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bankAccountName">Account holder name</Label>
                  <Input
                    id="bankAccountName"
                    value={bankAccountName}
                    onChange={(e) => setBankAccountName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bankAccountNumber">
                    Account number {kyc.bankAccountNumberLast4 && `(currently on file: ...${kyc.bankAccountNumberLast4})`}
                  </Label>
                  <Input
                    id="bankAccountNumber"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    placeholder="Re-enter your account number"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bankIfscCode">IFSC code</Label>
                  <Input
                    id="bankIfscCode"
                    value={bankIfscCode}
                    onChange={(e) => setBankIfscCode(e.target.value.toUpperCase())}
                    pattern="[A-Z]{4}0[A-Z0-9]{6}"
                    placeholder="SBIN0001234"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bankName">Bank name (optional)</Label>
                  <Input id="bankName" value={bankName} onChange={(e) => setBankName(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="upiId">UPI ID</Label>
                <Input
                  id="upiId"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  pattern="[\w.-]{2,256}@[a-zA-Z]{2,64}"
                  placeholder="name@bank"
                  required
                />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={submitKyc.isPending} className="bg-brand-green hover:bg-brand-green/90">
              {submitKyc.isPending ? "Submitting…" : "Submit for review"}
            </Button>
            {kyc.kycStatus === "VERIFIED" && (
              <p className="text-xs text-muted-foreground">
                Changing your payout details will require re-verification before you can withdraw again.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
