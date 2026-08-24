import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, CreditCard, FileText, Upload, UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    amount,
  );
}

// A self-registered member starts DRAFT with no plan at all — this guides
// them through the three steps needed to reach SUBMITTED without staff
// involvement: pick a plan, pay the fee online, then finish their profile
// (documents + declarations) and submit for review. Rendered by
// MemberDashboard in place of the generic "pending" message while status is
// DRAFT or PAYMENT_COLLECTED.
export function MemberCompleteRegistration({ member }: { member: MemberResponse }) {
  if (member.status === "DRAFT" && !member.planId) {
    return <PlanStep />;
  }
  if (member.status === "DRAFT" && member.planId) {
    return <PayFeeStep member={member} />;
  }
  return <FinishProfileStep member={member} />;
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
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(planId: string) {
    setError(null);
    try {
      await selectPlan.mutateAsync(planId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <StepShell step={1} title="Choose your membership plan" description="Pick the plan you'd like to join with.">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading plans…</p>
      ) : plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">No plans are available right now — please check back later.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              disabled={selectPlan.isPending}
              onClick={() => handleSelect(plan.id)}
              className="rounded-xl border border-border p-4 text-left transition-colors hover:border-brand-green hover:bg-brand-bg-soft disabled:opacity-50"
            >
              <p className="font-heading text-base font-semibold">{plan.name}</p>
              {plan.tier && <p className="text-xs text-muted-foreground">{plan.tier[0]}{plan.tier.slice(1).toLowerCase()} tier</p>}
              <p className="mt-2 text-xl font-bold text-brand-green">{formatCurrency(plan.fee)}</p>
              <p className="text-xs text-muted-foreground">
                {plan.validityType === "LIFETIME" ? "Lifetime membership" : `Valid ${plan.validityMonths} month(s)`}
              </p>
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </StepShell>
  );
}

function PayFeeStep({ member }: { member: MemberResponse }) {
  const { data: plans = [] } = useMyAvailablePlans();
  const { data: gatewayStatus } = useMyPaymentGatewayStatus();
  const createOrder = useCreateMyPaymentOrder();
  const verifyPayment = useVerifyMyPaymentGateway();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = plans.find((p) => p.id === member.planId);
  const onlineAvailable = gatewayStatus?.enabled ?? false;

  async function handlePayOnline() {
    setError(null);
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
        modal: { ondismiss: () => setProcessing(false) },
        handler: (response) => {
          verifyPayment
            .mutateAsync({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            })
            .catch((err) => {
              setError(
                err instanceof ApiError
                  ? err.message
                  : "Payment verification failed. Contact support if the amount was debited.",
              );
            })
            .finally(() => setProcessing(false));
        },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start online payment.");
      setProcessing(false);
    }
  }

  return (
    <StepShell step={2} title="Pay your registration fee" description={`You've chosen ${member.planName ?? "a plan"}.`}>
      {plan && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-brand-bg-soft px-4 py-3">
          <span className="text-sm font-medium">Amount due</span>
          <span className="text-lg font-bold text-brand-green-dark">{formatCurrency(plan.fee)}</span>
        </div>
      )}
      {onlineAvailable ? (
        <Button
          type="button"
          onClick={handlePayOnline}
          disabled={processing}
          className="w-full bg-brand-green hover:bg-brand-green/90 sm:w-auto"
        >
          <CreditCard className="size-4" />
          {processing ? "Opening payment…" : "Pay Online (Card/UPI)"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Online payment isn't available right now — please contact your field executive to collect your
          registration fee in person.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </StepShell>
  );
}

function FinishProfileStep({ member }: { member: MemberResponse }) {
  const { data: documents = [] } = useMyDocuments();
  const uploadDocument = useUploadMyDocument();
  const updateProfile = useUpdateMyProfile();
  const submitRegistration = useSubmitMyRegistration();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const idProofInputRef = useRef<HTMLInputElement>(null);
  const [idProofType, setIdProofType] = useState<DocumentType>("AADHAAR");
  const [declarationInfoCorrect, setDeclarationInfoCorrect] = useState(false);
  const [declarationAcceptConstitution, setDeclarationAcceptConstitution] = useState(false);
  const [declarationAcceptPrivacyPolicy, setDeclarationAcceptPrivacyPolicy] = useState(false);
  const [declarationAcceptTerms, setDeclarationAcceptTerms] = useState(false);
  const [declarationPlace, setDeclarationPlace] = useState("");
  const [error, setError] = useState<string | null>(null);

  const hasPhoto = documents.some((d) => d.type === "PHOTO");
  const hasIdProof = documents.some((d) => ["AADHAAR", "AADHAAR_FRONT", "PAN", "VOTER_ID", "PASSPORT", "DRIVING_LICENCE", "GOVERNMENT_ID"].includes(d.type));
  const hasAddress = !!member.addressLine && !!member.pincode;
  const allDeclarationsAccepted =
    declarationInfoCorrect && declarationAcceptConstitution && declarationAcceptPrivacyPolicy && declarationAcceptTerms;

  async function handleSubmit() {
    setError(null);
    try {
      if (declarationPlace) {
        await updateProfile.mutateAsync({
          declarationInfoCorrect,
          declarationAcceptConstitution,
          declarationAcceptPrivacyPolicy,
          declarationAcceptTerms,
          declarationPlace,
          declarationDate: new Date(),
        });
      }
      await submitRegistration.mutateAsync();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <StepShell
      step={3}
      title="Finish your profile"
      description="A few more details, then submit your registration for review."
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 text-sm">
            {hasAddress ? <Check className="size-4 text-brand-green" /> : <UserRound className="size-4 text-muted-foreground" />}
            <span>Address & personal details</span>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link to="/member/profile">{hasAddress ? "Edit" : "Complete"}</Link>
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 text-sm">
            {hasPhoto ? <Check className="size-4 text-brand-green" /> : <FileText className="size-4 text-muted-foreground" />}
            <span>Passport photo</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={uploadDocument.isPending}
            onClick={() => photoInputRef.current?.click()}
          >
            <Upload className="size-4" />
            {hasPhoto ? "Replace" : "Upload"}
          </Button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadDocument.mutate({ type: "PHOTO", file });
              e.target.value = "";
            }}
          />
        </div>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              {hasIdProof ? <Check className="size-4 text-brand-green" /> : <FileText className="size-4 text-muted-foreground" />}
              <span>ID proof</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={uploadDocument.isPending}
              onClick={() => idProofInputRef.current?.click()}
            >
              <Upload className="size-4" />
              {hasIdProof ? "Add another" : "Upload"}
            </Button>
            <input
              ref={idProofInputRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadDocument.mutate({ type: idProofType, file });
                e.target.value = "";
              }}
            />
          </div>
          <NativeSelect
            id="idProofType"
            value={idProofType}
            onChange={(e) => setIdProofType(e.target.value as DocumentType)}
            options={ID_PROOF_TYPES}
          />
        </div>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-sm font-medium">Declaration</p>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={declarationInfoCorrect} onChange={(e) => setDeclarationInfoCorrect(e.target.checked)} className="mt-0.5" />
            I declare the information provided is true and correct
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={declarationAcceptConstitution} onChange={(e) => setDeclarationAcceptConstitution(e.target.checked)} className="mt-0.5" />
            I accept the organization's constitution
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={declarationAcceptPrivacyPolicy} onChange={(e) => setDeclarationAcceptPrivacyPolicy(e.target.checked)} className="mt-0.5" />
            I accept the privacy policy
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={declarationAcceptTerms} onChange={(e) => setDeclarationAcceptTerms(e.target.checked)} className="mt-0.5" />
            I accept the terms & conditions
          </label>
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="declarationPlace">Place</Label>
            <Input id="declarationPlace" value={declarationPlace} onChange={(e) => setDeclarationPlace(e.target.value)} />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={submitRegistration.isPending || updateProfile.isPending || !allDeclarationsAccepted}
          className="bg-brand-green hover:bg-brand-green/90"
        >
          {submitRegistration.isPending ? "Submitting…" : "Submit for Review"}
        </Button>
      </div>
    </StepShell>
  );
}
