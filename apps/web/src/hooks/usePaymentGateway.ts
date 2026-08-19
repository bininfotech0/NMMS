import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  GatewayOrderResponse,
  GatewayStatusResponse,
  PaymentLinkResponse,
  PaymentResponse,
  VerifyGatewayPaymentInput,
} from "@nmms/shared";
import { apiFetch } from "@/lib/api-client";
import { errorMessage } from "@/lib/toast-utils";

export function useGatewayStatus() {
  return useQuery({
    queryKey: ["payments", "gateway", "status"],
    queryFn: () => apiFetch<GatewayStatusResponse>("/payments/gateway/status"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateGatewayOrder() {
  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch<GatewayOrderResponse>(`/members/${memberId}/payments/gateway/order`, { method: "POST" }),
    onError: (err) => toast.error(errorMessage(err, "Failed to start online payment")),
  });
}

export function useCreatePaymentLink() {
  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch<PaymentLinkResponse>(`/members/${memberId}/payments/gateway/payment-link`, { method: "POST" }),
    onError: (err) => toast.error(errorMessage(err, "Failed to create payment link")),
  });
}

export function useVerifyGatewayPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, dto }: { memberId: string; dto: VerifyGatewayPaymentInput }) =>
      apiFetch<PaymentResponse>(`/members/${memberId}/payments/gateway/verify`, {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Payment received");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to verify payment")),
  });
}
