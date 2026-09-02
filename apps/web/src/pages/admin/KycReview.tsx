import { useMemo, useState } from "react";
import { Eye, EyeOff, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DataGrid, type DataGridColumn } from "@/components/shared/DataGrid";
import { ExportCsvButton } from "@/components/shared/ExportCsvButton";
import { ApiError } from "@/lib/api-client";
import {
  useAdminKycList,
  useRejectKyc,
  useRevealBankAccount,
  useUpdateKycAsAdmin,
  useVerifyKyc,
} from "@/hooks/useKyc";
import type { KycResponse, KycStatus, PayoutMethod } from "@nmms/shared";

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

  const columns: DataGridColumn<KycResponse>[] = useMemo(
    () => [
      { key: "memberName", header: "Member", sortable: true, cellClass: "font-medium" },
      {
        key: "payoutMethod",
        header: "Payout Method",
        render: (s) => (
          <span className="text-muted-foreground">
            {s.payoutMethod === "BANK"
              ? `Bank ...${s.bankAccountNumberLast4 ?? ""}`
              : s.payoutMethod === "UPI"
                ? s.upiId
                : "—"}
          </span>
        ),
      },
      {
        key: "aadhaarLast4",
        header: "Aadhaar",
        render: (s) => <span className="text-muted-foreground">{s.aadhaarLast4 ? `XXXX-${s.aadhaarLast4}` : "—"}</span>,
      },
      { key: "pan", header: "PAN", render: (s) => <span className="text-muted-foreground">{s.pan ?? "—"}</span> },
      {
        key: "kycStatus",
        header: "Status",
        sortable: true,
        render: (s) => (
          <Badge className={`border-transparent font-medium ${STATUS_STYLES[s.kycStatus]}`}>
            {s.kycStatus.replace(/_/g, " ")}
          </Badge>
        ),
      },
    ],
    [],
  );

  const exportRows = useMemo(
    () =>
      submissions.map((s) => ({
        memberName: s.memberName ?? "",
        payoutMethod:
          s.payoutMethod === "BANK"
            ? `Bank ...${s.bankAccountNumberLast4 ?? ""}`
            : s.payoutMethod === "UPI"
              ? (s.upiId ?? "")
              : "",
        aadhaar: s.aadhaarLast4 ? `XXXX-${s.aadhaarLast4}` : "",
        pan: s.pan ?? "",
        status: s.kycStatus,
      })),
    [submissions],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold">KYC Review</h1>
          <p className="text-sm text-muted-foreground">Verify member identity and payout details</p>
        </div>
        <ExportCsvButton filename="kyc-review.csv" rows={exportRows} />
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

      <DataGrid
        columns={columns}
        data={submissions}
        isLoading={isLoading}
        isError={isError}
        preserveOrder
        errorMessage="Failed to load KYC submissions."
        emptyMessage="No KYC submissions found."
        rowKey={(s) => s.memberId ?? s.memberName ?? ""}
        searchable
        searchPlaceholder="Search by member name..."
        searchKeys={["memberName"]}
        pageSize={25}
        quickActions={(s) => (
          <Button size="sm" variant="outline" onClick={() => setDetailTarget(s)}>
            Review
          </Button>
        )}
      />

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
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setRejectNote("");
    setShowReject(false);
    setRevealedNumber(null);
    setEditing(false);
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
          {editing && target ? (
            <EditPayoutForm
              target={target}
              onCancel={() => setEditing(false)}
              onSaved={() => setEditing(false)}
            />
          ) : (
            <>
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

              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="size-4" />
                Edit payout details
              </Button>

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
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EditPayoutForm({
  target,
  onCancel,
  onSaved,
}: {
  target: KycResponse;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const updateKyc = useUpdateKycAsAdmin();
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>(target.payoutMethod ?? "BANK");
  const [bankAccountName, setBankAccountName] = useState(target.bankAccountName ?? "");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfscCode, setBankIfscCode] = useState(target.bankIfscCode ?? "");
  const [bankName, setBankName] = useState(target.bankName ?? "");
  const [upiId, setUpiId] = useState(target.upiId ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!target.memberId) return;
    setError(null);
    try {
      await updateKyc.mutateAsync({
        memberId: target.memberId,
        dto:
          payoutMethod === "BANK"
            ? { payoutMethod, bankAccountName, bankAccountNumber, bankIfscCode, bankName: bankName || undefined }
            : { payoutMethod, upiId },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Entering payout details on the member's behalf sends this back to PENDING for review, even if it was
        previously verified.
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(payoutMethod === "BANK" && "border-brand-green text-brand-green")}
          onClick={() => setPayoutMethod("BANK")}
        >
          Bank Account
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(payoutMethod === "UPI" && "border-brand-green text-brand-green")}
          onClick={() => setPayoutMethod("UPI")}
        >
          UPI
        </Button>
      </div>

      {payoutMethod === "BANK" ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="admin-kyc-bankAccountName">Account holder name</Label>
            <Input
              id="admin-kyc-bankAccountName"
              value={bankAccountName}
              onChange={(e) => setBankAccountName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-kyc-bankAccountNumber">
              Account number {target.bankAccountNumberLast4 && `(currently on file: ...${target.bankAccountNumberLast4})`}
            </Label>
            <Input
              id="admin-kyc-bankAccountNumber"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              placeholder="Enter the account number"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-kyc-bankIfscCode">IFSC code</Label>
            <Input
              id="admin-kyc-bankIfscCode"
              value={bankIfscCode}
              onChange={(e) => setBankIfscCode(e.target.value.toUpperCase())}
              pattern="[A-Z]{4}0[A-Z0-9]{6}"
              placeholder="SBIN0001234"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-kyc-bankName">Bank name (optional)</Label>
            <Input id="admin-kyc-bankName" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="admin-kyc-upiId">UPI ID</Label>
          <Input
            id="admin-kyc-upiId"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            pattern="[\w.-]{2,256}@[a-zA-Z]{2,64}"
            placeholder="name@bank"
            required
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={updateKyc.isPending} className="bg-brand-green hover:bg-brand-green/90">
          {updateKyc.isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
