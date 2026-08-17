import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { MemberResponse, MemberSelfUpdateInput } from "@nmms/shared";
import { memberApiFetch } from "@/lib/member-api-client";
import { errorMessage } from "@/lib/toast-utils";

export function useMyProfile() {
  return useQuery({
    queryKey: ["members", "me"],
    queryFn: () => memberApiFetch<MemberResponse>("/members/me"),
  });
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: MemberSelfUpdateInput) =>
      memberApiFetch<MemberResponse>("/members/me", { method: "PATCH", body: JSON.stringify(dto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", "me"] });
      toast.success("Profile updated");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to update profile")),
  });
}
