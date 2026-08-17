import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { useMember, useUpdateMember } from "@/hooks/useMembers";
import { emptyWizardForm, memberToWizardForm, wizardFormToUpdateDto, type WizardFormState } from "./wizard-types";
import { StepBasicInfo } from "./steps/StepBasicInfo";
import { StepPersonal } from "./steps/StepPersonal";
import { StepAddress } from "./steps/StepAddress";
import { StepEducation } from "./steps/StepEducation";
import { StepDocuments } from "./steps/StepDocuments";
import { StepNominee } from "./steps/StepNominee";

// Full-detail correction page for ACTIVE/SUSPENDED/EXPIRED/RENEWED members —
// reuses the same wizard step components and form<->DTO mapping as the
// pre-activation onboarding wizard, since every field an admin might need to
// correct after activation (personal info, address, education, documents,
// nominee) already has a built, tested UI there. Deliberately omits the
// Membership step (plan/fee are locked once not DRAFT — see
// MembersService.update) and the Declaration/Review/Submit steps (not
// applicable to an already-approved member).
const SECTIONS = [
  { key: "basic", title: "Basic Information", Component: StepBasicInfo },
  { key: "personal", title: "Personal Information", Component: StepPersonal },
  { key: "address", title: "Contact & Address", Component: StepAddress },
  { key: "education", title: "Education & Occupation", Component: StepEducation },
  { key: "documents", title: "Identity & Documents", Component: StepDocuments },
  { key: "nominee", title: "Nominee & Emergency Contact", Component: StepNominee },
] as const;

export function MemberEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: member, isLoading } = useMember(id ?? null);
  const updateMember = useUpdateMember();

  const [form, setForm] = useState<WizardFormState>(emptyWizardForm());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (member && !loaded) {
      setForm(memberToWizardForm(member));
      setLoaded(true);
    }
  }, [member, loaded]);

  if (!id) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await updateMember.mutateAsync({ id: id!, dto: wizardFormToUpdateDto(form) });
      navigate(`/admin/members/${id}/profile`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (isLoading || !loaded || !member) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading member...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          to={`/admin/members/${id}/profile`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to profile
        </Link>
        <h1 className="mt-2 font-heading text-2xl font-bold">Edit {member.fullName}</h1>
        <p className="text-sm text-muted-foreground">
          Correct any details below. Membership plan and fee can't be changed here — see the profile page for
          upgrade options.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {SECTIONS.map(({ key, title, Component }) => (
          <div key={key} className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 font-heading text-base font-semibold">{title}</h2>
            <Component form={form} setForm={setForm} memberId={id} />
          </div>
        ))}

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(`/admin/members/${id}/profile`)}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateMember.isPending} className="bg-brand-green hover:bg-brand-green/90">
            {updateMember.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
