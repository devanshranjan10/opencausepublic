import { Injectable } from "@nestjs/common";
import * as admin from "firebase-admin";
import { EventService } from "./event.service";
import {
  DonationAllocationDoc,
  MilestoneDoc,
  MilestoneStatus,
  Timestamp,
} from "@opencause/firebase";

/**
 * Donation Allocation Service
 * Implements FIFO allocation strategy: donations go to earliest incomplete milestone
 */
@Injectable()
export class DonationAllocationService {
  constructor(private eventService: EventService) {}

  /**
   * Allocate a donation to milestones (FIFO strategy)
   * Must be called within a Firestore transaction
   */
  async allocateDonationToMilestones(
    transaction: admin.firestore.Transaction,
    params: {
      donationId: string;
      campaignId: string;
      amount: string; // Decimal string
      currency: string; // "INR" | crypto symbol
      actorUserId?: string;
    }
  ): Promise<{
    allocations: DonationAllocationDoc[];
    milestonesCompleted: string[]; // Milestone IDs that reached FUNDING_COMPLETED
  }> {
    const db = admin.firestore();
    const allocations: DonationAllocationDoc[] = [];
    const milestonesCompleted: string[] = [];

    // Get all incomplete milestones for this campaign (FIFO)
    // Note: Firestore transactions don't support orderBy on queries with where clauses
    // We'll fetch all and sort in memory
    const milestonesSnapshot = await transaction.get(
      db
        .collection("milestones")
        .where("campaignId", "==", params.campaignId)
        .where("status", "in", ["NOT_STARTED", "IN_PROGRESS"])
    );
    
    // Sort by createdAt in memory (FIFO)
    const milestones = milestonesSnapshot.docs.sort((a, b) => {
      const aTime = (a.data().createdAt?.toMillis?.() || 0);
      const bTime = (b.data().createdAt?.toMillis?.() || 0);
      return aTime - bTime;
    });

    let remainingAmount = parseFloat(params.amount);

    for (const milestoneDoc of milestones) {
      if (remainingAmount <= 0) break;

      const milestone = milestoneDoc.data() as MilestoneDoc;
      
      // Determine target amount based on currency
      const targetAmountStr = params.currency === "INR" 
        ? milestone.targetAmountInr 
        : milestone.targetAmountCrypto;
      
      if (!targetAmountStr) continue; // Skip if milestone doesn't accept this currency

      const targetAmount = parseFloat(targetAmountStr);
      
      // Get current received amount for this milestone in this currency
      const currentReceived = await this.getMilestoneReceivedAmount(
        transaction,
        milestoneDoc.id,
        params.currency
      );

      const amountNeeded = Math.max(0, targetAmount - currentReceived);
      
      if (amountNeeded <= 0) {
        // Milestone already funded, skip
        continue;
      }

      // Allocate (either all remaining or amount needed, whichever is smaller)
      const allocationAmount = Math.min(remainingAmount, amountNeeded);
      const allocationAmountStr = allocationAmount.toFixed(18); // High precision

      // Create allocation record
      const allocationRef = db.collection("donation_allocations").doc();
      const allocationDoc: DonationAllocationDoc = {
        id: allocationRef.id,
        donationId: params.donationId,
        campaignId: params.campaignId,
        milestoneId: milestoneDoc.id,
        amount: allocationAmountStr,
        currency: params.currency,
        createdAt: admin.firestore.FieldValue.serverTimestamp() as Timestamp,
      };
      transaction.set(allocationRef, allocationDoc);
      allocations.push(allocationDoc);

      // Update milestone received amount
      const newReceived = currentReceived + allocationAmount;
      const newReceivedStr = newReceived.toFixed(18);

      const milestoneUpdate: Partial<MilestoneDoc> = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as Timestamp,
      };

      if (params.currency === "INR") {
        milestoneUpdate.receivedAmountInr = newReceivedStr;
      } else {
        milestoneUpdate.receivedAmountCrypto = newReceivedStr;
      }

      // Check if milestone is now completed
      if (newReceived >= targetAmount) {
        milestoneUpdate.status = "FUNDING_COMPLETED" as MilestoneStatus;
        milestoneUpdate.fundingCompletedAt = admin.firestore.FieldValue.serverTimestamp() as Timestamp;
        milestonesCompleted.push(milestoneDoc.id);

        // Emit event for milestone completion
        await this.eventService.emitEvent(transaction, {
          campaignId: params.campaignId,
          type: "MILESTONE_FUNDING_COMPLETED",
          visibility: "PUBLIC",
          actorUserId: params.actorUserId,
          entityType: "MILESTONE",
          entityId: milestoneDoc.id,
          data: {
            milestoneTitle: milestone.title,
            milestoneId: milestoneDoc.id,
            targetAmount: targetAmountStr,
            receivedAmount: newReceivedStr,
            currency: params.currency,
          },
        });
      } else if (milestone.status === "NOT_STARTED") {
        milestoneUpdate.status = "IN_PROGRESS" as MilestoneStatus;
      }

      transaction.update(milestoneDoc.ref, milestoneUpdate);

      // Emit allocation event
      await this.eventService.emitEvent(transaction, {
        campaignId: params.campaignId,
        type: "DONATION_ALLOCATED",
        visibility: "PUBLIC",
        actorUserId: params.actorUserId,
        entityType: "DONATION",
        entityId: params.donationId,
        data: {
          donationId: params.donationId,
          milestoneId: milestoneDoc.id,
          milestoneTitle: milestone.title,
          amount: allocationAmountStr,
          currency: params.currency,
        },
      });

      remainingAmount -= allocationAmount;
    }

