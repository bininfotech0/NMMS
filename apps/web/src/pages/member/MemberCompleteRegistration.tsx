import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, CreditCard, Loader2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ContactUs } from "@/components/member/ContactUs";
import { AddressFields, type AddressValue } from "@/pages/admin/members/AddressFields";
import { ApiError } from "@/lib/api-client";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";
import { useMyAvailablePlans, useSelectMyPlan, useSubmitMyRegistration, useUpdateMyProfile } from "@/hooks/useMyProfile";
import { useMyDocuments, useUploadMyDocument } from "@/hooks/useMyDocuments";
import { useCreateMyPaymentOrder, useMyPaymentGatewayStatus, useVerifyMyPaymentGateway } from "@/hooks/useMyPayments";
import type { DocumentType, MemberResponse } from "@nmms/shared";

const ID_PROOF_TYPES: { value: DocumentType; label: string }[] = [
  { value: "AADHAAR", label: "Aadhaar Card" },
  { value: "PAN", label: "PAN Card" },
  { value: "VOTER_ID", label: "Voter ID" },
  { value: "PASSPORT", label: "Passport" },
  { value: "DRIVING_LICENCE", label: "Driving Licence" },
  { value: "GOVERNMENT_ID", label: "Other Government ID" },
];

const ID_PROOF_DOCUMENT_TYPES = ["AADHAAR", "AADHAAR_FRONT", "PAN", "VOTER_ID", "PASSPORT", "DRIVING_LICENCE", "GOVERNMENT_ID"];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    amount,
  );
}

// A self-registered member starts DRAFT with no plan at all — this guides
// them through the three steps needed to activate their own membership with
// no staff involvement: pick a plan, add their details (address, photo, ID,
// declarations) and submit, then pay the fee online — payment auto-activates
// the membership immediately, no manual review step. Rendered by
// MemberDashboard in place of the generic "pending" message while status is
// DRAFT or AWAITING_PAYMENT.
export function MemberCompleteRegistration({ member }: { member: MemberResponse }) {
  if (member.status === "DRAFT" && !member.planId) {
    return <PlanStep />;
  }
  if (member.status === "DRAFT" && member.planId) {
    return <FinishProfileStep member={member} />;
  }
  return <PayFeeStep member={member} />;
}

function StepShell({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge className="border-transparent bg-brand-green/10 font-medium text-brand-green">Step {step} of 3</Badge>
        </div>
        <CardTitle className="mt-1">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function PlanStep() {
  const { data: plans = [], isLoading } = useMyAvailablePlans();
  const selectPlan = useSelectMyPlan();

  return (
    <StepShell step={1} title="Choose your membership plan" description="Tap the plan you want. You will pay for it in step 3.">
      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading plans…
        </p>
      ) : plans.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">No plans are available right now. Please check again later.</p>
          <ContactUs />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              disabled={selectPlan.isPending}
              // The hook already shows a toast if this fails.
              onClick={() => selectPlan.mutate(plan.id)}
              className="rounded-xl border border-border p-4 text-left transition-colors hover:border-brand-green hover:bg-brand-bg-soft disabled:opacity-50"
            >
              <p className="font-heading text-base font-semibold">{plan.name}</p>
              {plan.tier && <p className="text-xs text-muted-foreground">{plan.tier[0]}{plan.tier.slice(1).toLowerCase()} level</p>}
              <p className="mt-2 text-xl font-bold text-brand-green">{formatCurrency(plan.fee)}</p>
              <p className="text-xs text-muted-foreground">
                {plan.validityType === "LIFETIME"
                  ? "Lifetime membership — pay once"
                  : `Valid for ${plan.validityMonths} month${plan.validityMonths === 1 ? "" : "s"}`}
              </p>
              <p className="mt-3 text-sm font-medium text-brand-green">Choose this plan →</p>
            </button>
          ))}
        </div>
      )}
    </StepShell>
  );
}

function PayFeeStep({ member }: { member: MemberResponse }) {
  return (
    <StepShell
      step={3}
      title="Pay your membership fee"
      description="Your details are saved. Pay the fee below and your membership starts straight away."
    >
      <PayMembershipFee member={member} />
    </StepShell>
  );
}

