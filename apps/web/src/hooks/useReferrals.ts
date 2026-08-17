import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  GenerateReferralCodeResponse,
  ReferralLedgerEntryResponse,
  ReferralLeaderboardEntryResponse,
  ReferralNetworkNode,
  ReferralPointRule,
  ReferralPointRuleResponse,
  ReferralRewardResponse,
  ReferralSummaryResponse,
  ReferrerSearchResult,
  RewardStatus,
} from "@nmms/shared";
import { apiFetch } from "@/lib/api-client";
import { memberApiFetch } from "@/lib/member-api-client";
import { errorMessage } from "@/lib/toast-utils";

// Member-facing — own dashboard, using the member token.
export function useMyReferralSummary() {
  return useQuery({
    queryKey: ["referrals", "me"],
    queryFn: () => memberApiFetch<ReferralSummaryResponse>("/referrals/me"),
  });
}

export function useMyReferralLedger() {
  return useQuery({
    queryKey: ["referrals", "me", "ledger"],
    queryFn: () => memberApiFetch<ReferralLedgerEntryResponse[]>("/referrals/me/ledger"),
  });
}

export function useMyReferralRewards() {
  return useQuery({
    queryKey: ["referrals", "me", "rewards"],
    queryFn: () => memberApiFetch<ReferralRewardResponse[]>("/referrals/me/rewards"),
  });
}

// Staff-facing — org-wide oversight, using the staff token.
export function useReferralNetwork(memberId: string | null) {
  return useQuery({
    queryKey: ["referrals", "network", memberId],
    queryFn: () => apiFetch<ReferralNetworkNode>(`/referrals/network/${memberId}`),
    enabled: memberId !== null,
  });
}

// Staff-triggered generation for a member who has never opened their own
// portal (e.g. registered in person, no self-service login set up yet).
export function useGenerateReferralCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch<GenerateReferralCodeResponse>(`/referrals/${memberId}/generate-code`, { method: "POST" }),
    onSuccess: (_data, memberId) => {
      queryClient.invalidateQueries({ queryKey: ["members", memberId] });
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to generate referral code")),
  });
}

export function useReferralRewards(status?: RewardStatus) {
  return useQuery({
    queryKey: ["referrals", "rewards", status ?? "all"],
    queryFn: () => {
      const query = status ? `?status=${status}` : "";
      return apiFetch<ReferralRewardResponse[]>(`/referrals/rewards${query}`);
    },
  });
}

export function useFulfillReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      apiFetch<ReferralRewardResponse>(`/referrals/rewards/${id}/fulfill`, {
        method: "POST",
        body: JSON.stringify({ note }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referrals", "rewards"] });
      toast.success("Reward marked as fulfilled");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to update reward")),
  });
}

// GET /referrals/leaderboard is ADMIN/SUPER_ADMIN only
// (ReferralsAdminController) — pass enabled: false for other roles so this
// doesn't fire a request that can only ever come back 403.
export function useReferralLeaderboard(enabled = true) {
  return useQuery({
    queryKey: ["referrals", "leaderboard"],
    queryFn: () => apiFetch<ReferralLeaderboardEntryResponse[]>("/referrals/leaderboard"),
    enabled,
  });
}

export function useReferralPointRules() {
  return useQuery({
    queryKey: ["referrals", "point-rules"],
    queryFn: () => apiFetch<ReferralPointRuleResponse[]>("/referrals/point-rules"),
  });
}

export function useUpsertReferralPointRuleMatrix() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rules: ReferralPointRule[]) =>
      apiFetch<ReferralPointRuleResponse[]>("/referrals/point-rules", {
        method: "PUT",
        body: JSON.stringify({ rules }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referrals", "point-rules"] });
      toast.success("Referral point matrix saved");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to save referral point matrix")),
  });
}

export function useSearchReferrer(q: string) {
  return useQuery({
    queryKey: ["members", "search-referrer", q],
    queryFn: () => apiFetch<ReferrerSearchResult[]>(`/members/search-referrer?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
  });
}
