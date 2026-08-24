import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  FeatureFlagKey,
  FeatureFlagResponse,
  PaymentGatewayCredentialsStatus,
  RazorpayCredentialsInput,
  RazorpayMode,
  UpdateFeatureFlagInput,
} from "@nmms/shared";
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

// --- Payment Gateway: test/live credential pair -------------------------

export function usePaymentGatewayCredentialsStatus() {
  return useQuery({
    queryKey: ["integrations", "payment-gateway", "credentials-status"],
    queryFn: () => apiFetch<PaymentGatewayCredentialsStatus>("/integrations/payment-gateway/credentials-status"),
  });
}

export function useUpdatePaymentGatewayCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mode, credentials }: { mode: RazorpayMode; credentials: RazorpayCredentialsInput }) =>
      apiFetch<PaymentGatewayCredentialsStatus>("/integrations/payment-gateway/credentials", {
        method: "PATCH",
        body: JSON.stringify({ mode, credentials }),
      }),
    onSuccess: (_, { mode }) => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "payment-gateway", "credentials-status"] });
      toast.success(`${mode === "live" ? "Live" : "Test"} credentials saved`);
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to save credentials")),
  });
}

export function useSetPaymentGatewayMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mode: RazorpayMode) =>
      apiFetch<PaymentGatewayCredentialsStatus>("/integrations/payment-gateway/mode", {
        method: "PATCH",
        body: JSON.stringify({ mode }),
      }),
    onSuccess: (_, mode) => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "payment-gateway", "credentials-status"] });
      toast.success(`Switched to ${mode === "live" ? "Live" : "Test"} mode`);
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to switch mode")),
  });
}
