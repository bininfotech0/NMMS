import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DataGrid, type DataGridColumn } from "@/components/shared/DataGrid";
import { ExportCsvButton } from "@/components/shared/ExportCsvButton";
import { ApiError } from "@/lib/api-client";
import { useApplicationsQueue } from "@/hooks/useApplications";
import type { MemberResponse } from "@nmms/shared";

export function Applications() {
  const navigate = useNavigate();

  const { data: queue = [], isLoading, isError, error } = useApplicationsQueue();

  const forbidden = isError && error instanceof ApiError && error.status === 403;

  const columns: DataGridColumn<MemberResponse>[] = useMemo(
    () => [
      { key: "fullName", header: "Member", sortable: true, cellClass: "font-medium" },
      { key: "mobile", header: "Mobile", sortable: true },
      { key: "status", header: "Status", sortable: true },
      {
        key: "createdAt",
        header: "Last Updated",
        sortable: true,
        render: (member) => (
          <span className="text-muted-foreground">{new Date(member.createdAt).toLocaleDateString()}</span>
        ),
      },
    ],
    [],
  );

  const exportRows = useMemo(
    () =>
      queue.map((m) => ({
        fullName: m.fullName,
        mobile: m.mobile,
        status: m.status,
        lastUpdated: new Date(m.createdAt).toLocaleDateString(),
      })),
    [queue],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold">Applications</h1>
          <p className="text-sm text-muted-foreground">
            {queue.length} registration{queue.length === 1 ? "" : "s"} awaiting payment
          </p>
        </div>
        <ExportCsvButton filename="applications.csv" rows={exportRows} />
      </div>

      <DataGrid
        columns={columns}
        data={queue}
        isLoading={isLoading}
        isError={isError}
        errorMessage={forbidden ? "You don't have permission to view applications." : "Failed to load applications."}
        emptyMessage="No registrations awaiting payment."
        rowKey={(m) => m.id}
        onRowClick={(member) => navigate(`/admin/members/${member.id}/profile`)}
        searchable
        searchPlaceholder="Search by name or mobile..."
        searchKeys={["fullName", "mobile"]}
        statusKey="status"
        pageSize={25}
      />

    </div>
  );
}

