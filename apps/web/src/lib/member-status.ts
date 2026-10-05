// Plain-language wording for member statuses, for anything a member reads.
// The raw enum values (AWAITING_PAYMENT, SUBMITTED, ...) are code names and
// must never be shown to members directly.

export interface MemberStatusInfo {
  /** Short label, e.g. for the portal header. */
  label: string;
  /** One sentence telling the member what this means and what to do. */
  guidance: string;
}

const STATUS_INFO: Record<string, MemberStatusInfo> = {
  DRAFT: {
    label: "Registration not finished",
    guidance: "Finish the steps on your Home page to become a member.",
  },
  AWAITING_PAYMENT: {
    label: "Waiting for your payment",
    guidance: "Pay your membership fee on your Home page to become a member.",
  },
  // Legacy statuses from the old staff-review flow — members on these are
  // waiting for staff, there is nothing for them to do.
  PAYMENT_COLLECTED: {
    label: "Being checked by our team",
    guidance: "Our team is checking your registration. You don't need to do anything right now.",
  },
  SUBMITTED: {
    label: "Being checked by our team",
    guidance: "Our team is checking your registration. You don't need to do anything right now.",
  },
  VERIFIED: {
    label: "Being checked by our team",
    guidance: "Our team is checking your registration. You don't need to do anything right now.",
  },
  APPROVED: {
    label: "Approved",
    guidance: "Your membership is approved and will be active shortly.",
  },
  ACTIVE: {
    label: "Active member",
    guidance: "Your membership is active.",
  },
  RENEWED: {
    label: "Active member",
    guidance: "Your membership has been renewed and is active.",
  },
  EXPIRED: {
    label: "Membership expired",
    guidance: "Your membership has ended. Renew it to become an active member again.",
  },
  SUSPENDED: {
    label: "Membership on hold",
    guidance: "Your membership is on hold. Please contact us to find out why.",
  },
  REJECTED: {
    label: "Registration not accepted",
    guidance: "Your registration was not accepted. Please contact us for help.",
  },
  DECEASED: {
    label: "Closed",
    guidance: "This membership is closed.",
  },
};

export function memberStatusInfo(status: string | null | undefined): MemberStatusInfo {
  return (
    (status ? STATUS_INFO[status] : undefined) ?? {
      label: "Status unavailable",
      guidance: "Please contact us if you need help with your membership.",
    }
  );
}

/** RENEWED is just an active membership from the member's point of view. */
export function isMemberActive(status: string | null | undefined): boolean {
  return status === "ACTIVE" || status === "RENEWED";
}
