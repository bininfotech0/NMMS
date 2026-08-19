import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCreatePaymentLink, useGatewayStatus } from "@/hooks/usePaymentGateway";

interface SharePaymentLinkButtonProps {
  memberId: string;
  memberName?: string;
  className?: string;
}

// Creates a Razorpay-hosted payment link for the member's due amount and
// hands it off via the device's native share sheet (falls back to clipboard
// on desktop) — for collecting payment remotely instead of completing
// checkout in-app right now (see PayOnlineButton for that flow).
export function SharePaymentLinkButton({ memberId, memberName, className }: SharePaymentLinkButtonProps) {
  const { data: gatewayStatus } = useGatewayStatus();
  const createPaymentLink = useCreatePaymentLink();
  const [sharing, setSharing] = useState(false);

  if (!gatewayStatus?.enabled) return null;

  async function handleShare() {
    setSharing(true);
    try {
      const { shortUrl } = await createPaymentLink.mutateAsync(memberId);
      const text = `Payment link for ${memberName ?? "your membership fee"}: ${shortUrl}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: "Membership Fee Payment", text, url: shortUrl });
        } catch {
          // User cancelled the share sheet — not an error.
        }
      } else {
        await navigator.clipboard.writeText(shortUrl);
        toast.success("Payment link copied to clipboard");
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleShare}
      disabled={sharing}
      className={className}
    >
      <Share2 className="size-4" />
      {sharing ? "Creating link…" : "Share for Pay"}
    </Button>
  );
}
