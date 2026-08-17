import { useLookups } from "@/hooks/useLookups";
import { useMemberDocuments } from "@/hooks/useDocuments";
import { useMembers } from "@/hooks/useMembers";
import { usePlans } from "@/hooks/usePlans";
import type { MemberResponse } from "@nmms/shared";
import { ID_PROOF_DOCUMENT_TYPES, type WizardFormState } from "../wizard-types";

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="mb-2 font-heading text-sm font-semibold">{title}</h3>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

export function StepReview({
  form,
  member,
  memberId,
}: {
  form: WizardFormState;
  member: MemberResponse | null;
  memberId: string;
}) {
  const { data: plans = [] } = usePlans();
  const { data: documents = [] } = useMemberDocuments(memberId);
  const hasPhoto = documents.some((d) => d.type === "PHOTO");
  const hasIdProof = documents.some((d) => ID_PROOF_DOCUMENT_TYPES.includes(d.type));
  const { data: membershipCategories = [] } = useLookups("MEMBERSHIP_CATEGORY");
  const { data: branches = [] } = useLookups("BRANCH");
  const { data: religions = [] } = useLookups("RELIGION");
  const { data: casteCategories = [] } = useLookups("CASTE_CATEGORY");
  const { data: educationLevels = [] } = useLookups("EDUCATION");
  const { data: occupations = [] } = useLookups("OCCUPATION");
  const { data: businessTypes = [] } = useLookups("BUSINESS_TYPE");
  const { data: familyTypes = [] } = useLookups("FAMILY_TYPE");
  const { data: members = [] } = useMembers();

  const lookupName = (list: { id: string; value: string }[], id: string) =>
    list.find((l) => l.id === id)?.value ?? "";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Review the application below, then submit. You can still go back and change any step.
      </p>

      <ReviewSection title="Registration Info">
        <ReviewRow label="Registration No." value={member?.registrationNumber ?? ""} />
        <ReviewRow
          label="Registered at"
          value={member?.registeredAt ? new Date(member.registeredAt).toLocaleString() : ""}
        />
        <ReviewRow label="Mode" value={member?.registrationMode ?? ""} />
        <ReviewRow label="Device ID" value={member?.deviceId ?? ""} />
        <ReviewRow
          label="GPS location"
          value={
            member?.registrationLatitude != null && member?.registrationLongitude != null
              ? `${member.registrationLatitude.toFixed(5)}, ${member.registrationLongitude.toFixed(5)}`
              : ""
          }
        />
      </ReviewSection>

      <ReviewSection title="Membership">
        <ReviewRow label="Plan" value={plans.find((p) => p.id === form.planId)?.name ?? ""} />
        <ReviewRow label="Category" value={lookupName(membershipCategories, form.membershipCategoryId)} />
        <ReviewRow label="Branch" value={lookupName(branches, form.branchId)} />
        <ReviewRow label="Joining date" value={form.joiningDate} />
        <ReviewRow
          label="Referred by"
          value={members.find((m) => m.id === form.referralMemberId)?.fullName ?? ""}
        />
        <ReviewRow label="Fee override" value={form.feeOverride} />
        <ReviewRow label="Payment frequency" value={form.paymentFrequency} />
        <ReviewRow label="Unit" value={form.unit} />
        <ReviewRow label="Remarks" value={form.membershipRemarks} />
      </ReviewSection>

      <ReviewSection title="Basic Information">
        <ReviewRow label="Full name" value={form.fullName} />
        <ReviewRow label="Gender" value={form.gender} />
        <ReviewRow label="Date of birth" value={form.dob} />
        <ReviewRow label="Marital status" value={form.maritalStatus} />
        <ReviewRow label="Blood group" value={form.bloodGroup} />
        <ReviewRow label="Nationality" value={form.nationality} />
        <ReviewRow label="Religion" value={lookupName(religions, form.religionId)} />
        <ReviewRow label="Caste category" value={lookupName(casteCategories, form.casteCategoryId)} />
      </ReviewSection>

      <ReviewSection title="Personal Information">
        <ReviewRow label="Father's name" value={form.fatherName} />
        <ReviewRow label="Mother's name" value={form.motherName} />
        <ReviewRow label="Spouse / guardian name" value={form.spouseOrGuardianName} />
        <ReviewRow label="Family type" value={lookupName(familyTypes, form.familyTypeId)} />
        <ReviewRow label="Monthly income" value={form.monthlyIncome} />
        <ReviewRow label="Family members" value={form.familyMembersCount} />
        <ReviewRow label="Children" value={form.childrenCount} />
        <ReviewRow
          label="Flags"
          value={
            [
              form.isDifferentlyAbled && "Differently abled",
              form.isExServiceman && "Ex-serviceman",
              form.isSeniorCitizen && "Senior citizen",
            ]
              .filter(Boolean)
              .join(", ") || ""
          }
        />
      </ReviewSection>

      <ReviewSection title="Contact & Address">
        <ReviewRow label="Mobile" value={form.mobile} />
        <ReviewRow label="WhatsApp" value={form.whatsappNumber} />
        <ReviewRow label="Email" value={form.email} />
        <ReviewRow
          label="Current address"
          value={[form.addressLine, form.landmark, form.pincode].filter(Boolean).join(", ")}
        />
        <ReviewRow label="Same as permanent" value={form.sameAsCurrentAddress ? "Yes" : "No"} />
        {!form.sameAsCurrentAddress && (
          <ReviewRow
            label="Permanent address"
            value={[form.permAddressLine, form.permLandmark, form.permPincode].filter(Boolean).join(", ")}
          />
        )}
      </ReviewSection>

      <ReviewSection title="Education & Occupation">
        <ReviewRow label="Education" value={lookupName(educationLevels, form.educationId)} />
        <ReviewRow label="Qualification detail" value={form.qualificationDetail} />
        <ReviewRow label="Occupation" value={lookupName(occupations, form.occupationId)} />
        <ReviewRow label="Business type" value={lookupName(businessTypes, form.businessTypeId)} />
        <ReviewRow label="Languages known" value={form.languagesKnown} />
        <ReviewRow label="Skills" value={form.skills} />
      </ReviewSection>

      <ReviewSection title="Identity & Documents">
        <ReviewRow label="Aadhaar (on file)" value={member?.aadhaarLast4 ? `•••• ${member.aadhaarLast4}` : ""} />
        <ReviewRow label="PAN" value={form.pan} />
        <ReviewRow label="Voter ID" value={form.voterId} />
        <ReviewRow label="Passport number" value={form.passportNumber} />
        <ReviewRow label="Driving licence" value={form.drivingLicenceNumber} />
        <ReviewRow label="Passport photo uploaded" value={hasPhoto ? "Yes" : "No — required before submitting"} />
        <ReviewRow label="ID proof document uploaded" value={hasIdProof ? "Yes" : "No — required before submitting"} />
      </ReviewSection>

      <ReviewSection title="Additional Information">
        <ReviewRow label="Social media links" value={form.socialMediaLinks} />
      </ReviewSection>

      <ReviewSection title="Nominee & Emergency Contact">
        <ReviewRow
          label="Emergency contact"
          value={[form.emergencyContactName, form.emergencyContactMobile].filter(Boolean).join(", ")}
        />
        <ReviewRow label="Nominee" value={[form.nomineeName, form.nomineeRelationship].filter(Boolean).join(", ")} />
      </ReviewSection>

      <ReviewSection title="Declaration">
        <ReviewRow
          label="All declarations accepted"
          value={
            form.declarationInfoCorrect &&
            form.declarationAcceptConstitution &&
            form.declarationAcceptPrivacyPolicy &&
            form.declarationAcceptTerms
              ? "Yes"
              : "No — required before submitting"
          }
        />
        <ReviewRow label="Place / Date" value={[form.declarationPlace, form.declarationDate].filter(Boolean).join(" / ")} />
      </ReviewSection>
    </div>
  );
}