// Online fee payment (Razorpay). Used for the first fee while joining and
// for renewing an expired membership — the API accepts both.
export function PayMembershipFee({ member, buttonLabel }: { member: MemberResponse; buttonLabel?: string }) {
  const { data: plans = [] } = useMyAvailablePlans();
  const { data: gatewayStatus } = useMyPaymentGatewayStatus();
  const createOrder = useCreateMyPaymentOrder();
  const verifyPayment = useVerifyMyPaymentGateway();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  const plan = plans.find((p) => p.id === member.planId);
  const amount = member.feeOverride ?? plan?.fee ?? null;
  const onlineAvailable = gatewayStatus?.enabled ?? false;

  async function handlePayOnline() {
    setError(null);
    setNotice(null);
    setProcessing(true);
    try {
      const order = await createOrder.mutateAsync();
      await openRazorpayCheckout({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: order.currency,
        name: order.name,
        description: order.description,
        theme: { color: "#2e7d32" },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            setNotice("Payment not completed. No money was taken. Tap the button to try again.");
          },
        },
        handler: (response) => {
          verifyPayment
            .mutateAsync({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            })
            .then(() => setPaid(true))
            .catch(() => {
              setError(
                "We couldn't confirm your payment yet. If money was taken from your account, don't pay again — contact us and we'll sort it out.",
              );
            })
            .finally(() => setProcessing(false));
        },
      });
    } catch {
      setError("We couldn't open the payment page. Please check your internet and try again.");
      setProcessing(false);
    }
  }

  if (paid) {
    return (
      <div className="space-y-2 rounded-lg bg-brand-bg-soft p-4 text-sm">
        <p className="font-medium text-brand-green-dark">Payment received — thank you! Your membership is now active.</p>
        <Link to="/member/payments" className="font-medium text-brand-green hover:underline">
          View your receipt
        </Link>
      </div>
    );
  }

  return (
    <div>
      {amount !== null && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-brand-bg-soft px-4 py-3">
          <span className="text-sm font-medium">Amount to pay{member.planName ? ` (${member.planName})` : ""}</span>
          <span className="text-lg font-bold text-brand-green-dark">{formatCurrency(amount)}</span>
        </div>
      )}
      {onlineAvailable ? (
        <>
          <Button
            type="button"
            onClick={handlePayOnline}
            disabled={processing}
            className="w-full bg-brand-green hover:bg-brand-green/90 sm:w-auto"
          >
            {processing ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
            {processing ? "Opening payment…" : (buttonLabel ?? "Pay now (UPI / Card)")}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            You can pay with UPI (Google Pay, PhonePe, Paytm), debit card or credit card.
          </p>
        </>
      ) : (
        <ContactUs title="Online payment isn't available right now. Please contact us to pay in person." />
      )}
      {notice && <p className="mt-3 text-sm text-muted-foreground">{notice}</p>}
      {error && (
        <div className="mt-3 space-y-3">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          <ContactUs />
        </div>
      )}
    </div>
  );
}

