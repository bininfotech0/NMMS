import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Megaphone, Bell, Plus, Eye, Pencil, Trash2, Send, Calendar, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { DataGrid, type DataGridColumn } from "@/components/shared/DataGrid";
import { ExportCsvButton } from "@/components/shared/ExportCsvButton";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import { useNotices, useCreateNotice, useUpdateNotice, usePublishNotice, useDeleteNotice } from "@/hooks/useNotices";
import { Role, type CreateNoticeDto, type NoticeResponse } from "@nmms/shared";

const ROLE_OPTIONS = [
  { value: "", label: "Everyone" },
  ...Object.values(Role).map((r) => ({
    value: r,
    label: r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  })),
];

export function Notices() {
  const { data: notices = [], isLoading, isError } = useNotices();
  const createNotice = useCreateNotice();
  const updateNotice = useUpdateNotice();
  const publishNotice = usePublishNotice();
  const deleteNotice = useDeleteNotice();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<NoticeResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NoticeResponse | null>(null);
  const [viewTarget, setViewTarget] = useState<NoticeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const noticeId = searchParams.get("noticeId");
  useEffect(() => {
    if (!noticeId) return;
    const notice = notices.find((n) => n.id === noticeId);
    if (notice) setViewTarget(notice);
  }, [noticeId, notices]);

  const columns: DataGridColumn<NoticeResponse>[] = useMemo(
    () => [
      {
        key: "title",
        header: "Title",
        sortable: true,
        cellClass: "font-medium max-w-xs",
        render: (notice) => <div className="truncate">{notice.title}</div>,
      },
      {
        key: "audienceRole",
        header: "Audience",
        render: (notice) => (
          <span className="text-muted-foreground">
            {notice.audienceRole ? notice.audienceRole.replace(/_/g, " ") : "All Members"}
          </span>
        ),
      },
      {
        key: "publishedAt",
        header: "Status",
        sortable: true,
        render: (notice) => (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              notice.publishedAt ? "bg-brand-bg-soft text-brand-green-dark" : "bg-muted text-muted-foreground",
            )}
          >
            {notice.publishedAt ? "Published" : "Draft"}
          </span>
        ),
      },
      {
        key: "createdAt",
        header: "Created",
        sortable: true,
        render: (notice) => (
          <span className="text-muted-foreground">{new Date(notice.createdAt).toLocaleDateString()}</span>
        ),
      },
    ],
    [],
  );

  const exportRows = useMemo(
    () =>
      notices.map((notice) => ({
        title: notice.title,
        audience: notice.audienceRole ? notice.audienceRole.replace(/_/g, " ") : "All Members",
        status: notice.publishedAt ? "Published" : "Draft",
        createdAt: new Date(notice.createdAt).toLocaleDateString(),
      })),
    [notices],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold">Notices</h1>
          <p className="text-sm text-muted-foreground">{notices.length} notice{notices.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex gap-2">
          <ExportCsvButton filename="notices.csv" rows={exportRows} />
          <Button className="bg-brand-green hover:bg-brand-green/90" onClick={() => setCreateOpen(true)}>
            <Plus />
            Create Notice
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-brand-green/30 bg-brand-bg-soft">
          <CardContent className="flex items-center gap-3 py-4">
            <Megaphone className="size-8 text-brand-green" />
            <div>
              <p className="text-2xl font-bold text-brand-green-dark">{notices.length}</p>
              <p className="text-sm text-muted-foreground">Total Notices</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Bell className="size-8 text-brand-gold" />
            <div>
              <p className="text-2xl font-bold text-brand-brown">{notices.filter((n) => n.publishedAt).length}</p>
              <p className="text-sm text-muted-foreground">Published</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Calendar className="size-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{notices.filter((n) => !n.publishedAt).length}</p>
              <p className="text-sm text-muted-foreground">Drafts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <DataGrid
        columns={columns}
        data={notices}
        isLoading={isLoading}
        isError={isError}
        errorMessage="Failed to load notices."
        emptyMessage="No notices created yet."
        rowKey={(notice) => notice.id}
        searchable
        searchPlaceholder="Search by title..."
        searchKeys={["title"]}
        pageSize={25}
        quickActions={(notice) => (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setViewTarget(notice)}>
              <Eye className="size-4" />
            </Button>
            {!notice.publishedAt && (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditTarget(notice)}>
                  <Pencil className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => publishNotice.mutate(notice.id)}>
                  <Send className="size-4" />
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteTarget(notice)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      />

      <NoticeFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={async (dto) => {
          try {
            await createNotice.mutateAsync(dto);
            setCreateOpen(false);
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Something went wrong");
          }
        }}
        error={error}
        setError={setError}
      />

      {editTarget && (
        <NoticeFormSheet
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          initial={editTarget}
          onSubmit={async (dto) => {
            try {
              await updateNotice.mutateAsync({ id: editTarget.id, dto });
              setEditTarget(null);
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Something went wrong");
            }
          }}
          error={error}
          setError={setError}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Notice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  deleteNotice.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ViewNoticeDialog
        notice={viewTarget}
        onClose={() => {
          setViewTarget(null);
          if (noticeId) {
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete("noticeId");
              return next;
            });
          }
        }}
      />
    </div>
  );
}

function NoticeFormSheet({
  open,
  onOpenChange,
  initial,
  onSubmit,
  error,
  setError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<NoticeResponse> | null;
  onSubmit: (dto: CreateNoticeDto) => Promise<void>;
  error: string | null;
  setError: (err: string | null) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [audienceRole, setAudienceRole] = useState(initial?.audienceRole ?? "");
  const [publishNow, setPublishNow] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      await onSubmit({
        title,
        body,
        audienceRole: audienceRole || null,
        publishNow,
      } as CreateNoticeDto);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{initial ? "Edit Notice" : "Create Notice"}</SheetTitle>
          <SheetDescription>
            {initial
              ? "Update the notice details below."
              : "Create a new notice to communicate with members and volunteers."}
          </SheetDescription>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 px-4 mt-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notice title"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body">Body</Label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your notice content here..."
              className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audienceRole">Target Audience</Label>
            <select
              id="audienceRole"
              value={audienceRole}
              onChange={(e) => setAudienceRole(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {!initial && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="publishNow"
                checked={publishNow}
                onChange={(e) => setPublishNow(e.target.checked)}
                className="rounded border-border"
              />
              <Label htmlFor="publishNow" className="text-sm">
                Publish immediately
              </Label>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="px-0 mt-4">
            <Button
              type="submit"
              disabled={isPending}
              className="bg-brand-green hover:bg-brand-green/90"
            >
              {initial ? "Update" : publishNow ? "Create & Publish" : "Save as Draft"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ViewNoticeDialog({
  notice,
  onClose,
}: {
  notice: NoticeResponse | null;
  onClose: () => void;
}) {
  if (!notice) return null;

  return (
    <Sheet open={!!notice} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{notice.title}</SheetTitle>
          <SheetDescription>
            {notice.publishedAt
              ? `Published ${new Date(notice.publishedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}`
              : "Draft — not yet published"}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 mt-4 space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm whitespace-pre-wrap">{notice.body}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" />
            {notice.audienceRole
              ? `Target: ${notice.audienceRole.replace(/_/g, " ")}`
              : "Target: All Members"}
          </div>
          <div className="text-xs text-muted-foreground">
            Created: {new Date(notice.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
