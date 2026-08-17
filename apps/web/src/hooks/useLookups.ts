import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreateLookupInput, LookupCategory, LookupResponse, UpdateLookupInput } from "@nmms/shared";
import { apiFetch } from "@/lib/api-client";
import { memberApiFetch } from "@/lib/member-api-client";
import { errorMessage } from "@/lib/toast-utils";

export function useLookups(category: LookupCategory) {
  return useQuery({
    queryKey: ["lookups", category],
    queryFn: () => apiFetch<LookupResponse[]>(`/masters/lookups?category=${category}`),
  });
}

// Member-facing equivalent — LookupsController is staff-only, so the member
// portal's self-service profile page reads through LookupsMemberController
// (/masters/lookups/me) with the member token instead.
export function useMyLookups(category: LookupCategory) {
  return useQuery({
    queryKey: ["lookups", "me", category],
    queryFn: () => memberApiFetch<LookupResponse[]>(`/masters/lookups/me?category=${category}`),
  });
}

// Fetches every category in a single request (category omitted) — use this
// instead of several useMyLookups() calls when a page needs multiple
// categories, e.g. the self-service profile page's six lookup dropdowns.
export function useMyAllLookups() {
  return useQuery({
    queryKey: ["lookups", "me", "all"],
    queryFn: () => memberApiFetch<LookupResponse[]>("/masters/lookups/me"),
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
