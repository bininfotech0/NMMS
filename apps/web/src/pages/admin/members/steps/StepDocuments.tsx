import { useRef } from "react";
import { Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAutoFillIdentity, useMemberDocuments, useUploadDocument } from "@/hooks/useDocuments";
import type { DocumentType, IdentityAutoFillResponse } from "@nmms/shared";
import type { StepProps } from "../wizard-types";

const DOCUMENT_SLOTS: { type: DocumentType; label: string }[] = [
  { type: "PHOTO", label: "Passport photo" },
  { type: "SIGNATURE", label: "Signature" },
  { type: "AADHAAR_FRONT", label: "Aadhaar (front)" },
  { type: "AADHAAR_BACK", label: "Aadhaar (back)" },
  { type: "PAN", label: "PAN card" },
  { type: "VOTER_ID", label: "Voter ID card" },
  { type: "PASSPORT", label: "Passport" },
  { type: "DRIVING_LICENCE", label: "Driving licence" },
  { type: "GOVERNMENT_ID", label: "Other government ID" },
  { type: "ADDRESS_PROOF", label: "Address proof" },
  { type: "QUALIFICATION_CERTIFICATE", label: "Qualification certificate" },
  { type: "OTHER", label: "Other document" },
];

function dateToInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function StepDocuments({ form, setForm, memberId }: StepProps) {
  const { data: documents = [] } = useMemberDocuments(memberId);
  const autoFillInputRef = useRef<HTMLInputElement>(null);
  const autoFill = useAutoFillIdentity();

  function applyAutoFillResult(result: IdentityAutoFillResponse) {
    setForm((f) => ({
      ...f,
      fullName: result.fullName ?? f.fullName,
      dob: result.dob ? dateToInput(result.dob) : f.dob,
      gender: result.gender ?? f.gender,
      aadhaarNumber: result.aadhaarNumber ?? f.aadhaarNumber,
      pan: result.pan ?? f.pan,
      voterId: result.voterId ?? f.voterId,
      passportNumber: result.passportNumber ?? f.passportNumber,
      drivingLicenceNumber: result.drivingLicenceNumber ?? f.drivingLicenceNumber,
    }));
    const gotSomething = Object.values(result).some((v) => v !== null);
    if (!gotSomething) {
      toast.info("Nothing could be extracted — please fill in the fields below manually.");
    } else {
      toast.success("Fields updated from the document — please review before continuing.");
    }
  }

  function handleAutoFillFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    autoFill.mutate(
      { memberId, type: "AADHAAR", file },
      { onSuccess: applyAutoFillResult },
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 font-heading text-sm font-semibold">Identity verification</h3>
        <div className="flex gap-2">
          {(["MANUAL", "AUTO_FILL"] as const).map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setForm((f) => ({ ...f, identityEntryMethod: method }))}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                form.identityEntryMethod === method || (method === "MANUAL" && !form.identityEntryMethod)
                  ? "bg-brand-green text-white"
                  : "bg-muted text-muted-foreground hover:bg-accent",
              )}
            >
              {method === "MANUAL" ? "Manual entry" : "Auto-fill from document"}
            </button>
          ))}
        </div>
        {form.identityEntryMethod === "AUTO_FILL" && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-dashed border-border p-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={autoFill.isPending}
              onClick={() => autoFillInputRef.current?.click()}
            >
              <Sparkles className="size-4" />
              {autoFill.isPending ? "Reading document…" : "Scan Aadhaar to auto-fill"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Fills in the fields below when a document is recognized — always review before continuing.
            </p>
            <input
              ref={autoFillInputRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="hidden"
              onChange={handleAutoFillFile}
            />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="aadhaarNumber">Aadhaar number</Label>
          <Input
            id="aadhaarNumber"
            placeholder="12-digit number"
            maxLength={12}
            value={form.aadhaarNumber}
            onChange={(e) => setForm((f) => ({ ...f, aadhaarNumber: e.target.value.replace(/\D/g, "") }))}
          />
          <p className="text-xs text-muted-foreground">
            Only stored as a hash for duplicate checks — leave blank to keep the existing one.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pan">PAN</Label>
          <Input id="pan" value={form.pan} onChange={(e) => setForm((f) => ({ ...f, pan: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="voterId">Voter ID</Label>
          <Input
            id="voterId"
            value={form.voterId}
            onChange={(e) => setForm((f) => ({ ...f, voterId: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="passportNumber">Passport number</Label>
          <Input
            id="passportNumber"
            value={form.passportNumber}
            onChange={(e) => setForm((f) => ({ ...f, passportNumber: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="drivingLicenceNumber">Driving licence number</Label>
          <Input
            id="drivingLicenceNumber"
            value={form.drivingLicenceNumber}
            onChange={(e) => setForm((f) => ({ ...f, drivingLicenceNumber: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-heading text-sm font-semibold">Documents</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {DOCUMENT_SLOTS.map((slot) => (
            <DocumentSlot
              key={slot.type}
              memberId={memberId}
              type={slot.type}
              label={slot.label}
              fileName={documents.find((d) => d.type === slot.type)?.fileName ?? null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DocumentSlot({
  memberId,
  type,
  label,
  fileName,
}: {
  memberId: string;
  type: DocumentType;
  label: string;
  fileName: string | null;
}) {
  const uploadDocument = useUploadDocument();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadDocument.mutate({ memberId, type, file });
    e.target.value = "";
  }

  return (
    <div
      data-testid={`document-slot-${type}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{fileName ?? "Not uploaded"}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={uploadDocument.isPending}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" />
        {fileName ? "Replace" : "Upload"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
