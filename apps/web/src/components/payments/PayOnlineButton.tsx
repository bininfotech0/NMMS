import { useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";
import { useCreateGatewayOrder, useGatewayStatus, useVerifyGatewayPayment } from "@/hooks/usePaymentGateway";

interface PayOnlineButtonProps {
  memberId: string;
  className?: string;
  onError?: (message: string) => void;
  onSuccess?: () => void;
}

// Renders nothing when the org hasn't enabled/configured the payment gateway
// — callers don't need their own useGatewayStatus() check.
export function PayOnlineButton({ memberId, className, onError, onSuccess }: PayOnlineButtonProps) {
  const { data: gatewayStatus } = useGatewayStatus();
  const createOrder = useCreateGatewayOrder();
  const verifyPayment = useVerifyGatewayPayment();
  const [processing, setProcessing] = useState(false);

  if (!gatewayStatus?.enabled) return null;

  async function handlePayOnline() {
    setProcessing(true);
    try {
      const order = await createOrder.mutateAsync(memberId);
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
              memberId,
              dto: {
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              },
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
      onError?.(err instanceof ApiError ? err.message : "Failed to start online payment.");
      setProcessing(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={handlePayOnline}
      disabled={processing}
      className={className ?? "bg-brand-green hover:bg-brand-green/90"}
    >
      <CreditCard className="size-4" />
      {processing ? "Opening payment…" : "Pay Online (Card/UPI)"}
    </Button>
  );
}
