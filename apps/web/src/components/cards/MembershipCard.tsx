import { QRCodeSVG } from "qrcode.react";
import { User } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import type { OrgProfile } from "@nmms/shared";

const CARD_CLASS = "w-[340px] h-[214px] rounded-2xl shadow-md overflow-hidden";

export interface CardDisplayData {
  fullName: string;
  planName: string;
  membershipNumber: string;
  mobile: string;
  joiningDate: string;
  validUntil: string;
  volunteerBatch: string | null;
}

export function MembershipCardFront({
  data,
  qrValue,
  photoUrl,
}: {
  data: CardDisplayData;
  qrValue: string;
  photoUrl: string | null;
}) {
  return (
    <div className={`${CARD_CLASS} relative flex flex-col bg-white`}>
      <div className="flex items-center gap-2 bg-brand-green px-4 py-2.5 text-white">
        <Logo variant="icon" size={24} />
        <div className="leading-tight">
          <div className="font-heading text-xs font-bold">VEDVRIKSHA</div>
          <div className="text-[10px] opacity-90">वेदवृक्ष</div>
        </div>
      </div>

      <div className="flex flex-1 gap-3 px-4 py-3">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-bg-soft text-brand-green">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="size-full object-cover" />
          ) : (
            <User className="size-8" />
          )}
        </div>
        <div className="min-w-0 flex-1 text-xs">
          <p className="truncate font-heading text-sm font-bold text-brand-green-dark">{data.fullName}</p>
          <p className="text-brand-gold">{data.planName}</p>
          <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>Member ID</span>
            <span className="font-medium text-foreground">{data.membershipNumber}</span>
            <span>Mobile</span>
            <span className="font-medium text-foreground">{data.mobile}</span>
            <span>Join Date</span>
            <span className="font-medium text-foreground">{data.joiningDate}</span>
            <span>Valid Till</span>
            <span className="font-medium text-foreground">{data.validUntil}</span>
            {data.volunteerBatch && (
              <>
                <span>Volunteer Batch</span>
                <span className="font-medium text-foreground">{data.volunteerBatch}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center justify-center">
          <QRCodeSVG value={qrValue} size={48} />
        </div>
      </div>
    </div>
  );
}

export function MembershipCardBack({ org }: { org: Pick<OrgProfile, "name" | "address" | "contactPhone" | "contactEmail"> }) {
  return (
    <div className={`${CARD_CLASS} relative flex flex-col justify-between bg-brand-bg-soft px-4 py-3`}>
      <div className="text-[11px] leading-relaxed text-brand-green-dark">
        <p className="font-heading font-bold">If found, please return to:</p>
        <p className="mt-1 font-semibold">{org.name}</p>
        {org.address && <p>{org.address}</p>}
        {org.contactPhone && <p>{org.contactPhone}</p>}
        {org.contactEmail && <p>{org.contactEmail}</p>}
      </div>
    </div>
  );
}
