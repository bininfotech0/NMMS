import { useState, useMemo } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import { TableSkeleton } from "./TableSkeleton";

export interface DataGridColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (item: T) => React.ReactNode;
  renderHeader?: () => React.ReactNode;
  width?: string;
  hidden?: boolean;
  align?: "left" | "center" | "right";
  cellClass?: string;
}

interface DataGridProps<T> {
  columns: DataGridColumn<T>[];
  data: T[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  rowKey: (item: T) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: string[];
  exportable?: boolean;
  onExport?: (type: "pdf" | "excel" | "csv") => void;
  pageSize?: number;
  serverPagination?: boolean;
  total?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  statusKey?: string;
  compact?: boolean;
  stickyHeader?: boolean;
  quickActions?: (item: T) => React.ReactNode;
}

export function DataGrid<T extends Record<string, unknown>>({
  columns,
  data,
  isLoading,
  isError,
  errorMessage = "Failed to load data.",
  emptyMessage = "No data found.",
  onRowClick,
  rowKey,
  searchable = true,
  searchPlaceholder = "Search...",
  searchKeys,
  exportable = true,
  onExport,
  pageSize = 20,
  serverPagination = false,
  total,
  page: externalPage,
  onPageChange,
  statusKey,
  compact = false,
  stickyHeader = false,
  quickActions,
}: DataGridProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [internalPage, setInternalPage] = useState(1);

  const page = externalPage ?? internalPage;
  const setPage = onPageChange ?? setInternalPage;

  const visibleColumns = useMemo(() => columns.filter((c) => !c.hidden), [columns]);

  const filtered = useMemo(() => {
    let result = [...data];

    if (search && searchKeys) {
      const q = search.toLowerCase();
      result = result.filter((item) =>
        searchKeys.some((key) => String(item[key] ?? "").toLowerCase().includes(q)),
      );
    }

    if (sortKey) {
      result.sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        const cmp = String(aVal).localeCompare(String(bVal));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [data, search, searchKeys, sortKey, sortDir]);

  const totalPages = useMemo(() => {
    if (serverPagination && total != null) return Math.ceil(total / pageSize);
    return Math.ceil(filtered.length / pageSize);
  }, [filtered.length, total, pageSize, serverPagination]);

  const paginated = useMemo(() => {
    if (serverPagination) return filtered;
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize, serverPagination]);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortIcon({ column }: { column: DataGridColumn<T> }) {
    if (!column.sortable) return null;
    if (sortKey !== column.key) return <ChevronsUpDown className="ml-1 size-3 opacity-50" />;
    return sortDir === "asc" ? (
      <ChevronUp className="ml-1 size-3" />
    ) : (
      <ChevronDown className="ml-1 size-3" />
    );
  }

  const renderSearch = () => {
    if (!searchable || !searchKeys || searchKeys.length === 0) return null;
    return (
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          className="pl-9 h-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearch("")}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    );
  };

  const renderExport = () => {
    if (!exportable || !onExport) return null;
    return (
      <div className="flex gap-1">
        <Button variant="outline" size="sm" onClick={() => onExport("excel")}>
          <Download className="size-4 mr-1" />
          Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => onExport("pdf")}>
          <Download className="size-4 mr-1" />
          PDF
        </Button>
      </div>
    );
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between px-2 py-3">
        <p className="text-sm text-muted-foreground">
          Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, serverPagination ? (total ?? filtered.length) : filtered.length)} of{" "}
          {serverPagination ? total : filtered.length}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (page <= 3) {
              pageNum = i + 1;
            } else if (page >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = page - 2 + i;
            }
            return (
              <Button
                key={pageNum}
                variant={page === pageNum ? "default" : "outline"}
                size="sm"
                className="min-w-[36px]"
                onClick={() => setPage(pageNum)}
              >
                {pageNum}
              </Button>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        {renderSearch()}
        <div className="flex items-center gap-2">
          {renderExport()}
          {searchable && searchKeys && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Filter className="size-4" />
              <span className="hidden sm:inline">
                {data.length} records
                {search && ` (${filtered.length} filtered)`}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className={cn("overflow-x-auto rounded-xl border border-border bg-card", compact && "rounded-lg")}>
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    col.sortable && "cursor-pointer select-none hover:text-foreground",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.width && `w-[${col.width}]`,
                    stickyHeader && "sticky top-0 bg-card",
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.renderHeader ? col.renderHeader() : col.header}
                    <SortIcon column={col} />
                  </div>
                </TableHead>
              ))}
              {quickActions && <TableHead className="text-right w-[100px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableSkeleton columns={visibleColumns.length + (quickActions ? 1 : 0)} />}
            {isError && (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length + (quickActions ? 1 : 0)}
                  className="py-10 text-center text-destructive"
                >
                  {errorMessage}
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !isError && paginated.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length + (quickActions ? 1 : 0)}
                  className="py-10 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              !isError &&
              paginated.map((item) => (
                <TableRow
                  key={rowKey(item)}
                  className={cn(onRowClick && "cursor-pointer hover:bg-accent/50")}
                  onClick={() => onRowClick?.(item)}
                >
                  {visibleColumns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        col.cellClass,
                      )}
                    >
                      {statusKey === col.key
                        ? <StatusBadge status={String(item[col.key])} />
                        : col.render
                          ? col.render(item)
                          : String(item[col.key] ?? "—")}
                    </TableCell>
                  ))}
                  {quickActions && (
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {quickActions(item) as React.ReactNode}
                    </TableCell>
                  )}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {renderPagination()}
    </div>
  );
}
