import { Download, FileText } from "lucide-react";
import type { MemberDocumentResponse } from "@nmms/shared";
import { Button } from "@/components/ui/button";
import { useMyDocuments, useMyDocumentImageUrl, downloadMyDocumentFile } from "@/hooks/useMyDocuments";
import { titleCase } from "@/lib/utils";

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function DocumentRow({ doc }: { doc: MemberDocumentResponse }) {
  const isImage = doc.mimeType.startsWith("image/");
  const thumbUrl = useMyDocumentImageUrl(isImage ? doc.id : null);

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
        {thumbUrl ? (
          <img src={thumbUrl} alt={doc.fileName} className="size-full object-cover" />
        ) : (
          <FileText className="size-5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{titleCase(doc.type)}</p>
        <p className="truncate text-xs text-muted-foreground">
          {doc.fileName} · {formatDate(doc.createdAt)}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => downloadMyDocumentFile(doc.id, doc.fileName)}
      >
        <Download className="size-4" />
        <span className="hidden sm:inline">Download</span>
      </Button>
    </div>
  );
}

export function MemberDocuments() {
  const { data: documents = [], isLoading } = useMyDocuments();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-heading text-2xl font-bold">Documents</h1>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading documents...</p>
      ) : documents.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No documents have been uploaded for your membership yet.
        </p>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </div>
  );
}