function FinishProfileStep({ member }: { member: MemberResponse }) {
  const { data: documents = [] } = useMyDocuments();
  const uploadDocument = useUploadMyDocument();
  const updateProfile = useUpdateMyProfile({ notify: false });
  const submitRegistration = useSubmitMyRegistration();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const idProofInputRef = useRef<HTMLInputElement>(null);
  const [idProofType, setIdProofType] = useState<DocumentType>("AADHAAR");
  const [uploading, setUploading] = useState<"photo" | "id" | null>(null);
  const [address, setAddress] = useState<AddressValue>({
    pincode: member.pincode ?? "",
    addressLine: member.addressLine ?? "",
    landmark: member.landmark ?? "",
    latitude: "",
    longitude: "",
  });
  const [declarationInfoCorrect, setDeclarationInfoCorrect] = useState(member.declarationInfoCorrect);
  const [declarationAcceptConstitution, setDeclarationAcceptConstitution] = useState(member.declarationAcceptConstitution);
  const [declarationAcceptPrivacyPolicy, setDeclarationAcceptPrivacyPolicy] = useState(member.declarationAcceptPrivacyPolicy);
  const [declarationAcceptTerms, setDeclarationAcceptTerms] = useState(member.declarationAcceptTerms);
  const [declarationPlace, setDeclarationPlace] = useState(member.declarationPlace ?? "");
  const [error, setError] = useState<string | null>(null);

  const photo = documents.find((d) => d.type === "PHOTO");
  const idProof = documents.find((d) => ID_PROOF_DOCUMENT_TYPES.includes(d.type));
  const hasAddress = address.addressLine.trim().length > 0 && /^[1-9][0-9]{5}$/.test(address.pincode.trim());
  const allDeclarationsAccepted =
    declarationInfoCorrect && declarationAcceptConstitution && declarationAcceptPrivacyPolicy && declarationAcceptTerms;
  const readyToSubmit = hasAddress && !!photo && !!idProof && allDeclarationsAccepted;
  const readinessChecks = [
    { label: "Your address and 6-digit pincode", complete: hasAddress },
    { label: "Your photo", complete: !!photo },
    { label: "One ID proof (for example your Aadhaar card)", complete: !!idProof },
    { label: "All four boxes ticked under \"I agree\"", complete: allDeclarationsAccepted },
  ];

  function upload(kind: "photo" | "id", file: File) {
    setError(null);
    setUploading(kind);
    // The hook shows its own toast on failure; this inline message stays
    // visible after the toast disappears.
    uploadDocument.mutate(
      { type: kind === "photo" ? "PHOTO" : idProofType, file },
      {
        onError: () => setError("The upload didn't work. Please check your internet and try again."),
        onSettled: () => setUploading(null),
      },
    );
  }

  async function handleSubmit() {
    setError(null);
    try {
      await updateProfile.mutateAsync({
        addressLine: address.addressLine.trim(),
        pincode: address.pincode.trim(),
        landmark: address.landmark.trim() || null,
        declarationInfoCorrect,
        declarationAcceptConstitution,
        declarationAcceptPrivacyPolicy,
        declarationAcceptTerms,
        declarationPlace: declarationPlace.trim() || null,
        declarationDate: new Date(),
      });
      await submitRegistration.mutateAsync();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  const submitting = submitRegistration.isPending || updateProfile.isPending;

  return (
    <StepShell
      step={2}
      title="Add your details"
      description="Fill in the four parts below. A green tick shows when each part is done."
    >
      <div className="space-y-5">
        <div className="space-y-3 rounded-lg border border-border p-3">
          <StepPartTitle number={1} done={hasAddress} title="Your address" />
          <AddressFields idPrefix="join" value={address} onChange={setAddress} hideCoordinates />
        </div>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <StepPartTitle number={2} done={!!photo} title="Your photo" />
            <Button size="sm" variant="outline" disabled={uploading !== null} onClick={() => photoInputRef.current?.click()}>
              {uploading === "photo" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading === "photo" ? "Uploading…" : photo ? "Change photo" : "Choose photo"}
            </Button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload("photo", file);
                e.target.value = "";
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {photo ? `Uploaded: ${photo.fileName}` : "A clear photo of your face, like a passport photo (JPG or PNG)."}
          </p>
        </div>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <StepPartTitle number={3} done={!!idProof} title="ID proof" />
          <p className="text-xs text-muted-foreground">
            {idProof
              ? `Uploaded: ${idProof.fileName}`
              : "Choose which ID you have, then upload a clear photo or PDF of it."}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <NativeSelect
                id="idProofType"
                label="Which ID?"
                value={idProofType}
                onChange={(e) => setIdProofType(e.target.value as DocumentType)}
                options={ID_PROOF_TYPES}
              />
            </div>
            <Button size="sm" variant="outline" disabled={uploading !== null} onClick={() => idProofInputRef.current?.click()}>
              {uploading === "id" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading === "id" ? "Uploading…" : idProof ? "Add another ID" : "Upload ID"}
            </Button>
            <input
              ref={idProofInputRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload("id", file);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <StepPartTitle number={4} done={allDeclarationsAccepted} title="I agree" />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={declarationInfoCorrect} onChange={(e) => setDeclarationInfoCorrect(e.target.checked)} className="mt-0.5 size-4" />
            The information I have given is true and correct
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={declarationAcceptConstitution} onChange={(e) => setDeclarationAcceptConstitution(e.target.checked)} className="mt-0.5 size-4" />
            I accept the organization's rules (constitution)
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={declarationAcceptPrivacyPolicy} onChange={(e) => setDeclarationAcceptPrivacyPolicy(e.target.checked)} className="mt-0.5 size-4" />
            I accept the privacy policy
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={declarationAcceptTerms} onChange={(e) => setDeclarationAcceptTerms(e.target.checked)} className="mt-0.5 size-4" />
            I accept the terms & conditions
          </label>
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="declarationPlace">Your town or village (optional)</Label>
            <Input id="declarationPlace" value={declarationPlace} onChange={(e) => setDeclarationPlace(e.target.value)} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="mb-2 text-sm font-medium">Before you continue, please complete:</p>
          <ul className="space-y-1 text-sm">
            {readinessChecks.map(({ label, complete }) => (
              <li key={label} className={complete ? "text-brand-green" : "text-muted-foreground"}>
                {complete ? "✓" : "○"} {label}
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !readyToSubmit}
          className="w-full bg-brand-green hover:bg-brand-green/90 sm:w-auto"
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting ? "Saving…" : "Save and go to payment"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Want to add more about yourself? You can do that any time later on your{" "}
          <Link to="/member/profile" className="text-brand-green hover:underline">
            Profile
          </Link>{" "}
          page.
        </p>
      </div>
    </StepShell>
  );
}

function StepPartTitle({ number, done, title }: { number: number; done: boolean; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      {done ? <Check className="size-4 text-brand-green" /> : <span className="text-muted-foreground">{number}.</span>}
      <span>{title}</span>
    </div>
  );
}