    return { allocations, milestonesCompleted };
  }

  /**
   * Get total received amount for a milestone in a specific currency
   */
  private async getMilestoneReceivedAmount(
    transaction: admin.firestore.Transaction,
    milestoneId: string,
    currency: string
  ): Promise<number> {
    const db = admin.firestore();
    const allocationsSnapshot = await transaction.get(
      db
        .collection("donation_allocations")
        .where("milestoneId", "==", milestoneId)
        .where("currency", "==", currency)
    );

    let total = 0;
    allocationsSnapshot.docs.forEach((doc) => {
      const allocation = doc.data() as DonationAllocationDoc;
      total += parseFloat(allocation.amount);
    });

    return total;
  }

  /**
   * Get all allocations for a milestone
   */
  async getMilestoneAllocations(
    milestoneId: string,
    currency?: string
  ): Promise<DonationAllocationDoc[]> {
    const db = admin.firestore();
    let query: admin.firestore.Query = db
      .collection("donation_allocations")
      .where("milestoneId", "==", milestoneId);

    if (currency) {
      query = query.where("currency", "==", currency);
    }

    // Don't use orderBy here to avoid requiring composite index
    // Sort in memory instead
    const snapshot = await query.get();
    const allocations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as DonationAllocationDoc[];
    
    // Sort by createdAt ascending in memory
    return allocations.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
      return aTime - bTime;
    });
  }

  /**
   * Calculate withdrawable amount for a milestone
   * withdrawable = allocated - already approved/paid withdrawals
   */
  async calculateWithdrawableAmount(
    milestoneId: string,
    currency: string
  ): Promise<string> {
    const db = admin.firestore();
    
    // Get total allocated
    const allocationsSnapshot = await db
      .collection("donation_allocations")
      .where("milestoneId", "==", milestoneId)
      .where("currency", "==", currency)
      .get();

    let totalAllocated = 0;
    allocationsSnapshot.docs.forEach((doc) => {
      const allocation = doc.data() as DonationAllocationDoc;
      totalAllocated += parseFloat(allocation.amount);
    });

    // Get total withdrawn (approved or paid)
    const withdrawalsSnapshot = await db
      .collection("withdrawals")
      .where("milestoneId", "==", milestoneId)
      .where("currency", "==", currency)
      .where("status", "in", ["APPROVED", "PAID"])
      .get();

    let totalWithdrawn = 0;
    withdrawalsSnapshot.docs.forEach((doc) => {
      const withdrawal = doc.data() as any;
      totalWithdrawn += parseFloat(withdrawal.amount || "0");
    });

    const withdrawable = Math.max(0, totalAllocated - totalWithdrawn);
    return withdrawable.toFixed(18);
  }
}

