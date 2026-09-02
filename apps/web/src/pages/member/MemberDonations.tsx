import { useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard, HeartHandshake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ApiError } from "@/lib/api-client";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";
import {
  useCreateMyDonationOrder,
  useMyDonationGatewayStatus,
  useMyDonations,
  useSubmitDonation,
  useVerifyMyDonationGatewayPayment,
} from "@/hooks/useDonations";
import type { DonationResponse, ManualDonationMode } from "@nmms/shared";

const MODE_OPTIONS: { value: ManualDonationMode; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "BANK", label: "Bank Transfer" },
  { value: "CHEQUE", label: "Cheque" },
];

const STATUS_STYLES: Record<DonationResponse["status"], string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    amount,
  );
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function MemberDonations() {
  const { data: donations = [], isLoading } = useMyDonations();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Donations</h1>
        <p className="text-sm text-muted-foreground">
          Support the organization directly and earn reward points once your donation is confirmed.
        </p>
      </div>

      <DonationForm />

      <Card>
        <CardHeader>
          <CardTitle>Your donations</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : donations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <HeartHandshake className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No donations yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {donations.map((donation) => (
                <li key={donation.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{formatCurrency(donation.amount)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(donation.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={`border-transparent font-medium ${STATUS_STYLES[donation.status]}`}>
                      {donation.status[0] + donation.status.slice(1).toLowerCase()}
                    </Badge>
                    {donation.status === "APPROVED" && (
                      <Link to={`/member/donations/${donation.id}/receipt`} className="text-brand-green hover:underline">
                        View Receipt
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DonationForm() {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<ManualDonationMode>("CASH");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [donorAddress, setDonorAddress] = useState("");
  const [donorPan, setDonorPan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const submitDonation = useSubmitDonation();
  const { data: gatewayStatus, isLoading: gatewayLoading } = useMyDonationGatewayStatus();
  const createOrder = useCreateMyDonationOrder();
  const verifyPayment = useVerifyMyDonationGatewayPayment();
  const [payingOnline, setPayingOnline] = useState(false);
  const onlineAvailable = gatewayStatus?.enabled ?? false;

  const amountNum = Number(amount);
  const amountValid = amount.trim() !== "" && amountNum > 0;

  async function handlePayOnline() {
    setError(null);
    setPayingOnline(true);
    try {
      const order = await createOrder.mutateAsync({
        amount: amountNum,
        donorAddress: donorAddress || undefined,
        donorPan: donorPan || undefined,
      });
      await openRazorpayCheckout({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: order.currency,
        name: order.name,
        description: order.description,
        theme: { color: "#2e7d32" },
        modal: { ondismiss: () => setPayingOnline(false) },
        handler: (response) => {
          verifyPayment
            .mutateAsync({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            })
            .then(() => setAmount(""))
            .catch((err) => {
              setError(
                err instanceof ApiError
                  ? err.message
                  : "Payment verification failed. Contact support if the amount was debited.",
              );
            })
            .finally(() => setPayingOnline(false));
        },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start online donation.");
      setPayingOnline(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await submitDonation.mutateAsync({
        amount: amountNum,
        mode,
        note: note || undefined,
        reference: reference || undefined,
        donorAddress: donorAddress || undefined,
        donorPan: donorPan || undefined,
      });
      setAmount("");
      setNote("");
      setReference("");
      setDonorAddress("");
      setDonorPan("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Make a donation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="donorAddress">Address (optional)</Label>
            <Input
              id="donorAddress"
              value={donorAddress}
              onChange={(e) => setDonorAddress(e.target.value)}
              placeholder="For your 80G tax receipt"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="donorPan">PAN (optional)</Label>
            <Input
              id="donorPan"
              value={donorPan}
              onChange={(e) => setDonorPan(e.target.value.toUpperCase())}
              placeholder="For your 80G tax receipt"
            />
          </div>
        </div>

        {onlineAvailable && (
          <Button
            type="button"
            onClick={handlePayOnline}
            disabled={!amountValid || payingOnline}
            className="w-full bg-brand-green hover:bg-brand-green/90 sm:w-auto"
          >
            <CreditCard className="size-4" />
            {payingOnline ? "Opening payment…" : "Pay Online (Card/UPI)"}
          </Button>
        )}

        {error && (!onlineAvailable || showManualForm ? null : <p className="text-sm text-destructive">{error}</p>)}

        {gatewayLoading ? null : onlineAvailable && !showManualForm ? (
          <button
            type="button"
            onClick={() => setShowManualForm(true)}
            className="block text-sm font-medium text-muted-foreground underline-offset-4 hover:text-brand-green-dark hover:underline"
          >
            Sent it another way? Record it manually instead
          </button>
        ) : (
          <form className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <NativeSelect
              id="mode"
              label="How did you send it?"
              value={mode}
              onChange={(e) => setMode(e.target.value as ManualDonationMode)}
              options={MODE_OPTIONS}
            />
            <div className="space-y-1.5">
              <Label htmlFor="reference">Reference / transaction no. (optional)</Label>
              <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
            <div className="sm:col-span-2">
              <Button
                type="submit"
                disabled={submitDonation.isPending}
                className="bg-brand-green hover:bg-brand-green/90"
              >
                <HeartHandshake className="size-4" />
                {submitDonation.isPending ? "Submitting…" : "Submit Donation"}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                A Field Executive or Admin will confirm receipt before points are credited and a receipt is issued.
              </p>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
