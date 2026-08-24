import { useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";
import { useCreateDonationGatewayOrder, useDonationGatewayStatus, useVerifyDonationGatewayPayment } from "@/hooks/useDonations";

interface PayDonationOnlineButtonProps {
  memberId: string;
  amount: number;
  donorAddress?: string;
  donorPan?: string;
  disabled?: boolean;
  className?: string;
  onError?: (message: string) => void;
  onSuccess?: () => void;
}

// Field Executive/Admin variant of PayOnlineButton — same embedded Razorpay
// checkout, but for a donor physically present with staff (donor still
// enters their own card/UPI details). Renders nothing when the org hasn't
// enabled the payment gateway, same as PayOnlineButton.
export function PayDonationOnlineButton({
  memberId,
  amount,
  donorAddress,
  donorPan,
  disabled,
  className,
  onError,
  onSuccess,
}: PayDonationOnlineButtonProps) {
  const { data: gatewayStatus } = useDonationGatewayStatus();
  const createOrder = useCreateDonationGatewayOrder(memberId);
  const verifyPayment = useVerifyDonationGatewayPayment(memberId);
  const [processing, setProcessing] = useState(false);

  if (!gatewayStatus?.enabled) return null;

  async function handlePayOnline() {
    setProcessing(true);
    try {
      const order = await createOrder.mutateAsync({ amount, donorAddress: donorAddress || null, donorPan: donorPan || null });
      await openRazorpayCheckout({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: order.currency,
        name: order.name,
        description: order.description,
        theme: { color: "#2e7d32" },
        modal: { ondismiss: () => setProcessing(false) },
        handler: (response) => {
          verifyPayment
            .mutateAsync({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            })
            .then(() => onSuccess?.())
            .catch((err) => {
              onError?.(
                err instanceof ApiError
                  ? err.message
                  : "Payment verification failed. Contact support if the amount was debited.",
              );
            })
            .finally(() => setProcessing(false));
        },
      });
    } catch (err) {
      onError?.(err instanceof ApiError ? err.message : "Failed to start online donation.");
      setProcessing(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={handlePayOnline}
      disabled={disabled || processing}
      className={className ?? "bg-brand-green hover:bg-brand-green/90"}
    >
      <CreditCard className="size-4" />
      {processing ? "Opening payment…" : "Pay Online (Card/UPI)"}
    </Button>
  );
}
