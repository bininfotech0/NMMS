// Turns a raw audit row (action code + controller-derived entity name) into a
// short sentence staff can read, e.g. "changed a member" or "approved a donation".
// The entity names come from API controller class names (see AuditInterceptor),
// so unknown ones fall back to splitting the CamelCase name into words.

const ACTION_VERBS: Record<string, string> = {
  LOGIN_SUCCESS: "signed in",
  LOGIN_FAILED: "tried to sign in (wrong password)",
  CREATE: "added",
  UPDATE: "changed",
  DELETE: "deleted",
  SUBMIT: "submitted",
  VERIFY: "verified",
  APPROVE: "approved",
  REJECT: "rejected",
  IMPORT: "imported",
  RESET_PASSWORD: "reset the password of",
  MARK_PAID: "marked as paid",
  REVEAL_BANK_ACCOUNT: "viewed the full bank account number of",
};

const ENTITY_NAMES: Record<string, string> = {
  Applications: "a membership",
  Card: "a membership card",
  Documents: "a document",
  Donation: "a donation",
  DonationsAdmin: "a donation",
  MemberDonations: "a donation",
  Events: "an event",
  MemberEvents: "an event registration",
  IdentityAutoFill: "ID details",
  Integrations: "online payment / message settings",
  KycAdmin: "member bank details",
  KycMember: "their bank details",
  Lookups: "a dropdown list value",
  MemberAuth: "their account",
  PublicMemberAuth: "a member account",
  MemberCard: "a membership card",
  MemberDocuments: "a member document",
  MemberDocumentsSelf: "their own document",
  MemberPayments: "a payment",
  MemberPaymentsSelf: "their own payment",
  MemberSelf: "their own profile",
  Members: "a member",
  Notices: "a notice",
  Org: "the NGO settings",
  Payments: "a payment",
  Plans: "a membership plan",
  Referrals: "a referral",
  ReferralsAdmin: "referral settings",
  Users: "a staff account",
  Withdrawals: "a money request",
  WithdrawalsAdmin: "a money request",
};

function splitWords(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

export function describeAuditAction(action: string, entity: string): string {
  const verb = ACTION_VERBS[action] ?? splitWords(action.replace(/_/g, " "));
  if (action === "LOGIN_SUCCESS" || action === "LOGIN_FAILED") return verb;
  const thing = ENTITY_NAMES[entity] ?? splitWords(entity);
  return `${verb} ${thing}`;
}

export function auditActionLabel(action: string): string {
  return ACTION_VERBS[action] ?? splitWords(action.replace(/_/g, " "));
}

export function auditEntityLabel(entity: string): string {
  return ENTITY_NAMES[entity] ?? splitWords(entity);
}
