import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  CreateDonationOrderInput,
  DonationGatewayOrderResponse,
  DonationResponse,
  DonationStatus,
  PaymentLinkResponse,
  RecordDonationInput,
  SubmitDonationInput,
  VerifyDonationGatewayPaymentInput,
} from "@nmms/shared";
import { apiFetch } from "@/lib/api-client";
import { memberApiFetch } from "@/lib/member-api-client";
import { errorMessage } from "@/lib/toast-utils";

// --- Member self-service -----------------------------------------------

export function useMyDonations() {
  return useQuery({
    queryKey: ["donations", "me"],
    queryFn: () => memberApiFetch<DonationResponse[]>("/donations/me"),
  });
}

export function useSubmitDonation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: SubmitDonationInput) =>
      memberApiFetch<DonationResponse>("/donations/me", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["donations", "me"] });
      toast.success("Donation submitted for review");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to submit donation")),
  });
}

// --- Member self-service, online via Razorpay ----------------------------
// Mirrors usePaymentGateway.ts's staff-facing hooks, but member-authed and
// donation-scoped: a gateway-verified donation posts straight to APPROVED
// (see DonationGatewayService), so there's no separate "submitted for
// review" state for this path.

export function useMyDonationGatewayStatus() {
  return useQuery({
    queryKey: ["donations", "me", "gateway", "status"],
    queryFn: () => memberApiFetch<{ enabled: boolean }>("/donations/me/gateway/status"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateMyDonationOrder() {
  return useMutation({
    mutationFn: (dto: CreateDonationOrderInput) =>
      memberApiFetch<DonationGatewayOrderResponse>("/donations/me/gateway/order", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    onError: (err) => toast.error(errorMessage(err, "Failed to start online donation")),
  });
}

export function useVerifyMyDonationGatewayPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: VerifyDonationGatewayPaymentInput) =>
      memberApiFetch<DonationResponse>("/donations/me/gateway/verify", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["donations", "me"] });
      toast.success("Thank you for your donation!");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to verify donation payment")),
  });
}

// --- Staff, nested under a member ---------------------------------------

export function useMemberDonations(memberId: string | null) {
  return useQuery({
    queryKey: ["members", memberId, "donations"],
    queryFn: () => apiFetch<DonationResponse[]>(`/members/${memberId}/donations`),
    enabled: memberId !== null,
  });
}

export function useRecordDonationDirect(memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: RecordDonationInput) =>
      apiFetch<DonationResponse>(`/members/${memberId}/donations`, { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", memberId, "donations"] });
      queryClient.invalidateQueries({ queryKey: ["donations", "admin"] });
      toast.success("Donation recorded");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to record donation")),
  });
}

// --- Staff, online on behalf of a member ---------------------------------
// Mirrors usePaymentGateway.ts, but donation-scoped: amount is staff/donor
// -chosen (not fixed by a plan), so useCreateDonationGatewayOrder takes it as
// input, same as the member self-service variant above.

export function useDonationGatewayStatus() {
  return useQuery({
    queryKey: ["donations", "gateway", "status"],
    queryFn: () => apiFetch<{ enabled: boolean }>("/donations/gateway/status"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateDonationGatewayOrder(memberId: string) {
  return useMutation({
    mutationFn: (dto: CreateDonationOrderInput) =>
      apiFetch<DonationGatewayOrderResponse>(`/members/${memberId}/donations/gateway/order`, {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    onError: (err) => toast.error(errorMessage(err, "Failed to start online donation")),
  });
}

export function useVerifyDonationGatewayPayment(memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: VerifyDonationGatewayPaymentInput) =>
      apiFetch<DonationResponse>(`/members/${memberId}/donations/gateway/verify`, {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", memberId, "donations"] });
      queryClient.invalidateQueries({ queryKey: ["donations", "admin"] });
      toast.success("Donation recorded");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to verify donation payment")),
  });
}

// Hosted Razorpay link, for a donor who'd rather pay on their own device —
// the Donation itself is only created later, by the webhook picking up the
// completed link (see PaymentGatewayService.handleWebhook's purpose routing).
export function useCreateDonationPaymentLink(memberId: string) {
  return useMutation({
    mutationFn: (dto: CreateDonationOrderInput) =>
      apiFetch<PaymentLinkResponse>(`/members/${memberId}/donations/gateway/payment-link`, {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    onError: (err) => toast.error(errorMessage(err, "Failed to create donation link")),
  });
}

// --- Staff, org-wide review ----------------------------------------------

export function useDonationsAdminList(status?: DonationStatus) {
  return useQuery({
    queryKey: ["donations", "admin", status ?? "ALL"],
    queryFn: () => apiFetch<DonationResponse[]>(`/donations${status ? `?status=${status}` : ""}`),
  });
}

export function useApproveDonation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<DonationResponse>(`/donations/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["donations"] });
      toast.success("Donation approved — points awarded");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to approve donation")),
  });
}

export function useRejectDonation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiFetch<DonationResponse>(`/donations/${id}/reject`, { method: "POST", body: JSON.stringify({ note }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["donations"] });
      toast.success("Donation rejected");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to reject donation")),
  });
}
