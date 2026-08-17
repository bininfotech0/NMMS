import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useMember, useSubmitMember, useUpdateMember } from "@/hooks/useMembers";
import { useMemberDocuments } from "@/hooks/useDocuments";
import {
  emptyWizardForm,
  getStepValidationError,
  ID_PROOF_DOCUMENT_TYPES,
  memberToWizardForm,
  wizardFormToUpdateDto,
  WIZARD_STEP_TITLES,
  type WizardFormState,
} from "./wizard-types";
import { StepMembership } from "./steps/StepMembership";
import { StepBasicInfo } from "./steps/StepBasicInfo";
import { StepPersonal } from "./steps/StepPersonal";
import { StepAddress } from "./steps/StepAddress";
import { StepEducation } from "./steps/StepEducation";
import { StepPayment } from "./steps/StepPayment";
import { StepDocuments } from "./steps/StepDocuments";
import { StepNominee } from "./steps/StepNominee";
import { StepDeclaration } from "./steps/StepDeclaration";
import { StepReview } from "./steps/StepReview";

const TOTAL_STEPS = 10;
const PAYMENT_STEP = 5;

export function MemberWizard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: member, isLoading } = useMember(id ?? null);
  const { data: documents = [] } = useMemberDocuments(id ?? null);
  const updateMember = useUpdateMember();
  const submitMember = useSubmitMember();

  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState<WizardFormState>(emptyWizardForm());
  const [loaded, setLoaded] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  useEffect(() => {
    if (member && !loaded) {
      setForm(memberToWizardForm(member));
      setLoaded(true);
    }
  }, [member, loaded]);

  if (!id) return null;

  async function save(): Promise<boolean> {
    try {
      await updateMember.mutateAsync({ id: id!, dto: wizardFormToUpdateDto(form) });
      return true;
    } catch {
      return false;
    }
  }

  async function handleNext() {
    if (currentStep === PAYMENT_STEP && member?.status === "DRAFT") {
      return; // registration fee must be collected before continuing
    }
    const validationError = getStepValidationError(currentStep, form);
    if (validationError) {
      setStepError(validationError);
      return;
    }
    setStepError(null);
    const ok = await save();
    if (ok) setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  async function handlePrevious() {
    setStepError(null);
    await save();
    setCurrentStep((s) => Math.max(s - 1, 0));
  }

  function handleOpenConfirmSubmit() {
    for (let step = 0; step < TOTAL_STEPS; step++) {
      const validationError = getStepValidationError(step, form);
      if (validationError) {
        setCurrentStep(step);
        setStepError(validationError);
        return;
      }
    }
    setStepError(null);
    setConfirmSubmitOpen(true);
  }

  async function handleSubmit() {
    const ok = await save();
    if (!ok) return;
    submitMember.mutate(id!, {
      onSuccess: () => navigate("/admin/members"),
    });
    setConfirmSubmitOpen(false);
  }

  if (isLoading || !loaded) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading member...</p>;
  }

  const stepProps = { form, setForm, memberId: id };
  const isLastStep = currentStep === TOTAL_STEPS - 1;
  const isSaving = updateMember.isPending;
  const paymentBlocked = currentStep === PAYMENT_STEP && member?.status === "DRAFT";
  const hasPhoto = documents.some((d) => d.type === "PHOTO");
  const hasIdProof = documents.some((d) => ID_PROOF_DOCUMENT_TYPES.includes(d.type));
  const missingDocsReason = !hasPhoto
    ? "Upload a passport photo (Identity & Documents step) before submitting"
    : !hasIdProof
      ? "Upload an ID proof document (Identity & Documents step) before submitting"
      : null;
  const canSubmit = member?.status === "PAYMENT_COLLECTED" && !missingDocsReason;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">{member?.fullName || "New Member"}</h1>
        <p className="text-sm text-muted-foreground">
          {member?.registrationNumber ? `${member.registrationNumber} · ` : ""}
          Step {currentStep + 1} of {TOTAL_STEPS} — {WIZARD_STEP_TITLES[currentStep]}
        </p>
        <Progress value={((currentStep + 1) / TOTAL_STEPS) * 100} className="mt-3" />
      </div>

      {stepError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {stepError}
        </p>
      )}

      <div className="rounded-xl border border-border bg-card p-6">
        {currentStep === 0 && <StepMembership {...stepProps} />}
        {currentStep === 1 && <StepBasicInfo {...stepProps} />}
        {currentStep === 2 && <StepPersonal {...stepProps} />}
        {currentStep === 3 && <StepAddress {...stepProps} />}
        {currentStep === 4 && <StepEducation {...stepProps} />}
        {currentStep === 5 && <StepPayment {...stepProps} />}
        {currentStep === 6 && <StepDocuments {...stepProps} />}
        {currentStep === 7 && <StepNominee {...stepProps} />}
        {currentStep === 8 && <StepDeclaration {...stepProps} />}
        {currentStep === 9 && <StepReview form={form} member={member ?? null} memberId={id} />}
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" disabled={currentStep === 0 || isSaving} onClick={handlePrevious}>
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => void save()}
          >
            {isSaving ? "Saving…" : "Save Draft"}
          </Button>
          {isLastStep ? (
            <Button
              type="button"
              className="bg-brand-green hover:bg-brand-green/90"
              disabled={isSaving || submitMember.isPending || !canSubmit}
              title={
                member?.status !== "PAYMENT_COLLECTED"
                  ? "Collect the registration fee (Payment Collection step) before submitting"
                  : (missingDocsReason ?? undefined)
              }
              onClick={handleOpenConfirmSubmit}
            >
              Submit Application
            </Button>
          ) : (
            <Button
              type="button"
              className="bg-brand-green hover:bg-brand-green/90"
              disabled={isSaving || paymentBlocked}
              title={paymentBlocked ? "Collect the registration fee to continue" : undefined}
              onClick={handleNext}
            >
              {isSaving ? "Saving…" : "Save & Continue"}
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmSubmitOpen}
        onOpenChange={setConfirmSubmitOpen}
        title="Submit this application?"
        description="Once submitted, this application moves to the review queue and can no longer be edited unless a reviewer sends it back."
        confirmLabel="Submit"
        destructive={false}
        isPending={submitMember.isPending}
        onConfirm={handleSubmit}
      />
    </div>
  );
}
