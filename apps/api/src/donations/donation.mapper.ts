import type { Prisma } from "@prisma/client";
import type { DonationResponse } from "@nmms/shared";

type DonationRow = {
  id: string;
  memberId: string;
  member?: { fullName: string };
  amount: Prisma.Decimal;
  mode: string;
  note: string | null;
  reference: string | null;
  donorAddress: string | null;
  donorPan: string | null;
  status: string;
  receiptNumber: string | null;
  pointsAwarded: number | null;
  recordedById: string | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  createdAt: Date;
};

export function toDonationResponse(row: DonationRow): DonationResponse {
  return {
    id: row.id,
    memberId: row.memberId,
    memberName: row.member?.fullName,
    amount: row.amount.toNumber(),
    mode: row.mode as DonationResponse["mode"],
    note: row.note,
    reference: row.reference,
    donorAddress: row.donorAddress,
    donorPan: row.donorPan,
    status: row.status as DonationResponse["status"],
    receiptNumber: row.receiptNumber,
    pointsAwarded: row.pointsAwarded,
    recordedById: row.recordedById,
    reviewedById: row.reviewedById,
    reviewedAt: row.reviewedAt,
    reviewNote: row.reviewNote,
    gatewayOrderId: row.gatewayOrderId,
    gatewayPaymentId: row.gatewayPaymentId,
    createdAt: row.createdAt,
  };
}
