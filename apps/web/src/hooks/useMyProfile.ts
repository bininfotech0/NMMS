import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { MemberResponse, MemberSelfUpdateInput, PlanResponse } from "@nmms/shared";
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

// --- Self-service registration completion --------------------------------
// A self-registered member starts DRAFT with no plan at all (unlike the
// staff wizard) — these let them finish on their own: pick a plan, pay, then
// submit for staff review. See MembersService.selectMyPlan/submitMine.

export function useMyAvailablePlans() {
  return useQuery({
    queryKey: ["plans", "me"],
    queryFn: () => memberApiFetch<PlanResponse[]>("/members/me/plans"),
  });
}

export function useSelectMyPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) =>
      memberApiFetch<MemberResponse>("/members/me/plan", { method: "POST", body: JSON.stringify({ planId }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", "me"] });
      toast.success("Plan selected");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to select plan")),
  });
}

export function useSubmitMyRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => memberApiFetch<MemberResponse>("/members/me/submit", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", "me"] });
      toast.success("Registration submitted for review");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to submit registration")),
  });
}
