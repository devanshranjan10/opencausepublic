// Razorpay integration for frontend
declare global {
  interface Window {
    Razorpay: any;
  }
}

export interface RazorpayOptions {
  key: string;
  amount: number; // Amount in paise
  currency?: string;
  name?: string;
  description?: string;
  order_id?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, any>;
  handler: (response: RazorpayResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

export interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export async function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay script"));
    document.body.appendChild(script);
  });
}

export function openRazorpayCheckout(options: RazorpayOptions): void {
  if (!window.Razorpay) {
    throw new Error("Razorpay script not loaded");
  }

  const razorpay = new window.Razorpay({
    key: options.key,
    amount: options.amount,
    currency: options.currency || "INR",
    name: options.name || "OpenCause",
    description: options.description || "Donation",
    order_id: options.order_id,
    prefill: options.prefill || {},
    notes: options.notes || {},
    handler: options.handler,
    modal: {
      ondismiss: options.modal?.ondismiss,
    },
    theme: {
      color: "#6366f1", // Indigo color matching the theme
    },
  });

  razorpay.open();
}










