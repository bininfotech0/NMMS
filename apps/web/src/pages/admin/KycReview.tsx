import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { ApiError } from "@/lib/api-client";
import { useAdminKycList, useRejectKyc, useRevealBankAccount, useVerifyKyc } from "@/hooks/useKyc";
import type { KycResponse, KycStatus } from "@nmms/shared";

const TABS: { label: string; value: KycStatus | undefined }[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Verified", value: "VERIFIED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Not Submitted", value: "NOT_SUBMITTED" },
  { label: "All", value: undefined },
];

const STATUS_STYLES: Record<KycStatus, string> = {
  NOT_SUBMITTED: "bg-muted text-muted-foreground",
  PENDING: "bg-amber-100 text-amber-700",
  VERIFIED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

export function KycReview() {
  const [status, setStatus] = useState<KycStatus | undefined>("PENDING");
  const { data: submissions = [], isLoading, isError } = useAdminKycList(status);
  const [detailTarget, setDetailTarget] = useState<KycResponse | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">KYC Review</h1>
        <p className="text-sm text-muted-foreground">Verify member identity and payout details</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setStatus(tab.value)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              status === tab.value
                ? "border-brand-green text-brand-green"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Payout Method</TableHead>
              <TableHead>Aadhaar</TableHead>
              <TableHead>PAN</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableSkeleton columns={6} />}
            {isError && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-destructive">
                  Failed to load KYC submissions.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              !isError &&
              submissions.map((s) => (
                <TableRow key={s.memberId}>
                  <TableCell className="font-medium">{s.memberName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.payoutMethod === "BANK"
                      ? `Bank ...${s.bankAccountNumberLast4 ?? ""}`
                      : s.payoutMethod === "UPI"
                        ? s.upiId
                        : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.aadhaarLast4 ? `XXXX-${s.aadhaarLast4}` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.pan ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={`border-transparent font-medium ${STATUS_STYLES[s.kycStatus]}`}>
                      {s.kycStatus.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => setDetailTarget(s)}>
                        Review
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && !isError && submissions.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No KYC submissions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <KycDetailSheet target={detailTarget} onOpenChange={(open) => !open && setDetailTarget(null)} />
    </div>
  );
}

function KycDetailSheet({
  target,
  onOpenChange,
}: {
  target: KycResponse | null;
  onOpenChange: (open: boolean) => void;
}) {
  const verifyKyc = useVerifyKyc();
  const rejectKyc = useRejectKyc();
  const revealBankAccount = useRevealBankAccount();
  const [rejectNote, setRejectNote] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [revealedNumber, setRevealedNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setRejectNote("");
    setShowReject(false);
    setRevealedNumber(null);
    setError(null);
  }

  async function handleReveal() {
    if (!target?.memberId) return;
    try {
      const result = await revealBankAccount.mutateAsync(target.memberId);
      setRevealedNumber(result.bankAccountNumber);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reveal account number");
    }
  }

  async function handleVerify() {
    if (!target?.memberId) return;
    setError(null);
    try {
      await verifyKyc.mutateAsync(target.memberId);
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault();
    if (!target?.memberId) return;
    setError(null);
    try {
      await rejectKyc.mutateAsync({ memberId: target.memberId, note: rejectNote });
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Sheet
      open={target !== null}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{target?.memberName}</SheetTitle>
          <SheetDescription>KYC and payout details</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 px-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Aadhaar</span>
              <span>{target?.aadhaarLast4 ? `XXXX-XXXX-${target.aadhaarLast4}` : "Not on file"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">PAN</span>
              <span>{target?.pan ?? "Not on file"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payout method</span>
              <span>{target?.payoutMethod ?? "Not on file"}</span>
            </div>
            {target?.payoutMethod === "BANK" && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account holder</span>
                  <span>{target.bankAccountName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account number</span>
                  <span className="font-mono">
                    {revealedNumber ?? `...${target.bankAccountNumberLast4 ?? ""}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IFSC</span>
                  <span>{target.bankIfscCode}</span>
                </div>
                {target.bankName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank</span>
                    <span>{target.bankName}</span>
                  </div>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={revealBankAccount.isPending}
                  onClick={handleReveal}
                >
                  {revealedNumber ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  {revealedNumber ? "Hide full number" : "Reveal full account number"}
                </Button>
              </>
            )}
            {target?.payoutMethod === "UPI" && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">UPI ID</span>
                <span>{target.upiId}</span>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {target?.kycStatus === "PENDING" && !showReject && (
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={verifyKyc.isPending}
                onClick={handleVerify}
                className="bg-brand-green hover:bg-brand-green/90"
              >
                {verifyKyc.isPending ? "Verifying…" : "Verify"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setShowReject(true)}
              >
                Reject
              </Button>
            </div>
          )}

          {target?.kycStatus === "PENDING" && showReject && (
            <form onSubmit={handleReject} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="kyc-reject-note">Reason for rejection</Label>
                <textarea
                  id="kyc-reject-note"
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  rows={3}
                  required
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
              <SheetFooter className="px-0">
                <Button type="submit" variant="destructive" disabled={rejectKyc.isPending}>
                  {rejectKyc.isPending ? "Rejecting…" : "Confirm Rejection"}
                </Button>
              </SheetFooter>
            </form>
          )}

          {target?.kycStatus === "REJECTED" && target.kycReviewNote && (
            <p className="text-sm text-destructive">Previously rejected: {target.kycReviewNote}</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
