import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreateLookupInput, LookupCategory, LookupResponse, UpdateLookupInput } from "@nmms/shared";
import { apiFetch } from "@/lib/api-client";
import { errorMessage } from "@/lib/toast-utils";

export function useLookups(category: LookupCategory) {
  return useQuery({
    queryKey: ["lookups", category],
    queryFn: () => apiFetch<LookupResponse[]>(`/masters/lookups?category=${category}`),
  });
}

export function useCreateLookup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateLookupInput) =>
      apiFetch<LookupResponse>("/masters/lookups", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lookups", data.category] });
      toast.success("Value added");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to add value")),
  });
}

export function useUpdateLookup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateLookupInput }) =>
      apiFetch<LookupResponse>(`/masters/lookups/${id}`, { method: "PATCH", body: JSON.stringify(dto) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lookups", data.category] });
      toast.success("Value updated");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to update value")),
  });
}
