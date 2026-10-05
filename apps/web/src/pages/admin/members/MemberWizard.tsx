import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useMember, useSubmitMember, useUpdateMember } from "@/hooks/useMembers";
import { ApiError } from "@/lib/api-client";
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

// The ten form sections (indexes into WIZARD_STEP_TITLES and
// getStepValidationError) shown as four simple screens for field staff.
// Optional sections are tucked into a collapsed "More details" area so the
// required path is short.
const SECTION = {
  MEMBERSHIP: 0,
  BASIC: 1,
  PERSONAL: 2,
  ADDRESS: 3,
  EDUCATION: 4,
  DOCUMENTS: 5,
  NOMINEE: 6,
  DECLARATION: 7,
  REVIEW: 8,
  PAYMENT: 9,
} as const;

const SCREENS: { title: string; hint: string; sections: number[]; optionalSections?: number[] }[] = [
  {
    title: "Plan & person",
    hint: "Choose the plan and enter the person's name and basic details.",
    sections: [SECTION.MEMBERSHIP, SECTION.BASIC],
  },
  {
    title: "Address & documents",
    hint: "Add the address, then take or upload a photo and one ID proof.",
    sections: [SECTION.ADDRESS, SECTION.DOCUMENTS],
    optionalSections: [SECTION.PERSONAL, SECTION.EDUCATION, SECTION.NOMINEE],
  },
  {
    title: "Agree & check",
    hint: "Ask the person to agree, check everything once, then submit.",
    sections: [SECTION.DECLARATION, SECTION.REVIEW],
  },
  {
    title: "Collect payment",
    hint: "Collect the fee. The membership starts as soon as it is paid.",
    sections: [SECTION.PAYMENT],
  },
];
const TOTAL_SCREENS = SCREENS.length;
const SUBMIT_SCREEN = 2;
const PAYMENT_SCREEN = 3;

const OPTIONAL_SECTION_FIELDS: (keyof WizardFormState)[] = [
  "fatherName",
  "motherName",
  "spouseOrGuardianName",
  "familyTypeId",
  "familyMembersCount",
  "childrenCount",
  "monthlyIncome",
  "educationId",
  "qualificationDetail",
  "occupationId",
  "businessTypeId",
  "languagesKnown",
  "skills",
  "emergencyContactName",
  "emergencyContactMobile",
  "nomineeName",
  "nomineeMobile",
];

function screenValidationError(screen: number, form: WizardFormState): string | null {
  for (const section of SCREENS[screen].sections) {
    const error = getStepValidationError(section, form);
    if (error) return error;
  }
  return null;
}

