import { Injectable, BadRequestException, InternalServerErrorException } from "@nestjs/common";
import * as crypto from "crypto";

@Injectable()
export class CashfreeService {
  private appId: string;
  private secretKey: string;
  private webhookSecret: string;
  private baseUrl: string;

  constructor() {
    this.appId = process.env.CASHFREE_APP_ID || "";
    this.secretKey = process.env.CASHFREE_SECRET_KEY || "";
    this.webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET || "";
    
    // Use sandbox for testing, production for live
    const isProduction = process.env.CASHFREE_ENV === "production";
    this.baseUrl = isProduction 
      ? "https://api.cashfree.com/pg" 
      : "https://sandbox.cashfree.com/pg";

    if (!this.appId || !this.secretKey) {
      console.warn("Cashfree credentials not configured. Payment features will be disabled.");
    }
  }

  /**
   * Get authorization header for Cashfree API
   */
  private getAuthHeaders() {
    return {
      "x-client-id": this.appId,
      "x-client-secret": this.secretKey,
      "x-api-version": "2023-08-01",
      "Content-Type": "application/json",
    };
  }

  /**
   * Create a payment order for INR donation
   */
  async createOrder(params: {
    amount: number; // Amount in rupees
    currency?: string;
    orderId?: string;
    customerDetails?: {
      customerId?: string;
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
    };
    orderMeta?: {
      returnUrl?: string;
      notifyUrl?: string;
    };
    orderNote?: string;
  }) {
    if (!this.appId || !this.secretKey) {
      throw new InternalServerErrorException("Cashfree not configured");
    }

    try {
      const orderId = params.orderId || `order_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const orderData = {
        order_id: orderId,
        order_amount: params.amount,
        order_currency: params.currency || "INR",
        customer_details: {
          customer_id: params.customerDetails?.customerId || `customer_${Date.now()}`,
          customer_name: params.customerDetails?.customerName || "Guest",
          customer_email: params.customerDetails?.customerEmail || "",
          customer_phone: params.customerDetails?.customerPhone || "9999999999", // Required by Cashfree
        },
        order_meta: {
          // Cashfree requires HTTPS URLs (even in sandbox mode)
          // For local development, use ngrok or set FRONTEND_URL/API_URL to HTTPS URLs
          return_url: (() => {
            const defaultUrl = params.orderMeta?.returnUrl || `${process.env.FRONTEND_URL || "https://localhost:3000"}/payment/callback`;
            // Ensure HTTPS - Cashfree doesn't accept HTTP
            if (defaultUrl.startsWith("http://")) {
              // Replace http:// with https:// (requires SSL setup or ngrok for localhost)
              return defaultUrl.replace("http://", "https://");
            }
            return defaultUrl;
          })(),
          notify_url: (() => {
            const defaultUrl = params.orderMeta?.notifyUrl || `${process.env.API_URL || "https://localhost:4000"}/payments/cashfree/webhook`;
            // Ensure HTTPS - Cashfree doesn't accept HTTP
            if (defaultUrl.startsWith("http://")) {
              // Replace http:// with https:// (requires SSL setup or ngrok for localhost)
              return defaultUrl.replace("http://", "https://");
            }
            return defaultUrl;
          })(),
        },
        order_note: params.orderNote || "",
      };

      const response = await fetch(`${this.baseUrl}/orders`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(errorData.message || "Failed to create order");
      }

      const order = await response.json() as any;
      return {
        id: order.order_id,
        orderId: order.order_id,
        orderAmount: order.order_amount,
        orderCurrency: order.order_currency,
        paymentSessionId: order.payment_session_id,
        paymentUrl: order.payment_link,
      };
    } catch (error: any) {
      console.error("Cashfree order creation error:", error);
      throw new BadRequestException(
        error.message || "Failed to create payment order"
      );
    }
  }

  /**
   * Verify payment signature
   */
  verifyPaymentSignature(params: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    if (!this.secretKey) {
      return false;
    }

    try {
      const message = `${params.orderId}${params.paymentId}`;
      const generatedSignature = crypto
        .createHmac("sha256", this.secretKey)
        .update(message)
        .digest("hex");

      return generatedSignature === params.signature;
    } catch (error) {
      console.error("Payment signature verification error:", error);
      return false;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(webhookBody: string, signature: string): boolean {
    if (!this.webhookSecret) {
      console.warn("Webhook secret not configured");
      return false;
    }

    try {
      const generatedSignature = crypto
        .createHmac("sha256", this.webhookSecret)
        .update(webhookBody)
        .digest("hex");

      return generatedSignature === signature;
    } catch (error) {
      console.error("Webhook signature verification error:", error);
      return false;
    }
  }

  /**
   * Fetch payment details
   */
  async getPayment(orderId: string) {
    if (!this.appId || !this.secretKey) {
      throw new InternalServerErrorException("Cashfree not configured");
    }

    try {
      const response = await fetch(`${this.baseUrl}/orders/${orderId}`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(errorData.message || "Failed to fetch payment");
      }

      const order = await response.json();
      return order;
    } catch (error: any) {
      console.error("Cashfree fetch payment error:", error);
      throw new BadRequestException(
        error.message || "Failed to fetch payment"
      );
    }
  }

  /**
   * Create a payout/transfer to vendor/payee
   */
  async createPayout(params: {
    accountNumber: string;
    ifsc: string;
    amount: number; // Amount in rupees
    currency?: string;
    accountHolderName: string;
    transferMode?: "NEFT" | "IMPS" | "RTGS";
    transferId?: string;
    remarks?: string;
  }) {
    if (!this.appId || !this.secretKey) {
      throw new InternalServerErrorException("Cashfree not configured");
    }

    try {
      const transferId = params.transferId || `transfer_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const payoutData = {
        transferId: transferId,
        transferAmount: params.amount,
        transferCurrency: params.currency || "INR",
        transferMode: params.transferMode || "NEFT",
        beneDetails: {
          beneId: `bene_${Date.now()}`,
          name: params.accountHolderName,
          email: `payout_${Date.now()}@opencause.in`,
          phone: "9999999999",
          bankAccount: params.accountNumber,
          ifsc: params.ifsc,
        },
        transferRemarks: params.remarks || "Withdrawal payout",
      };

      const response = await fetch(`${this.baseUrl}/transfers`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payoutData),
      });

      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(errorData.message || "Failed to create payout");
      }

      const payout = await response.json() as any;
      return {
        id: payout.transferId,
        transferId: payout.transferId,
        amount: payout.transferAmount,
        currency: payout.transferCurrency,
        status: payout.transferStatus || "PENDING",
        mode: payout.transferMode,
        remarks: payout.transferRemarks,
        createdAt: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error("Cashfree payout creation error:", error);
      throw new BadRequestException(
        error.message || "Failed to create payout"
      );
    }
  }

  /**
   * Refund a payment
   */
  async createRefund(params: {
    orderId: string;
    refundAmount?: number; // Partial refund if specified
    refundNote?: string;
    refundId?: string;
  }) {
    if (!this.appId || !this.secretKey) {
      throw new InternalServerErrorException("Cashfree not configured");
    }

    try {
      const refundId = params.refundId || `refund_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const refundData: any = {
        refund_id: refundId,
        refund_amount: params.refundAmount || undefined,
        refund_note: params.refundNote || "Refund",
      };

      // Remove undefined fields
      Object.keys(refundData).forEach(key => {
        if (refundData[key] === undefined) {
          delete refundData[key];
        }
      });

      const response = await fetch(`${this.baseUrl}/orders/${params.orderId}/refunds`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(refundData),
      });

      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(errorData.message || "Failed to create refund");
      }

      const refund = await response.json();
      return refund;
    } catch (error: any) {
      console.error("Cashfree refund creation error:", error);
      throw new BadRequestException(
        error.message || "Failed to create refund"
      );
    }
  }

  /**
   * Get order details
   */
  async getOrder(orderId: string) {
    if (!this.appId || !this.secretKey) {
      throw new InternalServerErrorException("Cashfree not configured");
    }

    try {
      const response = await fetch(`${this.baseUrl}/orders/${orderId}`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(errorData.message || "Failed to fetch order");
      }

      const order = await response.json();
      return order;
    } catch (error: any) {
      console.error("Cashfree fetch order error:", error);
      throw new BadRequestException(
        error.message || "Failed to fetch order"
      );
    }
  }
}

