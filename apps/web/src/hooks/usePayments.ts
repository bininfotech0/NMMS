import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { MemberResponse, PaymentResponse, RecordPaymentInput } from "@nmms/shared";
import { apiFetch } from "@/lib/api-client";
import { errorMessage } from "@/lib/toast-utils";

export function useOutstandingMembers() {
  return useQuery({
    queryKey: ["payments", "outstanding"],
    queryFn: () => apiFetch<MemberResponse[]>("/payments/outstanding"),
  });
}

export function usePayments() {
  return useQuery({
    queryKey: ["payments", "all"],
    queryFn: () => apiFetch<PaymentResponse[]>("/payments"),
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, dto }: { memberId: string; dto: RecordPaymentInput }) =>
      apiFetch<PaymentResponse>(`/members/${memberId}/payments`, {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Payment recorded");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to record payment")),
  });
}
