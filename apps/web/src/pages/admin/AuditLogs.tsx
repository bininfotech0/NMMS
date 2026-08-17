import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import { useAuditLogFacets, useAuditLogs } from "@/hooks/useAuditLogs";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import type { AuditLogResponse } from "@nmms/shared";

const ACTION_STYLES: Record<string, string> = {
  LOGIN_SUCCESS: "bg-emerald-100 text-emerald-700",
  LOGIN_FAILED: "bg-red-100 text-red-700",
  CREATE: "bg-sky-100 text-sky-700",
  UPDATE: "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-700",
  APPROVE: "bg-emerald-100 text-emerald-700",
  VERIFY: "bg-emerald-100 text-emerald-700",
  REJECT: "bg-red-100 text-red-700",
};

function actionStyle(action: string) {
  return ACTION_STYLES[action] ?? "bg-muted text-muted-foreground";
}

const ALL = "all";
const PAGE_SIZE = 50;

// Small local debounce — no need for a shared hook over one input.
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function AuditLogs() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [actionFilter, setActionFilter] = useState(ALL);
  const [entityFilter, setEntityFilter] = useState(ALL);
  const [page, setPage] = useState(1);

  // Any filter change invalidates the current page position.
  useEffect(() => {
    setPage(1);
  }, [search, actionFilter, entityFilter]);

  const { data: facets } = useAuditLogFacets();
  const { data, isLoading, isError, error } = useAuditLogs({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    action: actionFilter === ALL ? undefined : actionFilter,
    entity: entityFilter === ALL ? undefined : entityFilter,
  });

  const logs = data?.data ?? [];
  const meta = data?.meta;
  const forbidden = isError && error instanceof ApiError && error.status === 403;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">
          Login history and a full activity trail of every change made across the system.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by actor, action, entity, or ID..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="sm:max-w-xs"
        />
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <option value={ALL}>All actions</option>
          {(facets?.actions ?? []).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <option value={ALL}>All entities</option>
          {(facets?.entities ?? []).map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Entity ID</TableHead>
              <TableHead>IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableSkeleton columns={6} />}
            {forbidden && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  You don't have permission to view audit logs.
                </TableCell>
              </TableRow>
            )}
            {isError && !forbidden && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-destructive">
                  Failed to load audit logs.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !isError && logs.map((log) => <AuditLogRow key={log.id} log={log} />)}
            {!isLoading && !isError && logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <ShieldCheck className="size-8 text-muted-foreground/50" />
                    {meta && meta.total === 0 && !search && actionFilter === ALL && entityFilter === ALL
                      ? "No activity recorded yet."
                      : "No logs match your filters."}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {meta && meta.total > 0 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            Showing {(meta.page - 1) * meta.limit + 1} to {Math.min(meta.page * meta.limit, meta.total)} of{" "}
            {meta.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {meta.page} of {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditLogRow({ log }: { log: AuditLogResponse }) {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground whitespace-nowrap">
        {new Date(log.createdAt).toLocaleString()}
      </TableCell>
      <TableCell className="font-medium">{log.actorEmail ?? "—"}</TableCell>
      <TableCell>
        <Badge className={cn("border-transparent font-medium", actionStyle(log.action))}>
          {log.action}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">{log.entity}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{log.entityId ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">{log.ipAddress ?? "—"}</TableCell>
    </TableRow>
  );
}
