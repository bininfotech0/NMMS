import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useAuditLogs } from "@/hooks/useAuditLogs";
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

export function AuditLogs() {
  const { data: logs = [], isLoading, isError, error } = useAuditLogs();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState(ALL);
  const [entityFilter, setEntityFilter] = useState(ALL);

  const forbidden = isError && error instanceof ApiError && error.status === 403;

  const actions = useMemo(
    () => Array.from(new Set(logs.map((l) => l.action))).sort(),
    [logs],
  );
  const entities = useMemo(
    () => Array.from(new Set(logs.map((l) => l.entity))).sort(),
    [logs],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (actionFilter !== ALL && l.action !== actionFilter) return false;
      if (entityFilter !== ALL && l.entity !== entityFilter) return false;
      if (!q) return true;
      return (
        (l.actorEmail ?? "").toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.entity.toLowerCase().includes(q) ||
        (l.entityId ?? "").toLowerCase().includes(q)
      );
    });
  }, [logs, search, actionFilter, entityFilter]);

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
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <option value={ALL}>All actions</option>
          {actions.map((a) => (
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
          {entities.map((e) => (
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
            {!isLoading && !isError && filtered.map((log) => <AuditLogRow key={log.id} log={log} />)}
            {!isLoading && !isError && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <ShieldCheck className="size-8 text-muted-foreground/50" />
                    {logs.length === 0 ? "No activity recorded yet." : "No logs match your filters."}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
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
