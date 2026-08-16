import type { WithdrawalRequestResponse } from "@nmms/shared";

type WithdrawalRequestRow = {
  id: string;
  memberId: string;
  member?: { fullName: string };
  pointsRequested: number;
  grossAmount: { toNumber(): number };
  chargeType: string;
  chargeAmount: { toNumber(): number };
  netAmount: { toNumber(): number };
  payoutMethod: string;
  payoutBankAccountName: string | null;
  payoutBankAccountNumberLast4: string | null;
  payoutBankIfscCode: string | null;
  payoutBankName: string | null;
  payoutUpiId: string | null;
  status: string;
  reviewedAt: Date | null;
  reviewNote: string | null;
  payoutInitiatedAt: Date | null;
  payoutGatewayUtr: string | null;
  payoutFailureReason: string | null;
  paidAt: Date | null;
  paymentReference: string | null;
  createdAt: Date;
};

export function toWithdrawalResponse(row: WithdrawalRequestRow): WithdrawalRequestResponse {
  return {
    id: row.id,
    memberId: row.memberId,
    memberName: row.member?.fullName,
    pointsRequested: row.pointsRequested,
    grossAmount: row.grossAmount.toNumber(),
    chargeType: row.chargeType as WithdrawalRequestResponse["chargeType"],
    chargeAmount: row.chargeAmount.toNumber(),
    netAmount: row.netAmount.toNumber(),
    payoutMethod: row.payoutMethod as WithdrawalRequestResponse["payoutMethod"],
    payoutBankAccountName: row.payoutBankAccountName,
    payoutBankAccountNumberLast4: row.payoutBankAccountNumberLast4,
    payoutBankIfscCode: row.payoutBankIfscCode,
    payoutBankName: row.payoutBankName,
    payoutUpiId: row.payoutUpiId,
    status: row.status as WithdrawalRequestResponse["status"],
    reviewedAt: row.reviewedAt,
    reviewNote: row.reviewNote,
    payoutInitiatedAt: row.payoutInitiatedAt,
    payoutGatewayUtr: row.payoutGatewayUtr,
    payoutFailureReason: row.payoutFailureReason,
    paidAt: row.paidAt,
    paymentReference: row.paymentReference,
    createdAt: row.createdAt,
  };
}
