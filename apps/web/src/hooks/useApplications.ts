import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { MemberResponse } from "@nmms/shared";
import { apiFetch } from "@/lib/api-client";
import { errorMessage } from "@/lib/toast-utils";

export function useApplicationsQueue(enabled = true) {
  return useQuery({
    queryKey: ["applications", "SUBMITTED"],
    queryFn: () => apiFetch<MemberResponse[]>("/applications"),
    enabled,
  });
}

export function useApproveApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch<MemberResponse>(`/applications/${memberId}/approve`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Application approved");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to approve application")),
  });
}

export function useRejectApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, remarks }: { memberId: string; remarks: string }) =>
      apiFetch<MemberResponse>(`/applications/${memberId}/reject`, {
        method: "POST",
        body: JSON.stringify({ remarks }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Application rejected");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to reject application")),
  });
}

function useLifecycleAction(action: "suspend" | "reactivate" | "mark-deceased", successMessage: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, remarks }: { memberId: string; remarks: string }) =>
      apiFetch<MemberResponse>(`/applications/${memberId}/${action}`, {
        method: "POST",
        body: JSON.stringify({ remarks }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.setQueryData(["members", data.id], data);
      toast.success(successMessage);
    },
    onError: (err) => toast.error(errorMessage(err, `Failed to ${action.replace("-", " ")} member`)),
  });
}

export function useSuspendMember() {
  return useLifecycleAction("suspend", "Member suspended");
}

export function useReactivateMember() {
  return useLifecycleAction("reactivate", "Member reactivated");
}

export function useMarkMemberDeceased() {
  return useLifecycleAction("mark-deceased", "Member marked deceased");
}
