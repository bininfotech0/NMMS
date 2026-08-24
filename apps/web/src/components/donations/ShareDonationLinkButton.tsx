import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCreateDonationPaymentLink, useDonationGatewayStatus } from "@/hooks/useDonations";

interface ShareDonationLinkButtonProps {
  memberId: string;
  amount: number;
  donorAddress?: string;
  donorPan?: string;
  disabled?: boolean;
  className?: string;
}

// Donation analogue of SharePaymentLinkButton — a Razorpay-hosted link handed
// off via the device's native share sheet (falls back to clipboard), for a
// donor who'd rather complete payment on their own device/time instead of
// PayDonationOnlineButton's in-app checkout right now.
export function ShareDonationLinkButton({
  memberId,
  amount,
  donorAddress,
  donorPan,
  disabled,
  className,
}: ShareDonationLinkButtonProps) {
  const { data: gatewayStatus } = useDonationGatewayStatus();
  const createPaymentLink = useCreateDonationPaymentLink(memberId);
  const [sharing, setSharing] = useState(false);

  if (!gatewayStatus?.enabled) return null;

  async function handleShare() {
    setSharing(true);
    try {
      const { shortUrl } = await createPaymentLink.mutateAsync({
        amount,
        donorAddress: donorAddress || null,
        donorPan: donorPan || null,
      });
      const text = `Donation link: ${shortUrl}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: "Donation", text, url: shortUrl });
        } catch {
          // User cancelled the share sheet — not an error.
        }
      } else {
        await navigator.clipboard.writeText(shortUrl);
        toast.success("Donation link copied to clipboard");
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleShare} disabled={disabled || sharing} className={className}>
      <Share2 className="size-4" />
      {sharing ? "Creating link…" : "Share for Pay"}
    </Button>
  );
}
