import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
  Headers,
  RawBodyRequest,
  Req,
  Inject,
  forwardRef,
  BadRequestException,
} from "@nestjs/common";
import { RazorpayService } from "./razorpay.service";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { DonationsService } from "../donations/donations.service";
import { FirebaseService } from "../firebase/firebase.service";
import { DonationType } from "@opencause/types";

@Controller("payments")
export class PaymentsController {
  constructor(
    private razorpayService: RazorpayService,
    @Inject(forwardRef(() => DonationsService))
    private donationsService: DonationsService,
    private firebase: FirebaseService
  ) {}

  /**
   * Create a Razorpay order for INR donation
   */
  @Post("razorpay/order")
  @UseGuards(OptionalJwtAuthGuard)
  async createOrder(
    @Request() req,
    @Body() body: {
      amount: number; // Amount in rupees (will be converted to paise)
      campaignId: string;
      guestName?: string;
      guestEmail?: string;
    }
  ) {
    // Validate request body
    if (!body.amount || typeof body.amount !== "number" || body.amount <= 0) {
      throw new BadRequestException("Invalid amount. Amount must be a positive number.");
    }

    if (!body.campaignId || typeof body.campaignId !== "string") {
      throw new BadRequestException("Campaign ID is required.");
    }

    const userId = (req as any).user?.id || `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const isGuest = !(req as any).user?.id;

    // Validate guest info if guest donation
    if (isGuest) {
      if (!body.guestName || !body.guestEmail) {
        throw new BadRequestException("Guest name and email are required for guest donations.");
      }
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.guestEmail)) {
        throw new BadRequestException("Invalid email format.");
      }
    }

    // Verify campaign exists
    const campaign = await this.firebase.getCampaignById(body.campaignId);
    if (!campaign) {
      throw new BadRequestException("Campaign not found.");
    }

    // Check minimum amount (Razorpay minimum is ₹1 = 100 paise)
    if (body.amount < 1) {
      throw new BadRequestException("Minimum donation amount is ₹1.");
    }

    // Convert rupees to paise
    const amountInPaise = Math.round(body.amount * 100);

    // Generate receipt (Razorpay requires max 40 characters)
    // Format: don_<shortCampaignId>_<timestamp>
    // Truncate campaignId to 10 chars and use last 8 digits of timestamp to stay under 40
    const shortCampaignId = body.campaignId.substring(0, 10);
    const shortTimestamp = Date.now().toString().slice(-8);
    const receipt = `don_${shortCampaignId}_${shortTimestamp}`; // Max: 3 + 10 + 1 + 8 = 22 chars

    // Create order
    const order = await this.razorpayService.createOrder({
      amount: amountInPaise,
      currency: "INR",
      receipt,
      notes: {
        campaignId: body.campaignId,
        userId: userId,
        guestName: body.guestName,
        guestEmail: body.guestEmail,
      },
    });

    // Store pending donation record
    await this.firebase.create("pending_donations", {
      orderId: order.id,
      campaignId: body.campaignId,
      userId: userId,
      amount: body.amount.toString(),
      amountInPaise: amountInPaise.toString(),
      status: "PENDING",
      guestName: body.guestName,
      guestEmail: body.guestEmail,
      createdAt: new Date().toISOString(),
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID, // Frontend needs this for Razorpay Checkout
    };
  }

  /**
   * Verify payment and create donation record
   */
  @Post("razorpay/verify")
  @UseGuards(OptionalJwtAuthGuard)
  async verifyPayment(
    @Request() req,
    @Body() body: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }
  ) {
    // Verify signature
    const isValid = this.razorpayService.verifyPaymentSignature({
      orderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    });

    if (!isValid) {
      throw new Error("Invalid payment signature");
    }

    // Get payment details
    const payment = await this.razorpayService.getPayment(body.razorpay_payment_id);
    const order = await this.razorpayService.getOrder(body.razorpay_order_id);

    if (payment.status !== "captured") {
      throw new Error("Payment not captured");
    }

    // Get pending donation
    const pendingDonations = await this.firebase.query(
      "pending_donations",
      "orderId",
      "==",
      body.razorpay_order_id
    );
    const pendingDonation = pendingDonations[0];

    if (!pendingDonation) {
      throw new Error("Pending donation not found");
    }

    // Update pending donation status
    await this.firebase.update("pending_donations", pendingDonation.id, {
      status: "COMPLETED",
      paymentId: body.razorpay_payment_id,
      verifiedAt: new Date().toISOString(),
    });

    // Create donation record
    const donation = await this.donationsService.create(
      pendingDonation.userId,
      {
        campaignId: pendingDonation.campaignId,
            type: DonationType.INR,
        amount: pendingDonation.amount,
        orderId: body.razorpay_order_id,
      },
      {
        guestName: pendingDonation.guestName,
        guestEmail: pendingDonation.guestEmail,
      }
    );

    return {
      success: true,
      donation,
      payment: {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
      },
    };
  }

  /**
   * Razorpay webhook handler
   */
  @Post("razorpay/webhook")
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-razorpay-signature") signature: string,
    @Body() body: any
  ) {
    // For Fastify, raw body is available in req.rawBody
    const webhookBody = (req.rawBody as Buffer)?.toString() || JSON.stringify(body);

    // Verify webhook signature
    const isValid = this.razorpayService.verifyWebhookSignature(webhookBody, signature);

    if (!isValid) {
      console.error("Invalid webhook signature");
      return { status: "error", message: "Invalid signature" };
    }

    const event = body as any;

    try {
      const eventType = event?.event || (event as any)?.type;
      switch (eventType) {
        case "payment.captured":
          await this.handlePaymentCaptured(event);
          break;
        case "payment.failed":
          await this.handlePaymentFailed(event);
          break;
        case "order.paid":
          await this.handleOrderPaid(event);
          break;
        default:
          console.log(`Unhandled webhook event: ${eventType || "unknown"}`);
      }

      return { status: "success" };
    } catch (error) {
      console.error("Webhook handler error:", error);
      return { status: "error", message: error.message };
    }
  }

  private async handlePaymentCaptured(event: any) {
    const payment = event.payload.payment.entity;
    console.log("Payment captured:", payment.id);

    // Find pending donation by payment ID
    const pendingDonations = await this.firebase.query(
      "pending_donations",
      "paymentId",
      "==",
      payment.id
    );

    if (pendingDonations.length > 0) {
      const pendingDonation = pendingDonations[0];
      
      // Update status
      await this.firebase.update("pending_donations", pendingDonation.id, {
        status: "COMPLETED",
        verifiedAt: new Date().toISOString(),
      });

      // Create donation if not already created
      try {
        await this.donationsService.create(
          pendingDonation.userId,
          {
            campaignId: pendingDonation.campaignId,
            type: DonationType.INR,
            amount: pendingDonation.amount,
            orderId: payment.order_id,
          },
          {
            guestName: pendingDonation.guestName,
            guestEmail: pendingDonation.guestEmail,
          }
        );
      } catch (error) {
        console.error("Error creating donation from webhook:", error);
      }
    }
  }

  private async handlePaymentFailed(event: any) {
    const payment = event.payload.payment.entity;
    console.log("Payment failed:", payment.id);

    // Update pending donation status
    const pendingDonations = await this.firebase.query(
      "pending_donations",
      "paymentId",
      "==",
      payment.id
    );

    for (const pendingDonation of pendingDonations) {
      await this.firebase.update("pending_donations", pendingDonation.id, {
        status: "FAILED",
        failedAt: new Date().toISOString(),
      });
    }
  }

  private async handleOrderPaid(event: any) {
    const order = event.payload.order.entity;
    console.log("Order paid:", order.id);
    // Similar handling as payment captured
  }

  /**
   * Create payout for withdrawal
   */
  @Post("razorpay/payout")
  @UseGuards(JwtAuthGuard)
  async createPayout(
    @Request() req,
    @Body() body: {
      withdrawalId: string;
      accountNumber: string;
      ifsc?: string;
      accountHolderName?: string;
      amount: number; // Amount in rupees
    }
  ) {
    // Get withdrawal request
    const withdrawals = await this.firebase.query("withdrawals", "id", "==", body.withdrawalId);
    const withdrawal = withdrawals && withdrawals.length > 0 ? withdrawals[0] : null;

    if (!withdrawal) {
      throw new Error("Withdrawal not found");
    }

    // Verify user has permission (organizer or admin)
    const user = await this.firebase.getUserById(req.user.id) as any;
    if (user.role !== "ADMIN" && withdrawal.organizerId !== req.user.id) {
      throw new Error("Unauthorized");
    }

    // Convert rupees to paise
    const amountInPaise = Math.round(body.amount * 100);

    // Create payout
    const payout = await this.razorpayService.createPayout({
      accountNumber: body.accountNumber,
      amount: amountInPaise,
      currency: "INR",
      mode: "NEFT",
      purpose: "payout",
      fundAccount: {
        accountType: "bank_account",
        bankAccount: {
          name: body.accountHolderName || "Payee",
          ifsc: body.ifsc || "",
          accountNumber: body.accountNumber,
        },
      },
      notes: {
        withdrawalId: body.withdrawalId,
        campaignId: withdrawal.campaignId,
      },
    });

    // Update withdrawal with payout details
    await this.firebase.update("withdrawals", body.withdrawalId, {
      payoutId: payout.id,
      payoutStatus: payout.status,
      payoutCreatedAt: new Date().toISOString(),
    });

    return {
      success: true,
      payout,
    };
  }
}










