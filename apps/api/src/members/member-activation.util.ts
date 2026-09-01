import type { MemberStatus, Prisma } from "@prisma/client";
import { NumberingService } from "../common/numbering.service";
import { addMonths } from "../common/date.util";

export interface ActivationPlanInfo {
  validityType: string;
  validityMonths: number | null;
}

export interface ActivationResult {
  membershipNumber: string;
  validUntil: Date | null;
}

// Shared by PaymentsService.finalizePayment's AWAITING_PAYMENT branch (the
// automatic, payment-triggered path that every new registration goes through
// since the form-first/payment-last redesign) and ApplicationsService.approve()
// (kept only as a manual-override activation path for legacy SUBMITTED rows).
// Must be called from inside the caller's own already-open interactive
// transaction, immediately after the caller has decided which status to CAS
// from — the caller is still responsible for its own referral/notification
// side effects afterward.
//
// Two-step write (a status-only CAS via updateMany, then a plain update-by-id
// for the allocated membershipNumber/validUntil) rather than one combined
// updateMany — a CAS loss during the payment-callback race this now
// legitimately faces (webhook vs. verify-callback) must never burn a
// membership number, mirroring how finalizePayment already defers
// nextReceiptNumber() until after its own CAS succeeds.
export async function activateMemberOnce(
  tx: Prisma.TransactionClient,
  numbering: NumberingService,
  member: { id: string; organizationId: string; joiningDate: Date | null },
  plan: ActivationPlanInfo | null,
  fromStatus: MemberStatus,
  actorId: string,
): Promise<ActivationResult | null> {
  const cas = await tx.member.updateMany({
    where: { id: member.id, status: fromStatus },
    data: { status: "ACTIVE" },
  });
  if (cas.count === 0) {
    return null; // already activated (or status changed) — safe no-op for the caller
  }

  const activatedAt = new Date();
  const joiningDate = member.joiningDate ?? activatedAt;
  const validUntil =
    plan?.validityType === "MONTHS" && plan.validityMonths ? addMonths(joiningDate, plan.validityMonths) : null;
  const membershipNumber = await numbering.nextMembershipNumber(member.organizationId);

  await tx.member.update({
    where: { id: member.id },
    data: { membershipNumber, validUntil, joiningDate, approvedById: actorId, approvedAt: activatedAt },
  });
  await tx.statusHistory.create({
    data: { memberId: member.id, fromStatus, toStatus: "ACTIVE", actorId },
  });

  return { membershipNumber, validUntil };
}
