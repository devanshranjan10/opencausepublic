import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { FirebaseService } from "../firebase/firebase.service";
import { CreateWithdrawalRequestInput } from "@opencause/types";
import * as admin from "firebase-admin";
import { encryptBankAccount } from "./bank-encryption";
import { createHash } from "crypto";

/**
 * Enhanced withdrawal service with invoice proof validation
 */
@Injectable()
export class WithdrawalsNewService {
  constructor(private firebase: FirebaseService) {}

  /**
   * Create a new withdrawal request with enhanced validation
   */
  async createWithdrawalRequest(
    userId: string,
    input: CreateWithdrawalRequestInput
  ): Promise<{ id: string }> {
    const db = admin.firestore();

    // 1. Verify campaign exists and user is organizer
    const campaignSnap = await db.collection("campaigns").doc(input.campaignId).get();
    if (!campaignSnap.exists) {
      throw new NotFoundException("Campaign not found");
    }

    const campaign = campaignSnap.data() as any;
    if (campaign.organizerId !== userId) {
      throw new ForbiddenException("Only campaign organizer can create withdrawal requests");
    }

    // 2. Check rate limiting (max 5 submissions per hour)
    const oneHourAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
    const recentWithdrawals = await db
      .collection("withdrawals")
      .where("requesterUserId", "==", userId)
      .where("status", "in", ["SUBMITTED", "UNDER_REVIEW", "APPROVED"])
      .where("createdAt", ">=", oneHourAgo)
      .get();

    if (recentWithdrawals.size >= 5) {
      throw new BadRequestException(
        "Rate limit exceeded. Maximum 5 withdrawal requests per hour allowed."
      );
    }

    // 3. Check duplicate submission (idempotency by invoice number + sha256 within 10 minutes)
    const tenMinutesAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 10 * 60 * 1000);
    const duplicateCheck = await db
      .collection("withdrawals")
      .where("campaignId", "==", input.campaignId)
      .where("invoiceNumber", "==", input.invoiceNumber)
      .where("proofSha256", "==", input.proofSha256)
      .where("createdAt", ">=", tenMinutesAgo)
      .limit(1)
      .get();

    if (!duplicateCheck.empty) {
      throw new BadRequestException(
        "Duplicate submission detected. This invoice was recently submitted."
      );
    }

    // 4. Validate withdrawable amount
    await this.validateWithdrawableAmount(input.campaignId, input.currency, input.amount);

    // 5. Validate milestone if provided
    if (input.milestoneId) {
      const milestoneSnap = await db
        .collection("milestones")
        .doc(input.milestoneId)
        .get();
      if (!milestoneSnap.exists) {
        throw new NotFoundException("Milestone not found");
      }
      const milestone = milestoneSnap.data() as any;
      if (milestone.campaignId !== input.campaignId) {
        throw new BadRequestException("Milestone does not belong to this campaign");
      }
    }

