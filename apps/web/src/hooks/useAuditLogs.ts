import { useQuery } from "@tanstack/react-query";
import type { AuditLogFacets, AuditLogPage } from "@nmms/shared";
import { apiFetch } from "@/lib/api-client";

export interface AuditLogsQuery {
  page: number;
  limit: number;
  search?: string;
  action?: string;
  entity?: string;
}

export function useAuditLogs(query: AuditLogsQuery) {
  const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) });
  if (query.search) params.set("search", query.search);
  if (query.action) params.set("action", query.action);
  if (query.entity) params.set("entity", query.entity);

  return useQuery({
    queryKey: ["audit-logs", query],
    queryFn: () => apiFetch<AuditLogPage>(`/audit-logs?${params.toString()}`),
  });
}

export function useAuditLogFacets() {
  return useQuery({
    queryKey: ["audit-logs", "facets"],
    queryFn: () => apiFetch<AuditLogFacets>("/audit-logs/facets"),
  });
}
