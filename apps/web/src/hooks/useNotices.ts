import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateNoticeDto, UpdateNoticeDto, NoticeResponse } from "@nmms/shared";
import { apiFetch } from "@/lib/api-client";

export function useNotices() {
  return useQuery({
    queryKey: ["notices"],
    queryFn: () => apiFetch<NoticeResponse[]>("/notices"),
  });
}

export function useActiveNotices() {
  return useQuery({
    queryKey: ["notices", "active"],
    queryFn: () => apiFetch<NoticeResponse[]>("/notices/active"),
  });
}

export function useNotice(id: string | null) {
  return useQuery({
    queryKey: ["notices", id],
    queryFn: () => apiFetch<NoticeResponse>(`/notices/${id}`),
    enabled: !!id,
  });
}

export function useCreateNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateNoticeDto) =>
      apiFetch<NoticeResponse>("/notices", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notices"] });
    },
  });
}

export function useUpdateNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateNoticeDto }) =>
      apiFetch<NoticeResponse>(`/notices/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notices"] });
    },
  });
}

export function usePublishNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<NoticeResponse>(`/notices/${id}/publish`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notices"] });
    },
  });
}

export function useDeleteNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/notices/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notices"] });
    },
  });
}
