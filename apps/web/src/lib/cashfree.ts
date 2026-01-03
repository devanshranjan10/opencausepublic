// Cashfree integration for frontend
export interface CashfreeOrderResponse {
  orderId: string;
  orderAmount: number;
  orderCurrency: string;
  paymentSessionId: string;
  paymentUrl: string;
}

export interface CashfreePaymentResponse {
  orderId: string;
  paymentId: string;
  signature: string;
}

/**
 * Redirect to Cashfree payment page
 */
export function redirectToCashfree(paymentUrl: string): void {
  window.location.href = paymentUrl;
}

/**
 * Verify payment callback from Cashfree
 * Cashfree redirects to return_url with payment details
 */
export function getCashfreePaymentFromUrl(): CashfreePaymentResponse | null {
  if (typeof window === "undefined") return null;

  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get("order_id");
  const paymentId = urlParams.get("payment_id");
  const signature = urlParams.get("signature");

  if (orderId && paymentId && signature) {
    return {
      orderId,
      paymentId,
      signature,
    };
  }

  return null;
}