    // 6. Prepare withdrawal document
    const withdrawalData: any = {
      campaignId: input.campaignId,
      milestoneId: input.milestoneId || null,
      requesterUserId: userId,
      currency: input.currency,
      amount: input.amount,
      payoutRail: input.payoutRail,
      invoiceNumber: input.invoiceNumber,
      invoiceDate: input.invoiceDate,
      invoiceAmount: input.invoiceAmount,
      vendorName: input.vendorName,
      vendorGstin: input.vendorGstin || null,
      proofFileUrl: input.proofFileUrl,
      proofMimeType: input.proofMimeType,
      proofSha256: input.proofSha256,
      status: "SUBMITTED",
      gstinOcrStatus: input.currency === "INR" ? "PENDING" : undefined,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // 7. Add payout-specific fields
    if (input.currency === "INR") {
      if (input.payoutRail === "UPI") {
        withdrawalData.upiVpa = input.upiVpa;
      } else if (input.payoutRail === "BANK") {
        // Encrypt bank account number
        if (!process.env.BANK_ENCRYPTION_KEY) {
          throw new Error("BANK_ENCRYPTION_KEY environment variable is required");
        }
        const encryptedAccount = encryptBankAccount(input.bankAccountNumber!);
        withdrawalData.bankAccountNumber = encryptedAccount;
        withdrawalData.bankIfsc = input.bankIfsc;
        withdrawalData.bankBeneficiaryName = input.bankBeneficiaryName;
      }
    } else {
      // Crypto
      withdrawalData.cryptoAddress = input.cryptoAddress;
      withdrawalData.chainId = input.chainId;
      withdrawalData.amountNative = input.amount; // For crypto, same as amount
    }

    // 8. Create withdrawal document
    const withdrawalRef = db.collection("withdrawals").doc();
    await withdrawalRef.set(withdrawalData);

    // 9. Create audit log
    await db.collection("withdrawal_audit_logs").add({
      withdrawalRequestId: withdrawalRef.id,
      actorUserId: userId,
      action: "SUBMITTED",
      details: {
        currency: input.currency,
        amount: input.amount,
        payoutRail: input.payoutRail,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 10. TODO: Trigger async GSTIN OCR check for INR
    if (input.currency === "INR" && input.vendorGstin) {
      // runGstinOcrCheck(input.proofFileUrl, input.vendorGstin)
      //   .then((result) => {
      //     withdrawalRef.update({ gstinOcrStatus: result });
      //   })
      //   .catch((error) => {
      //     console.error("GSTIN OCR check failed:", error);
      //   });
    }

    return { id: withdrawalRef.id };
  }

  /**
   * Validate withdrawable amount (stub - implement full logic based on escrow)
   */
  private async validateWithdrawableAmount(
    campaignId: string,
    currency: string,
    requestedAmount: string
  ): Promise<void> {
    const db = admin.firestore();
    const campaignSnap = await db.collection("campaigns").doc(campaignId).get();
    if (!campaignSnap.exists) {
      throw new NotFoundException("Campaign not found");
    }

    const campaign = campaignSnap.data() as any;

    // Get raised amount
    const raisedAmount =
      currency === "INR"
        ? BigInt(campaign.raisedInr || "0")
        : BigInt(campaign.raisedCrypto || "0");

    // Get withdrawn amount
    const withdrawnSnap = await db
      .collection("withdrawals")
      .where("campaignId", "==", campaignId)
      .where("currency", "==", currency)
      .where("status", "in", ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "PAID"])
      .get();

    let totalWithdrawn = BigInt(0);
    withdrawnSnap.forEach((doc) => {
      const wd = doc.data();
      totalWithdrawn += BigInt(Math.floor(parseFloat(wd.amount || "0") * 100));
    });

    // Calculate available
    const requested = BigInt(Math.floor(parseFloat(requestedAmount) * 100));
    const available = raisedAmount - totalWithdrawn;

    if (requested > available) {
      throw new BadRequestException(
        `Insufficient withdrawable balance. Available: ${Number(available) / 100}, Requested: ${requestedAmount}`
      );
    }

    if (requested <= 0) {
      throw new BadRequestException("Withdrawal amount must be greater than 0");
    }
  }

  /**
   * Approve withdrawal request
   */
  async approveWithdrawal(
    withdrawalId: string,
    reviewerId: string,
    notes?: string
  ): Promise<void> {
    const db = admin.firestore();
    const withdrawalRef = db.collection("withdrawals").doc(withdrawalId);
    const withdrawalSnap = await withdrawalRef.get();

    if (!withdrawalSnap.exists) {
      throw new NotFoundException("Withdrawal request not found");
    }

    const withdrawal = withdrawalSnap.data() as any;
    if (withdrawal.status !== "SUBMITTED" && withdrawal.status !== "UNDER_REVIEW") {
      throw new BadRequestException(
        `Cannot approve withdrawal in ${withdrawal.status} status`
      );
    }

    // Update status
    await withdrawalRef.update({
      status: "APPROVED",
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create audit log
    await db.collection("withdrawal_audit_logs").add({
      withdrawalRequestId: withdrawalId,
      actorUserId: reviewerId,
      action: "APPROVED",
      details: { notes },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // If crypto, trigger payout immediately
    if (withdrawal.currency !== "INR" && withdrawal.status === "APPROVED") {
      // TODO: Trigger crypto payout
      // await this.executeCryptoPayout(withdrawalId);
    }
  }

  /**
   * Reject withdrawal request
   */
  async rejectWithdrawal(
    withdrawalId: string,
    reviewerId: string,
    reason: string
  ): Promise<void> {
    const db = admin.firestore();
    const withdrawalRef = db.collection("withdrawals").doc(withdrawalId);
    const withdrawalSnap = await withdrawalRef.get();

    if (!withdrawalSnap.exists) {
      throw new NotFoundException("Withdrawal request not found");
    }

    const withdrawal = withdrawalSnap.data() as any;
    if (withdrawal.status === "PAID") {
      throw new BadRequestException("Cannot reject a paid withdrawal");
    }

    await withdrawalRef.update({
      status: "REJECTED",
      rejectionReason: reason,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("withdrawal_audit_logs").add({
      withdrawalRequestId: withdrawalId,
      actorUserId: reviewerId,
      action: "REJECTED",
      details: { reason },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  /**
   * Mark withdrawal as paid
   */
  async markPaid(withdrawalId: string, txHash?: string): Promise<void> {
    const db = admin.firestore();
    const withdrawalRef = db.collection("withdrawals").doc(withdrawalId);
    const withdrawalSnap = await withdrawalRef.get();

    if (!withdrawalSnap.exists) {
      throw new NotFoundException("Withdrawal request not found");
    }

    const withdrawal = withdrawalSnap.data() as any;
    if (withdrawal.status !== "APPROVED") {
      throw new BadRequestException("Only approved withdrawals can be marked as paid");
    }

    const updateData: any = {
      status: "PAID",
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (txHash) {
      updateData.txHash = txHash;
      // Generate explorer URL based on chain
      // TODO: Implement explorer URL generation
    }

    await withdrawalRef.update(updateData);

    await db.collection("withdrawal_audit_logs").add({
      withdrawalRequestId: withdrawalId,
      actorUserId: "system", // Or pass reviewer ID
      action: "PAID",
      details: { txHash },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

