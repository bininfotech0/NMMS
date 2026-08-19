import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { ApiError } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataGrid, type DataGridColumn } from "@/components/shared/DataGrid";
import { ExportCsvButton } from "@/components/shared/ExportCsvButton";
import {
  useDeleteDocument,
  useDocuments,
  downloadDocumentFile,
  useUploadDocument,
} from "@/hooks/useDocuments";
import { useMembers } from "@/hooks/useMembers";
import type { DocumentType, MemberDocumentResponse } from "@nmms/shared";

const DOCUMENT_TYPES: DocumentType[] = [
  "PHOTO",
  "AADHAAR",
  "AADHAAR_FRONT",
  "AADHAAR_BACK",
  "PAN",
  "VOTER_ID",
  "ADDRESS_PROOF",
  "SIGNATURE",
  "QUALIFICATION_CERTIFICATE",
  "OTHER",
];
const ALLOWED_ACCEPT = "image/jpeg,image/png,application/pdf";

function typeLabel(type: string) {
  return type
    .split("_")
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ALL = "all";

export function Documents() {
  const { data: documents = [], isLoading, isError } = useDocuments();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (typeFilter !== ALL && d.type !== typeFilter) return false;
      if (!q) return true;
      return d.memberName.toLowerCase().includes(q) || d.fileName.toLowerCase().includes(q);
    });
  }, [documents, typeFilter, search]);

  const columns: DataGridColumn<MemberDocumentResponse>[] = useMemo(
    () => [
      { key: "memberName", header: "Member", sortable: true, cellClass: "font-medium" },
      {
        key: "type",
        header: "Type",
        render: (d) => (
          <Badge variant="outline" className="border-transparent bg-muted font-medium">
            {typeLabel(d.type)}
          </Badge>
        ),
      },
      { key: "fileName", header: "File", render: (d) => <span className="text-muted-foreground">{d.fileName}</span> },
      {
        key: "sizeBytes",
        header: "Size",
        sortable: true,
        render: (d) => <span className="text-muted-foreground">{formatSize(d.sizeBytes)}</span>,
      },
      {
        key: "uploadedByEmail",
        header: "Uploaded By",
        render: (d) => <span className="text-muted-foreground">{d.uploadedByEmail}</span>,
      },
      {
        key: "createdAt",
        header: "Date",
        sortable: true,
        render: (d) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {new Date(d.createdAt).toLocaleDateString()}
          </span>
        ),
      },
    ],
    [],
  );

  const exportRows = useMemo(
    () =>
      filtered.map((d) => ({
        memberName: d.memberName,
        type: typeLabel(d.type),
        fileName: d.fileName,
        size: formatSize(d.sizeBytes),
        uploadedByEmail: d.uploadedByEmail,
        date: new Date(d.createdAt).toLocaleDateString(),
      })),
    [filtered],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Identity and supporting documents uploaded for members.
          </p>
        </div>
        <Button className="bg-brand-green hover:bg-brand-green/90" onClick={() => setUploadOpen(true)}>
          <Plus />
          Upload Document
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Search by member or file name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value={ALL}>All types</option>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
              </option>
            ))}
          </select>
        </div>
        <ExportCsvButton filename="documents.csv" rows={exportRows} />
      </div>

      <DataGrid
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        isError={isError}
        errorMessage="Failed to load documents."
        emptyMessage={documents.length === 0 ? "No documents uploaded yet." : "No documents match your filters."}
        rowKey={(d) => d.id}
        searchable={false}
        pageSize={25}
        quickActions={(d) => <DocumentActions doc={d} />}
      />

      <UploadDocumentSheet open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}

function DocumentActions({ doc }: { doc: MemberDocumentResponse }) {
  const deleteDocument = useDeleteDocument();
  const [downloading, setDownloading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadDocumentFile(doc.id, doc.fileName);
    } catch {
      toast.error("Failed to download document");
    } finally {
      setDownloading(false);
    }
  }

  function handleDelete() {
    deleteDocument.mutate(doc.id, { onSuccess: () => setConfirmOpen(false) });
  }

  return (
    <>
      <div className="flex justify-end gap-2">
        <Button size="icon" variant="ghost" disabled={downloading} onClick={handleDownload}>
          <Download className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this document?"
        description={`"${doc.fileName}" will be permanently deleted for ${doc.memberName}. This cannot be undone.`}
        confirmLabel="Delete"
        isPending={deleteDocument.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}

function UploadDocumentSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: members = [] } = useMembers();
  const uploadDocument = useUploadDocument();

  const [memberId, setMemberId] = useState("");
  const [type, setType] = useState<DocumentType>("PHOTO");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMemberId("");
    setType("PHOTO");
    setFile(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!memberId || !file) return;
    setError(null);
    try {
      await uploadDocument.mutateAsync({ memberId, type, file });
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
          <SheetTitle>Upload Document</SheetTitle>
          <SheetDescription>Attach an identity or supporting document to a member.</SheetDescription>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 px-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="member">Member</Label>
            <select
              id="member"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              required
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="" disabled>
                Select a member
              </option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} ({m.mobile})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-type">Document type</Label>
            <select
              id="doc-type"
              value={type}
              onChange={(e) => setType(e.target.value as DocumentType)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {typeLabel(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="file">File</Label>
            <Input
              id="file"
              type="file"
              accept={ALLOWED_ACCEPT}
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">JPEG, PNG or PDF, up to 2 MB.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="px-0">
            <Button
              type="submit"
              disabled={uploadDocument.isPending || !memberId || !file}
              className="bg-brand-green hover:bg-brand-green/90"
            >
              <Upload className="size-4" />
              {uploadDocument.isPending ? "Uploading…" : "Upload"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
