import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  CardTokenResponse,
  CreateMemberInput,
  DedupeCheckInput,
  DedupeMatch,
  MemberResponse,
  PaymentResponse,
  PromoteToExecutiveInput,
  UpdateMemberInput,
  UpgradeMemberPlanInput,
  UserResponse,
} from "@nmms/shared";
import { apiFetch } from "@/lib/api-client";
import { errorMessage } from "@/lib/toast-utils";

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: () => apiFetch<MemberResponse[]>("/members"),
  });
}

export function useMember(id: string | null) {
  return useQuery({
    queryKey: ["members", id],
    queryFn: () => apiFetch<MemberResponse>(`/members/${id}`),
    enabled: id !== null,
  });
}

export function useCreateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateMemberInput) =>
      apiFetch<MemberResponse>("/members", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Member added");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to add member")),
  });
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateMemberInput }) =>
      apiFetch<MemberResponse>(`/members/${id}`, { method: "PATCH", body: JSON.stringify(dto) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.setQueryData(["members", data.id], data);
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to save")),
  });
}

export function useUpgradeMemberPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpgradeMemberPlanInput }) =>
      apiFetch<MemberResponse>(`/members/${id}/payments/upgrade-plan`, {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.setQueryData(["members", data.id], data);
      queryClient.invalidateQueries({ queryKey: ["members", data.id, "payments"] });
      queryClient.invalidateQueries({ queryKey: ["members", data.id, "status-history"] });
      toast.success("Membership plan upgraded");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to upgrade plan")),
  });
}

export function useDeleteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/members/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Draft deleted");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to delete member")),
  });
}

export function useResetMemberPassword() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      apiFetch<{ success: boolean }>(`/members/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      }),
    onSuccess: () => toast.success("Password reset"),
    onError: (err) => toast.error(errorMessage(err, "Failed to reset password")),
  });
}

export function useSubmitMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<MemberResponse>(`/members/${id}/submit`, { method: "POST" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.setQueryData(["members", data.id], data);
      toast.success("Application submitted");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to submit")),
  });
}

export function useCardToken(memberId: string | null) {
  return useQuery({
    queryKey: ["members", memberId, "card-token"],
    queryFn: () => apiFetch<CardTokenResponse>(`/members/${memberId}/card-token`),
    enabled: memberId !== null,
  });
}

// Imperative check (e.g. on mobile-number blur), not a reactive query — the
// caller decides when to run it and what to do with the matches.
export function useDedupeCheck() {
  return useMutation({
    mutationFn: (params: DedupeCheckInput) => {
      const query = new URLSearchParams();
      if (params.mobile) query.set("mobile", params.mobile);
      if (params.aadhaarNumber) query.set("aadhaarNumber", params.aadhaarNumber);
      if (params.fullName) query.set("fullName", params.fullName);
      return apiFetch<DedupeMatch[]>(`/members/dedupe-check?${query.toString()}`);
    },
  });
}

export function useMemberDocuments(memberId: string | null) {
  return useQuery({
    queryKey: ["members", memberId, "documents"],
    queryFn: () => apiFetch<Array<{ id: string; type: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string }>>(`/members/${memberId}/documents`),
    enabled: memberId !== null,
  });
}

export function useMemberPayments(memberId: string | null) {
  return useQuery({
    queryKey: ["members", memberId, "payments"],
    queryFn: () => apiFetch<PaymentResponse[]>(`/members/${memberId}/payments`),
    enabled: memberId !== null,
  });
}

// Self-registrations (via a referral link) waiting for a Field Executive to
// claim/confirm them in person before payment collection proceeds.
export function useUnclaimedReferrals() {
  return useQuery({
    queryKey: ["members", "unclaimed-referrals"],
    queryFn: () => apiFetch<MemberResponse[]>("/members/unclaimed-referrals"),
  });
}

export function useClaimMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<MemberResponse>(`/members/${id}/claim`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", "unclaimed-referrals"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Claimed — continue their registration from Members");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to claim member")),
  });
}

export function usePromoteToExecutive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: PromoteToExecutiveInput }) =>
      apiFetch<UserResponse>(`/members/${id}/promote-to-executive`, {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["members", variables.id] });
      toast.success("Promoted to Field Executive");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to promote member")),
  });
}

export function useMemberStatusHistory(memberId: string | null) {
  return useQuery({
    queryKey: ["members", memberId, "status-history"],
    queryFn: () => apiFetch<Array<{ id: string; fromStatus: string; toStatus: string; remarks: string | null; createdAt: string; actor: { id: string; fullName: string } | null }>>(`/applications/${memberId}/history`),
    enabled: memberId !== null,
  });
}
