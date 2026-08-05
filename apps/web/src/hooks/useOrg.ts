import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { OrgProfile, UpdateOrgInput } from "@nmms/shared";
import { apiFetch } from "@/lib/api-client";
import { errorMessage } from "@/lib/toast-utils";

export function useOrgProfile() {
  return useQuery({
    queryKey: ["org"],
    queryFn: () => apiFetch<OrgProfile>("/org"),
  });
}

export function useUpdateOrg() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateOrgInput) =>
      apiFetch<OrgProfile>("/org", { method: "PATCH", body: JSON.stringify(dto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org"] });
      toast.success("Organization settings saved");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to save organization settings")),
  });
}
