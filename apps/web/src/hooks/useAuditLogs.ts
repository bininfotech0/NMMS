import { useQuery } from "@tanstack/react-query";
import type { AuditLogResponse } from "@nmms/shared";
import { apiFetch } from "@/lib/api-client";

export function useAuditLogs() {
  return useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => apiFetch<AuditLogResponse[]>("/audit-logs"),
  });
}
