import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { FeatureFlagKey, FeatureFlagResponse, UpdateFeatureFlagInput } from "@nmms/shared";
import { apiFetch } from "@/lib/api-client";
import { errorMessage } from "@/lib/toast-utils";

export function useIntegrations() {
  return useQuery({
    queryKey: ["integrations"],
    queryFn: () => apiFetch<FeatureFlagResponse[]>("/integrations"),
  });
}

export function useUpdateIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, dto }: { key: FeatureFlagKey; dto: UpdateFeatureFlagInput }) =>
      apiFetch<FeatureFlagResponse>(`/integrations/${key}`, {
        method: "PATCH",
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Integration updated");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to update integration")),
  });
}
