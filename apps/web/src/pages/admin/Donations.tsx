import { useMemo, useState } from "react";
import { Check, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { DataGrid, type DataGridColumn } from "@/components/shared/DataGrid";
import { ExportCsvButton } from "@/components/shared/ExportCsvButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ApiError } from "@/lib/api-client";
import {
  useApproveDonation,
  useDonationsAdminList,
  useRecordDonationDirect,
  useRejectDonation,
} from "@/hooks/useDonations";
import { useMembers } from "@/hooks/useMembers";
import type { DonationResponse, DonationStatus, ManualDonationMode } from "@nmms/shared";

const TABS: { label: string; value: DonationStatus | undefined }[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "All", value: undefined },
];

const STATUS_STYLES: Record<DonationStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

const MODE_OPTIONS: { value: ManualDonationMode; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "BANK", label: "Bank Transfer" },
  { value: "CHEQUE", label: "Cheque" },
];

export function Donations() {
  const [status, setStatus] = useState<DonationStatus | undefined>("PENDING");
  const { data: donations = [], isLoading, isError } = useDonationsAdminList(status);
  const approve = useApproveDonation();
  const [rejectTarget, setRejectTarget] = useState<DonationResponse | null>(null);
  const [approveTarget, setApproveTarget] = useState<DonationResponse | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);

  const columns: DataGridColumn<DonationResponse>[] = useMemo(
    () => [
      { key: "memberName", header: "Donor", sortable: true, cellClass: "font-medium" },
      {
        key: "amount",
        header: "Amount",
        sortable: true,
        render: (d) => `₹${d.amount}`,
      },
      {
        key: "mode",
        header: "Mode",
        render: (d) => <span className="text-muted-foreground">{d.mode[0] + d.mode.slice(1).toLowerCase()}</span>,
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        render: (d) => (
          <Badge className={`border-transparent font-medium ${STATUS_STYLES[d.status]}`}>
            {d.status[0] + d.status.slice(1).toLowerCase()}
          </Badge>
        ),
      },
      {
        key: "pointsAwarded",
        header: "Points",
        render: (d) => <span className="text-muted-foreground">{d.pointsAwarded ?? "—"}</span>,
      },
      {
        key: "createdAt",
        header: "Submitted",
        sortable: true,
        render: (d) => <span className="text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</span>,
      },
    ],
    [],
  );

  const exportRows = useMemo(
    () =>
      donations.map((d) => ({
        memberName: d.memberName ?? "",
        amount: d.amount,
        mode: d.mode,
        status: d.status,
        pointsAwarded: d.pointsAwarded ?? "",
        receiptNumber: d.receiptNumber ?? "",
        submittedAt: new Date(d.createdAt).toLocaleDateString(),
      })),
    [donations],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold">Donations</h1>
          <p className="text-sm text-muted-foreground">Review member-submitted donations or record one received directly</p>
        </div>
        <div className="flex gap-2">
          <ExportCsvButton filename="donations.csv" rows={exportRows} />
          <Button className="bg-brand-green hover:bg-brand-green/90" onClick={() => setRecordOpen(true)}>
            <HandCoins className="size-4" />
            Record Donation
          </Button>
        </div>
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
        data={donations}
        isLoading={isLoading}
        isError={isError}
        errorMessage="Failed to load donations."
        emptyMessage="No donations found."
        rowKey={(d) => d.id}
        searchable
        searchPlaceholder="Search by donor name..."
        searchKeys={["memberName"]}
        pageSize={25}
        quickActions={(d) =>
          d.status === "PENDING" ? (
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setApproveTarget(d)}>
                <Check className="size-4" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setRejectTarget(d)}
              >
                Reject
              </Button>
            </div>
          ) : null
        }
      />

      <ConfirmDialog
        open={approveTarget !== null}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        title="Approve this donation?"
        description={
          approveTarget
            ? `${approveTarget.memberName} will be credited reward points and a receipt will be issued for ₹${approveTarget.amount}.`
            : ""
        }
        confirmLabel="Approve"
        destructive={false}
        isPending={approve.isPending}
        onConfirm={() => {
          if (!approveTarget) return;
          approve.mutate(approveTarget.id, { onSuccess: () => setApproveTarget(null) });
        }}
      />

      <RejectSheet target={rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)} />
      <RecordDonationSheet open={recordOpen} onOpenChange={setRecordOpen} />
    </div>
  );
}

function RejectSheet({
  target,
  onOpenChange,
}: {
  target: DonationResponse | null;
  onOpenChange: (open: boolean) => void;
}) {
  const rejectDonation = useRejectDonation();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setError(null);
    try {
      await rejectDonation.mutateAsync({ id: target.id, note });
      setNote("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Sheet open={target !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Reject donation</SheetTitle>
          <SheetDescription>
            {target ? `${target.memberName}'s donation of ₹${target.amount} will be rejected.` : ""}
          </SheetDescription>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 px-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="reject-note">Reason</Label>
            <textarea
              id="reject-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              required
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="px-0">
            <Button type="submit" variant="destructive" disabled={rejectDonation.isPending}>
              {rejectDonation.isPending ? "Rejecting…" : "Reject Donation"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function RecordDonationSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: members = [] } = useMembers();
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<ManualDonationMode>("CASH");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [donorAddress, setDonorAddress] = useState("");
  const [donorPan, setDonorPan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recordDirect = useRecordDonationDirect(memberId);

  function reset() {
    setMemberId("");
    setAmount("");
    setMode("CASH");
    setNote("");
    setReference("");
    setDonorAddress("");
    setDonorPan("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await recordDirect.mutateAsync({
        amount: Number(amount),
        mode,
        note: note || undefined,
        reference: reference || undefined,
        donorAddress: donorAddress || undefined,
        donorPan: donorPan || undefined,
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Record a donation</SheetTitle>
          <SheetDescription>For a donation received directly (e.g. cash handed to you in person) — approved immediately.</SheetDescription>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 px-4" onSubmit={handleSubmit}>
          <NativeSelect
            id="donor"
            label="Donor"
            placeholder="Select a member"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            options={members.map((m) => ({ value: m.id, label: `${m.fullName} (${m.mobile})` }))}
            required
          />
          <div className="space-y-1.5">
            <Label htmlFor="record-amount">Amount</Label>
            <Input
              id="record-amount"
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <NativeSelect
            id="record-mode"
            label="Mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as ManualDonationMode)}
            options={MODE_OPTIONS}
          />
          <div className="space-y-1.5">
            <Label htmlFor="record-reference">Reference (optional)</Label>
            <Input id="record-reference" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="record-note">Note (optional)</Label>
            <Input id="record-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="record-donor-address">Donor address (optional)</Label>
            <Input
              id="record-donor-address"
              value={donorAddress}
              onChange={(e) => setDonorAddress(e.target.value)}
              placeholder="For an 80G tax receipt"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="record-donor-pan">Donor PAN (optional)</Label>
            <Input
              id="record-donor-pan"
              value={donorPan}
              onChange={(e) => setDonorPan(e.target.value.toUpperCase())}
              placeholder="For an 80G tax receipt"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="px-0">
            <Button
              type="submit"
              disabled={recordDirect.isPending || !memberId}
              className="bg-brand-green hover:bg-brand-green/90"
            >
              {recordDirect.isPending ? "Recording…" : "Record Donation"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
