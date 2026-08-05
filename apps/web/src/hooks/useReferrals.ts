import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  ReferralLedgerEntryResponse,
  ReferralLeaderboardEntryResponse,
  ReferralNetworkNode,
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

export function useReferralLeaderboard() {
  return useQuery({
    queryKey: ["referrals", "leaderboard"],
    queryFn: () => apiFetch<ReferralLeaderboardEntryResponse[]>("/referrals/leaderboard"),
  });
}

export function useSearchReferrer(q: string) {
  return useQuery({
    queryKey: ["members", "search-referrer", q],
    queryFn: () => apiFetch<ReferrerSearchResult[]>(`/members/search-referrer?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
  });
}
