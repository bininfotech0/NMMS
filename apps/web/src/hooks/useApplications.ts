import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { MemberResponse } from "@nmms/shared";
import { apiFetch } from "@/lib/api-client";
import { errorMessage } from "@/lib/toast-utils";

export function useApplicationsQueue(enabled = true) {
  return useQuery({
    queryKey: ["applications", "AWAITING_PAYMENT"],
    queryFn: () => apiFetch<MemberResponse[]>("/applications"),
    enabled,
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
