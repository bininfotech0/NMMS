import { useQuery } from "@tanstack/react-query";
import type {
  FieldExecutivePerformanceRow,
  MemberRegisterRow,
  MonthlyAmount,
  NamedCount,
  PaymentCollectionRow,
  RenewalRow,
  ReportsSummaryResponse,
} from "@nmms/shared";
import { apiFetch } from "@/lib/api-client";

export function useReportsSummary() {
  return useQuery({
    queryKey: ["reports", "summary"],
    queryFn: () => apiFetch<ReportsSummaryResponse>("/reports/summary"),
  });
}

function useReport<T>(path: string) {
  return useQuery({
    queryKey: ["reports", path],
    queryFn: () => apiFetch<T[]>(`/reports/${path}`),
  });
}

export function useMemberRegisterReport() {
  return useReport<MemberRegisterRow>("member-register");
}
export function usePendingApprovalReport() {
  return useReport<MemberRegisterRow>("pending-approval");
}
export function useRejectedApplicationsReport() {
  return useReport<MemberRegisterRow>("rejected-applications");
}
export function usePaymentCollectionReport() {
  return useReport<PaymentCollectionRow>("payment-collection");
}
export function useRenewalsReport() {
  return useReport<RenewalRow>("renewals");
}
export function useBranchWiseReport() {
  return useReport<NamedCount>("branch-wise");
}
export function useFieldExecutivePerformanceReport() {
  return useReport<FieldExecutivePerformanceRow>("field-executive-performance");
}
export function useRevenueCollectionReport() {
  return useReport<MonthlyAmount>("revenue-collection");
}
