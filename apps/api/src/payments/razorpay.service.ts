import { Injectable, BadRequestException, InternalServerErrorException } from "@nestjs/common";
import Razorpay from "razorpay";
import * as crypto from "crypto";

@Injectable()
export class RazorpayService {
  private razorpay: Razorpay;
  private webhookSecret: string;

  constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_SECRET_KEY;
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";

    if (!keyId || !keySecret) {
      console.warn("Razorpay credentials not configured. Payment features will be disabled.");
      return;
    }

    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  /**
   * Create a payment order for INR donation
   */
  async createOrder(params: {
    amount: number; // Amount in paise (e.g., 10000 = ₹100)
    currency?: string;
    receipt?: string;
    notes?: Record<string, any>;
  }) {
    if (!this.razorpay) {
      throw new InternalServerErrorException("Razorpay not configured");
    }

    try {
      const options = {
        amount: params.amount, // Amount in paise
        currency: params.currency || "INR",
        receipt: params.receipt || `receipt_${Date.now()}`,
        notes: params.notes || {},
      };

      const order = await this.razorpay.orders.create(options);
      return order;
    } catch (error: any) {
      console.error("Razorpay order creation error:", error);
      throw new BadRequestException(
        error.error?.description || "Failed to create payment order"
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
    if (!this.razorpay) {
      return false;
    }

    try {
      const text = `${params.orderId}|${params.paymentId}`;
      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_SECRET_KEY || "")
        .update(text)
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
  async getPayment(paymentId: string) {
    if (!this.razorpay) {
      throw new InternalServerErrorException("Razorpay not configured");
    }

    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      return payment;
    } catch (error: any) {
      console.error("Razorpay fetch payment error:", error);
      throw new BadRequestException(
        error.error?.description || "Failed to fetch payment"
      );
    }
  }

  /**
   * Create a payout/transfer to vendor/payee
   * 
   * NOTE: Standard Razorpay accounts do NOT support direct payouts to bank accounts.
   * This requires RazorpayX (which needs separate activation).
   * 
   * For standard Razorpay accounts:
   * - Money collected goes to your Razorpay account
   * - You need to manually process payouts via Razorpay Dashboard
   * - Or integrate with a payout service like Cashfree Payouts, Paytm, etc.
   * 
   * This method will:
   * 1. Try RazorpayX API if available (checks for RAZORPAY_ACCOUNT_NUMBER)
   * 2. If not available, return payout details for manual processing
   */
  async createPayout(params: {
    accountNumber: string; // Bank account number
    amount: number; // Amount in paise
    currency?: string;
    mode?: "NEFT" | "IMPS" | "RTGS";
    purpose?: string;
    fundAccount?: {
      accountType: "bank_account" | "vpa" | "card";
      bankAccount?: {
        name: string;
        ifsc: string;
        accountNumber: string;
      };
      vpa?: {
        address: string;
      };
    };
    notes?: Record<string, any>;
  }) {
    if (!this.razorpay) {
      throw new InternalServerErrorException("Razorpay not configured");
    }

    // Check if RazorpayX is available (has account number configured)
    const razorpayAccountNumber = process.env.RAZORPAY_ACCOUNT_NUMBER;
    
    if (!razorpayAccountNumber) {
      // Standard Razorpay - return payout details for manual processing
      console.warn(
        "RazorpayX not configured. Payout will need to be processed manually. " +
        "Money collected goes to your Razorpay account. " +
        "To enable automatic payouts, activate RazorpayX and set RAZORPAY_ACCOUNT_NUMBER."
      );
      
      return {
        id: `manual_payout_${Date.now()}`,
        entity: "payout",
        amount: params.amount,
        currency: params.currency || "INR",
        status: "pending_manual_processing",
        mode: params.mode || "NEFT",
        purpose: params.purpose || "payout",
        fund_account: params.fundAccount,
        notes: {
          ...params.notes,
          manual_processing_required: true,
          instructions: "Process this payout manually via Razorpay Dashboard or integrate with a payout service",
        },
        created_at: Math.floor(Date.now() / 1000),
        requires_manual_processing: true,
      };
    }

    // RazorpayX is available - proceed with automatic payout
    try {
      const razorpayXBaseUrl = "https://api.razorpay.com/v1";
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_SECRET_KEY;

      if (!keyId || !keySecret) {
        throw new InternalServerErrorException("Razorpay credentials not configured");
      }

      const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

      // Create contact
      const contactPayload = {
        name: params.fundAccount?.bankAccount?.name || "Payee",
        email: `payout_${Date.now()}@opencause.in`,
        contact: "9999999999",
        type: "vendor",
      };

      let contactId: string;
      try {
        const contactResponse = await fetch(`${razorpayXBaseUrl}/contacts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${auth}`,
          },
          body: JSON.stringify(contactPayload),
        });

        if (!(contactResponse as any).ok) {
          const errorData = (await (contactResponse as any).json()) as any;
          throw new Error(errorData.error?.description || "Failed to create contact");
        }

        const contactData = (await (contactResponse as any).json()) as any;
        contactId = contactData.id;
      } catch (error: any) {
        console.error("Failed to create contact:", error);
        throw new BadRequestException("Failed to create Razorpay contact: " + error.message);
      }

      // Create fund account
      const fundAccountPayload = {
        contact_id: contactId,
        account_type: "bank_account",
        bank_account: {
          name: params.fundAccount?.bankAccount?.name || "Payee",
          ifsc: params.fundAccount?.bankAccount?.ifsc || "",
          account_number: params.accountNumber,
        },
      };

      let fundAccountId: string;
      try {
        const fundAccountResponse = await fetch(`${razorpayXBaseUrl}/fund_accounts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${auth}`,
          },
          body: JSON.stringify(fundAccountPayload),
        });

        if (!(fundAccountResponse as any).ok) {
          const errorData = (await (fundAccountResponse as any).json()) as any;
          // Try to find existing fund account
          if (errorData.error?.code === "BAD_REQUEST_ERROR") {
            const searchResponse = await fetch(
              `${razorpayXBaseUrl}/fund_accounts?contact_id=${contactId}`,
              {
                headers: {
                  Authorization: `Basic ${auth}`,
                },
              }
            );
            if ((searchResponse as any).ok) {
              const searchData = (await (searchResponse as any).json()) as any;
              if (searchData?.items && searchData.items.length > 0) {
                fundAccountId = searchData.items[0].id;
              } else {
                throw new Error(errorData?.error?.description || "Failed to create fund account");
              }
            } else {
              throw new Error(errorData?.error?.description || "Failed to create fund account");
            }
          } else {
            throw new Error(errorData?.error?.description || "Failed to create fund account");
          }
        } else {
          const fundAccountData = (await (fundAccountResponse as any).json()) as any;
          fundAccountId = fundAccountData.id;
        }
      } catch (error: any) {
        console.error("Failed to create fund account:", error);
        throw new BadRequestException("Failed to create Razorpay fund account: " + error.message);
      }

