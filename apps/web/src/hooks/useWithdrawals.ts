import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  CreateWithdrawalRequestInput,
  WalletSummaryResponse,
  WithdrawalRateResponse,
  WithdrawalRequestResponse,
  WithdrawalStatus,
} from "@nmms/shared";
import { apiFetch } from "@/lib/api-client";
import { memberApiFetch } from "@/lib/member-api-client";
import { errorMessage } from "@/lib/toast-utils";

// Member-facing — own wallet summary + withdrawal requests, using the member token.
export function useMyWalletSummary() {
  return useQuery({
    queryKey: ["withdrawals", "me", "summary"],
    queryFn: () => memberApiFetch<WalletSummaryResponse>("/withdrawals/me/summary"),
  });
}

export function useMyWithdrawals() {
  return useQuery({
    queryKey: ["withdrawals", "me"],
    queryFn: () => memberApiFetch<WithdrawalRequestResponse[]>("/withdrawals/me"),
  });
}

// The conversion-rate fields only, for the request sheet's live preview —
// GET /org has the full settings object but is staff-only.
export function useMyWithdrawalRate() {
  return useQuery({
    queryKey: ["withdrawals", "me", "rate"],
    queryFn: () => memberApiFetch<WithdrawalRateResponse>("/withdrawals/me/rate"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateWithdrawalRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateWithdrawalRequestInput) =>
      memberApiFetch<WithdrawalRequestResponse>("/withdrawals/me", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["withdrawals", "me"] });
      toast.success("Withdrawal request submitted");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to submit withdrawal request")),
  });
}

// Staff-facing — org-wide withdrawal queue, using the staff token.
export function useAdminWithdrawals(status?: WithdrawalStatus) {
  return useQuery({
    queryKey: ["withdrawals", "admin", status ?? "all"],
    queryFn: () => {
      const query = status ? `?status=${status}` : "";
      return apiFetch<WithdrawalRequestResponse[]>(`/withdrawals${query}`);
    },
  });
}

export function useAdminWithdrawal(id: string | null) {
  return useQuery({
    queryKey: ["withdrawals", "admin", id],
    queryFn: () => apiFetch<WithdrawalRequestResponse>(`/withdrawals/${id}`),
    enabled: id !== null,
  });
}

export function useApproveWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<WithdrawalRequestResponse>(`/withdrawals/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["withdrawals", "admin"] });
      toast.success("Withdrawal approved");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to approve withdrawal")),
  });
}

export function useRejectWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiFetch<WithdrawalRequestResponse>(`/withdrawals/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ note }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["withdrawals", "admin"] });
      toast.success("Withdrawal rejected");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to reject withdrawal")),
  });
}

export function useMarkWithdrawalPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paymentReference }: { id: string; paymentReference?: string }) =>
      apiFetch<WithdrawalRequestResponse>(`/withdrawals/${id}/mark-paid`, {
        method: "POST",
        body: JSON.stringify({ paymentReference }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["withdrawals", "admin"] });
      toast.success("Withdrawal marked as paid");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to mark withdrawal as paid")),
  });
}

// Whether the org has RazorpayX payout credentials configured — gates
// whether the "Send Payout" button shows at all, same pattern as
// usePayments' gateway/status check on the collection side.
export function usePayoutGatewayStatus() {
  return useQuery({
    queryKey: ["withdrawals", "gateway", "status"],
    queryFn: () => apiFetch<{ enabled: boolean }>("/withdrawals/gateway/status"),
  });
}

export function useInitiatePayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<WithdrawalRequestResponse>(`/withdrawals/${id}/initiate-payout`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["withdrawals", "admin"] });
      toast.success("Payout initiated");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to initiate payout")),
  });
}

export function useCheckPayoutStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<WithdrawalRequestResponse>(`/withdrawals/${id}/check-payout-status`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["withdrawals", "admin"] });
      toast.success("Payout status refreshed");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to check payout status")),
  });
}
