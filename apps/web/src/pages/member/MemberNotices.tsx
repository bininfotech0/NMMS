import { Link } from "react-router-dom";
import { Megaphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useMemberNotices } from "@/hooks/useNotices";

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function MemberNotices() {
  const { data: notices = [], isLoading } = useMemberNotices();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold">Notices</h1>
        <p className="text-sm text-muted-foreground">News and announcements from the NGO.</p>
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading notices…</p>
      ) : notices.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-8 text-center">
          <Megaphone className="size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No notices right now. New announcements will appear here.</p>
        </div>
      ) : (
        notices.map((notice) => (
          <Card key={notice.id} className="gap-2 py-4">
            <CardContent className="space-y-1 px-4">
              <p className="font-semibold">{notice.title}</p>
              {notice.publishedAt && <p className="text-xs text-muted-foreground">{formatDate(notice.publishedAt)}</p>}
              <p className="whitespace-pre-line text-sm">{notice.body}</p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// Newest notice as a small banner for the member Home page.
export function LatestNoticeBanner() {
  const { data: notices = [] } = useMemberNotices();
  const latest = notices[0];
  if (!latest) return null;

  return (
    <Link
      to="/member/notices"
      className="flex items-start gap-3 rounded-xl border border-brand-gold/40 bg-brand-bg-soft p-3 text-sm transition-colors hover:border-brand-gold"
    >
      <Megaphone className="mt-0.5 size-4 shrink-0 text-brand-brown" />
      <span className="min-w-0">
        <span className="block font-medium text-brand-brown">{latest.title}</span>
        <span className="line-clamp-2 text-muted-foreground">{latest.body}</span>
        {notices.length > 1 && <span className="mt-1 block text-xs font-medium text-brand-green">See all notices →</span>}
      </span>
    </Link>
  );
}
