import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { GatewayOrderResponse, PaymentResponse, VerifyGatewayPaymentInput } from "@nmms/shared";
import { memberApiFetch } from "@/lib/member-api-client";
import { errorMessage } from "@/lib/toast-utils";

export function useMyPayments() {
  return useQuery({
    queryKey: ["members", "me", "payments"],
    queryFn: () => memberApiFetch<PaymentResponse[]>("/members/me/payments"),
  });
}

// --- Membership fee, online via Razorpay ----------------------------------
// Mirrors usePaymentGateway.ts's staff-facing hooks, but member-authed and
// self-scoped: memberId always comes from the JWT, never a param.

export function useMyPaymentGatewayStatus() {
  return useQuery({
    queryKey: ["members", "me", "payments", "gateway", "status"],
    queryFn: () => memberApiFetch<{ enabled: boolean }>("/members/me/payments/gateway/status"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateMyPaymentOrder() {
  return useMutation({
    mutationFn: () => memberApiFetch<GatewayOrderResponse>("/members/me/payments/gateway/order", { method: "POST" }),
    onError: (err) => toast.error(errorMessage(err, "Failed to start online payment")),
  });
}

export function useVerifyMyPaymentGateway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: VerifyGatewayPaymentInput) =>
      memberApiFetch<PaymentResponse>("/members/me/payments/gateway/verify", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", "me"] });
      queryClient.invalidateQueries({ queryKey: ["members", "me", "payments"] });
      toast.success("Payment received");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to verify payment")),
  });
}