      // Create payout
      const payoutPayload = {
        account_number: razorpayAccountNumber,
        fund_account: {
          id: fundAccountId,
        },
        amount: params.amount,
        currency: params.currency || "INR",
        mode: params.mode || "NEFT",
        purpose: params.purpose || "payout",
        queue_if_low_balance: true,
        reference_id: `payout_${Date.now()}`,
        narration: `Withdrawal payout - ${params.notes?.withdrawalId || ""}`,
        notes: params.notes || {},
      };

      const payoutResponse = await fetch(`${razorpayXBaseUrl}/payouts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(payoutPayload),
      });

      if (!(payoutResponse as any).ok) {
        const errorData = (await (payoutResponse as any).json()) as any;
        throw new Error(errorData.error?.description || "Failed to create payout");
      }

      const payoutData = (await (payoutResponse as any).json()) as any;

      return {
        id: payoutData.id,
        entity: payoutData.entity || "payout",
        amount: payoutData.amount,
        currency: payoutData.currency,
        status: payoutData.status,
        mode: payoutData.mode,
        purpose: payoutData.purpose,
        fund_account: payoutData.fund_account,
        notes: payoutData.notes || {},
        created_at: payoutData.created_at,
        contact_id: contactId,
        fund_account_id: fundAccountId,
        requires_manual_processing: false,
      };
    } catch (error: any) {
      console.error("Razorpay payout creation error:", error);
      throw new BadRequestException(
        error.message || error.error?.description || "Failed to create payout"
      );
    }
  }

  /**
   * Create a transfer (for same Razorpay account transfers)
   * This is simpler than payouts and works with standard Razorpay accounts
   */
  async createTransfer(params: {
    amount: number; // Amount in paise
    currency?: string;
    account: string; // Razorpay account ID or contact ID
    notes?: Record<string, any>;
  }) {
    if (!this.razorpay) {
      throw new InternalServerErrorException("Razorpay not configured");
    }

    try {
      const transfer = await this.razorpay.transfers.create({
        amount: params.amount,
        currency: params.currency || "INR",
        account: params.account,
        notes: params.notes || {},
      });

      return transfer;
    } catch (error: any) {
      console.error("Razorpay transfer creation error:", error);
      throw new BadRequestException(
        error.error?.description || "Failed to create transfer"
      );
    }
  }

  /**
   * Refund a payment
   */
  async createRefund(params: {
    paymentId: string;
    amount?: number; // Partial refund if specified
    notes?: Record<string, any>;
  }) {
    if (!this.razorpay) {
      throw new InternalServerErrorException("Razorpay not configured");
    }

    try {
      const refundOptions: any = {
        payment_id: params.paymentId,
        notes: params.notes || {},
      };

      if (params.amount) {
        refundOptions.amount = params.amount;
      }

      const refund = await this.razorpay.payments.refund(params.paymentId, refundOptions);
      return refund;
    } catch (error: any) {
      console.error("Razorpay refund creation error:", error);
      throw new BadRequestException(
        error.error?.description || "Failed to create refund"
      );
    }
  }

  /**
   * Get order details
   */
  async getOrder(orderId: string) {
    if (!this.razorpay) {
      throw new InternalServerErrorException("Razorpay not configured");
    }

    try {
      const order = await this.razorpay.orders.fetch(orderId);
      return order;
    } catch (error: any) {
      console.error("Razorpay fetch order error:", error);
      throw new BadRequestException(
        error.error?.description || "Failed to fetch order"
      );
    }
  }
}