export function MemberWizard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: member, isLoading } = useMember(id ?? null);
  const { data: documents = [] } = useMemberDocuments(id ?? null);
  const updateMember = useUpdateMember();
  const submitMember = useSubmitMember();

  const [currentScreen, setCurrentScreen] = useState(0);
  const [form, setForm] = useState<WizardFormState>(emptyWizardForm());
  const [loaded, setLoaded] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  useEffect(() => {
    if (member && !loaded) {
      setForm(memberToWizardForm(member));
      // Already submitted (or beyond) — the only thing left is payment, so
      // land there directly instead of clicking through finished screens.
      if (member.status !== "DRAFT") {
        setCurrentScreen(PAYMENT_SCREEN);
      }
      setLoaded(true);
    }
  }, [member, loaded]);

  if (!id) return null;

  async function save(): Promise<boolean> {
    try {
      await updateMember.mutateAsync({ id: id!, dto: wizardFormToUpdateDto(form) });
      return true;
    } catch (err) {
      // e.g. "This Aadhaar number is already registered to …" — keep it on
      // screen (the toast disappears) so staff know why they can't continue.
      setStepError(err instanceof ApiError ? err.message : "Couldn't save. Please check your internet and try again.");
      return false;
    }
  }

  function goTo(screen: number) {
    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleNext() {
    const validationError = screenValidationError(currentScreen, form);
    if (validationError) {
      setStepError(validationError);
      return;
    }
    setStepError(null);
    const ok = await save();
    if (ok) goTo(Math.min(currentScreen + 1, TOTAL_SCREENS - 1));
  }

  async function handlePrevious() {
    setStepError(null);
    await save();
    goTo(Math.max(currentScreen - 1, 0));
  }

  function handleOpenConfirmSubmit() {
    for (let screen = 0; screen <= SUBMIT_SCREEN; screen++) {
      const validationError = screenValidationError(screen, form);
      if (validationError) {
        goTo(screen);
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
      // Submission moves DRAFT → AWAITING_PAYMENT — continue to payment in
      // place, since paying (which activates the member) is all that's left.
      onSuccess: () => goTo(PAYMENT_SCREEN),
    });
    setConfirmSubmitOpen(false);
  }

  if (isLoading || !loaded) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading member…</p>;
  }

  const stepProps = { form, setForm, memberId: id };
  const screen = SCREENS[currentScreen];
  const isSubmitScreen = currentScreen === SUBMIT_SCREEN;
  const isPaymentScreen = currentScreen === PAYMENT_SCREEN;
  const isSaving = updateMember.isPending;
  const hasPhoto = documents.some((d) => d.type === "PHOTO");
  const hasIdProof = documents.some((d) => ID_PROOF_DOCUMENT_TYPES.includes(d.type));
  const missingDocsReason = !hasPhoto
    ? "Upload a passport photo (step 2, Address & documents) before submitting"
    : !hasIdProof
      ? "Upload an ID proof document (step 2, Address & documents) before submitting"
      : null;
  const canSubmit = member?.status === "DRAFT" && !missingDocsReason;
  const hasOptionalData = OPTIONAL_SECTION_FIELDS.some((field) => Boolean(form[field]));

  function renderSection(section: number) {
    switch (section) {
      case SECTION.MEMBERSHIP:
        return <StepMembership {...stepProps} />;
      case SECTION.BASIC:
        return <StepBasicInfo {...stepProps} />;
      case SECTION.PERSONAL:
        return <StepPersonal {...stepProps} />;
      case SECTION.ADDRESS:
        return <StepAddress {...stepProps} />;
      case SECTION.EDUCATION:
        return <StepEducation {...stepProps} />;
      case SECTION.DOCUMENTS:
        return <StepDocuments {...stepProps} />;
      case SECTION.NOMINEE:
        return <StepNominee {...stepProps} />;
      case SECTION.DECLARATION:
        return <StepDeclaration {...stepProps} />;
      case SECTION.REVIEW:
        return <StepReview form={form} member={member ?? null} memberId={id!} />;
      case SECTION.PAYMENT:
        return <StepPayment {...stepProps} />;
      default:
        return null;
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">{member?.fullName || "New Member"}</h1>
        <p className="text-sm text-muted-foreground">
          {member?.registrationNumber ? `${member.registrationNumber} · ` : ""}
          Step {currentScreen + 1} of {TOTAL_SCREENS} — {screen.title}
        </p>
        <Progress value={((currentScreen + 1) / TOTAL_SCREENS) * 100} className="mt-3" />
        <p className="mt-2 text-sm text-muted-foreground">{screen.hint}</p>
      </div>

      {stepError && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {stepError}
        </p>
      )}

      {screen.sections.map((section) => (
        <section key={section} className="rounded-xl border border-border bg-card p-4 sm:p-6">
          {screen.sections.length > 1 && (
            <h2 className="mb-4 font-heading text-base font-semibold">{WIZARD_STEP_TITLES[section]}</h2>
          )}
          {renderSection(section)}
        </section>
      ))}

      {screen.optionalSections && (
        <details className="group rounded-xl border border-dashed border-border bg-card" open={hasOptionalData}>
          <summary className="cursor-pointer list-none p-4 font-heading text-base font-semibold sm:px-6">
            <span className="group-open:hidden">▸ </span>
            <span className="hidden group-open:inline">▾ </span>
            More details (optional)
            <span className="mt-1 block text-sm font-normal text-muted-foreground">
              Family, education, work, nominee and emergency contact. You can skip this and add it later.
            </span>
          </summary>
          <div className="space-y-6 px-4 pb-4 sm:px-6 sm:pb-6">
            {screen.optionalSections.map((section) => (
              <div key={section}>
                <h2 className="mb-4 font-heading text-sm font-semibold">{WIZARD_STEP_TITLES[section]}</h2>
                {renderSection(section)}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Wraps on narrow phones so the main button never runs off-screen. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" disabled={currentScreen === 0 || isSaving} onClick={handlePrevious}>
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          {!isPaymentScreen && (
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => void save()}>
              {isSaving ? "Saving…" : "Save Draft"}
            </Button>
          )}
          {isSubmitScreen ? (
            <Button
              type="button"
              className="bg-brand-green hover:bg-brand-green/90"
              disabled={isSaving || submitMember.isPending || !canSubmit}
              title={
                member?.status !== "DRAFT"
                  ? "This registration has already been submitted"
                  : (missingDocsReason ?? undefined)
              }
              onClick={handleOpenConfirmSubmit}
            >
              Submit Application
            </Button>
          ) : isPaymentScreen ? (
            member?.status === "ACTIVE" && (
              <Button
                type="button"
                className="bg-brand-green hover:bg-brand-green/90"
                onClick={() => navigate(`/admin/members/${id}/profile`)}
              >
                View Member Profile
              </Button>
            )
          ) : (
            <Button type="button" className="bg-brand-green hover:bg-brand-green/90" disabled={isSaving} onClick={handleNext}>
              {isSaving ? "Saving…" : "Save & Continue"}
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
      {isSubmitScreen && missingDocsReason && member?.status === "DRAFT" && (
        <p className="text-right text-sm text-muted-foreground">{missingDocsReason}.</p>
      )}

      <ConfirmDialog
        open={confirmSubmitOpen}
        onOpenChange={setConfirmSubmitOpen}
        title="Submit this application?"
        description="Next you'll collect the membership fee — the membership starts as soon as it is paid."
        confirmLabel="Submit"
        destructive={false}
        isPending={submitMember.isPending}
        onConfirm={handleSubmit}
      />
    </div>
  );
}
