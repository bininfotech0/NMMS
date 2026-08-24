import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { DocumentType, MemberDocumentResponse } from "@nmms/shared";
import { memberApiFetch } from "@/lib/member-api-client";
import { ApiError } from "@/lib/api-client";
import { errorMessage } from "@/lib/toast-utils";
import { useMemberAuthStore } from "@/stores/member-auth";

export function useMyDocuments() {
  return useQuery({
    queryKey: ["members", "me", "documents"],
    queryFn: () => memberApiFetch<MemberDocumentResponse[]>("/members/me/documents"),
  });
}

// A self-registered member uploading their own photo/ID proof — needed to
// clear MembersService.submitInternal's document gate. Same FormData shape
// as useUploadDocument (useDocuments.ts) for staff.
export function useUploadMyDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ type, file }: { type: DocumentType; file: File }) => {
      const formData = new FormData();
      formData.append("type", type);
      formData.append("file", file);
      return memberApiFetch<MemberDocumentResponse>("/members/me/documents", { method: "POST", body: formData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", "me", "documents"] });
      toast.success("Document uploaded");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to upload document")),
  });
}

// Same auth problem useDocumentImageUrl solves for staff (apps/web/src/hooks/useDocuments.ts)
// — the file endpoint needs a Bearer token a plain <img src> can't attach —
// but reading the member token/client instead.
export function useMyDocumentImageUrl(documentId: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;

    (async () => {
      const { accessToken } = useMemberAuthStore.getState();
      const res = await fetch(`/api/v1/members/me/documents/${documentId}/file`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        credentials: "include",
      });
      if (!res.ok || cancelled) return;
      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      if (!cancelled) setUrl(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId]);

  return url;
}

export function useMyPhotoUrl(): string | null {
  const { data: documents } = useMyDocuments();
  const photoDocId = documents?.find((d) => d.type === "PHOTO")?.id ?? null;
  return useMyDocumentImageUrl(photoDocId);
}

export async function downloadMyDocumentFile(id: string, fileName: string): Promise<void> {
  const { accessToken } = useMemberAuthStore.getState();
  const res = await fetch(`/api/v1/members/me/documents/${id}/file`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    credentials: "include",
  });
  if (!res.ok) {
    throw new ApiError(res.status, "Failed to download document");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
