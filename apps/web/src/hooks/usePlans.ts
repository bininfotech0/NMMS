import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreatePlanInput, PlanResponse, UpdatePlanInput } from "@nmms/shared";
import { apiFetch } from "@/lib/api-client";
import { errorMessage } from "@/lib/toast-utils";

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: () => apiFetch<PlanResponse[]>("/plans"),
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePlanInput) =>
      apiFetch<PlanResponse>("/plans", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast.success("Plan created");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to create plan")),
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdatePlanInput }) =>
      apiFetch<PlanResponse>(`/plans/${id}`, { method: "PATCH", body: JSON.stringify(dto) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      if (typeof variables.dto.isActive === "boolean") {
        toast.success(variables.dto.isActive ? "Plan activated" : "Plan deactivated");
      } else {
        toast.success("Plan updated");
      }
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to update plan")),
  });
}
