import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import type { CardVerifyResponse } from "@nmms/shared";

type State =
  | { status: "loading" }
  | { status: "valid"; data: CardVerifyResponse }
  | { status: "invalid" };

export function VerifyCard() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ status: "invalid" });
      return;
    }
    let cancelled = false;
    fetch(`/api/v1/public/cards/verify/${token}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body: { data: CardVerifyResponse }) => {
        if (!cancelled) setState({ status: "valid", data: body.data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "invalid" });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg-soft px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
        <div className="flex justify-center">
          <Logo variant="stacked" size={44} />
        </div>

        {state.status === "loading" && (
          <p className="mt-6 text-sm text-muted-foreground">Checking card...</p>
        )}

        {state.status === "invalid" && (
          <div className="mt-6">
            <XCircle className="mx-auto size-12 text-destructive" />
            <p className="mt-3 font-heading text-lg font-semibold">Invalid or expired card</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This card could not be verified. Please contact the organization if you believe this is an
              error.
            </p>
          </div>
        )}

        {state.status === "valid" && (
          <div className="mt-6">
            <CheckCircle2 className="mx-auto size-12 text-brand-green" />
            <p className="mt-3 font-heading text-lg font-semibold text-brand-green-dark">Valid Member</p>
            <div className="mt-4 space-y-1.5 text-left text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{state.data.fullName}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Member ID</span>
                <span className="font-medium">{state.data.membershipNumber ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">{state.data.status}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Valid Till</span>
                <span className="font-medium">
                  {state.data.validUntil
                    ? new Date(state.data.validUntil).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "Lifetime"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
