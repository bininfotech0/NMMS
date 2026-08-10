import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { KycResponse, KycStatus, RevealBankAccountResponse, SubmitKycInput } from "@nmms/shared";
import { apiFetch } from "@/lib/api-client";
import { memberApiFetch } from "@/lib/member-api-client";
import { errorMessage } from "@/lib/toast-utils";

// Member-facing — own KYC status + payout details, using the member token.
export function useMyKyc() {
  return useQuery({
    queryKey: ["kyc", "me"],
    queryFn: () => memberApiFetch<KycResponse>("/kyc/me"),
  });
}

export function useSubmitKyc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: SubmitKycInput) =>
      memberApiFetch<KycResponse>("/kyc/me", { method: "PUT", body: JSON.stringify(dto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kyc", "me"] });
      toast.success("KYC details submitted for review");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to submit KYC details")),
  });
}

// Staff-facing — org-wide KYC review queue, using the staff token.
export function useAdminKycList(status?: KycStatus) {
  return useQuery({
    queryKey: ["kyc", "admin", status ?? "all"],
    queryFn: () => {
      const query = status ? `?status=${status}` : "";
      return apiFetch<KycResponse[]>(`/kyc${query}`);
    },
  });
}

export function useAdminKyc(memberId: string | null) {
  return useQuery({
    queryKey: ["kyc", "admin", "member", memberId],
    queryFn: () => apiFetch<KycResponse>(`/kyc/${memberId}`),
    enabled: memberId !== null,
  });
}

export function useVerifyKyc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => apiFetch<KycResponse>(`/kyc/${memberId}/verify`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kyc"] });
      toast.success("KYC verified");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to verify KYC")),
  });
}

export function useRejectKyc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, note }: { memberId: string; note: string }) =>
      apiFetch<KycResponse>(`/kyc/${memberId}/reject`, { method: "POST", body: JSON.stringify({ note }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kyc"] });
      toast.success("KYC rejected");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to reject KYC")),
  });
}

// Mutation only — the plaintext account number must live only in local
// component state for the viewing session, never persisted to the query
// cache, so this deliberately isn't a useQuery.
export function useRevealBankAccount() {
  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch<RevealBankAccountResponse>(`/kyc/${memberId}/reveal-bank-account`, { method: "POST" }),
    onError: (err) => toast.error(errorMessage(err, "Failed to reveal bank account number")),
  });
}
