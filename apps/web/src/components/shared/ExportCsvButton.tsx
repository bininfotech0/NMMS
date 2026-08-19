import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv";

export function ExportCsvButton({
  filename,
  rows,
  className,
}: {
  filename: string;
  rows: Record<string, unknown>[];
  className?: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={rows.length === 0}
      onClick={() => downloadCsv(filename, rows)}
      className={className}
    >
      <Download className="size-4" />
      Export CSV
    </Button>
  );
}
