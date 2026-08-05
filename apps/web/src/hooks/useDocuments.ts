import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { DocumentType, IdentityAutoFillResponse, MemberDocumentResponse } from "@nmms/shared";
import { apiFetch, ApiError } from "@/lib/api-client";
import { errorMessage } from "@/lib/toast-utils";
import { useAuthStore } from "@/stores/auth";

export function useDocuments() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: () => apiFetch<MemberDocumentResponse[]>("/documents"),
  });
}

// Member-scoped list — for embedding in the member wizard, unlike useDocuments()
// above which is the org-wide list for the standalone Documents admin page.
export function useMemberDocuments(memberId: string | null) {
  return useQuery({
    queryKey: ["members", memberId, "documents"],
    queryFn: () => apiFetch<MemberDocumentResponse[]>(`/members/${memberId}/documents`),
    enabled: memberId !== null,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, type, file }: { memberId: string; type: DocumentType; file: File }) => {
      const formData = new FormData();
      formData.append("type", type);
      formData.append("file", file);
      return apiFetch<MemberDocumentResponse>(`/members/${memberId}/documents`, {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["members", data.memberId, "documents"] });
      toast.success("Document uploaded");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to upload document")),
  });
}

// No OCR vendor is wired in yet (see apps/api/src/ocr) — this always resolves
// to all-null fields unless the AI_OCR feature flag is enabled AND a real
// provider is plugged in. The caller merges whatever comes back into the
// wizard form for the user to review, never auto-saves it.
export function useAutoFillIdentity() {
  return useMutation({
    mutationFn: ({ memberId, type, file }: { memberId: string; type: DocumentType; file: File }) => {
      const formData = new FormData();
      formData.append("type", type);
      formData.append("file", file);
      return apiFetch<IdentityAutoFillResponse>(`/members/${memberId}/identity/auto-fill`, {
        method: "POST",
        body: formData,
      });
    },
    onError: (err) => toast.error(errorMessage(err, "Auto-fill failed")),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document deleted");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to delete document")),
  });
}

// The download endpoint requires a Bearer token, which a plain <a href> can't
// attach — fetch it as a blob (with auth) and trigger the save client-side.
export async function downloadDocumentFile(id: string, fileName: string): Promise<void> {
  const { accessToken } = useAuthStore.getState();
  const res = await fetch(`/api/v1/documents/${id}/file`, {
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

// Same auth problem as above, but for inline <img> display instead of a
// download — keeps the object URL alive in state and revokes it on
// unmount/id-change rather than immediately after a single click.
export function useDocumentImageUrl(documentId: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;

    (async () => {
      const { accessToken } = useAuthStore.getState();
      const res = await fetch(`/api/v1/documents/${documentId}/file`, {
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
