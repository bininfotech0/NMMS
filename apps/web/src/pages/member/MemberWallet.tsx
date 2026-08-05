import { ArrowDownRight, ArrowUpRight, Receipt, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMyReferralLedger, useMyReferralSummary } from "@/hooks/useReferrals";

export function MemberWallet() {
  const { data: summary } = useMyReferralSummary();
  const { data: ledger, isLoading } = useMyReferralLedger();

  return (
    <div className="space-y-4">
      <Card className="gap-3 py-4">
        <CardContent className="flex items-center justify-between px-4">
          <div>
            <p className="text-sm text-muted-foreground">Points balance</p>
            <p className="mt-1 text-3xl font-bold text-brand-green">{summary?.pointsBalance ?? 0}</p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand-green/10 text-brand-green">
            <Wallet className="size-5" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Points history</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !ledger || ledger.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Receipt className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No points activity yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {ledger.map((entry) => {
                const isCredit = entry.points >= 0;
                return (
                  <li key={entry.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <div
                      className={
                        isCredit
                          ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-green/10 text-brand-green"
                          : "flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
                      }
                    >
                      {isCredit ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        {entry.reason === "REFERRAL_APPROVED" && entry.relatedMemberName
                          ? `${entry.relatedMemberName} joined and was approved`
                          : entry.note ?? "Manual adjustment"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={isCredit ? "font-medium text-brand-green" : "font-medium text-destructive"}>
                      {isCredit ? "+" : ""}
                      {entry.points}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
