import { Injectable, Inject, forwardRef } from "@nestjs/common";
import * as admin from "firebase-admin";
import { DonationAllocationService } from "./donation-allocation.service";
import { EventService } from "./event.service";

/**
 * Enhanced Donations Service
 * Integrates donation allocation and event emission
 */
@Injectable()
export class DonationsEnhancedService {
  constructor(
    private allocationService: DonationAllocationService,
    private eventService: EventService
  ) {}

  /**
   * Create donation with automatic allocation to milestones
   * Must be called within a Firestore transaction
   */
  async createDonationWithAllocation(
    transaction: admin.firestore.Transaction,
    params: {
      donationData: any; // Donation document data
      donationId: string;
      campaignId: string;
      amount: string;
      currency: string;
      actorUserId?: string;
    }
  ): Promise<void> {
    const db = admin.firestore();
    
    // Create donation document
    const donationRef = db.collection("donations").doc(params.donationId);
    transaction.set(donationRef, {
      ...params.donationData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Allocate to milestones
    const { allocations, milestonesCompleted } = await this.allocationService.allocateDonationToMilestones(
      transaction,
      {
        donationId: params.donationId,
        campaignId: params.campaignId,
        amount: params.amount,
        currency: params.currency,
        actorUserId: params.actorUserId,
      }
    );

    // Emit DONATION_RECEIVED event
    await this.eventService.emitEvent(transaction, {
      campaignId: params.campaignId,
      type: "DONATION_RECEIVED",
      visibility: "PUBLIC",
      actorUserId: params.actorUserId,
      entityType: "DONATION",
      entityId: params.donationId,
      data: {
        donationId: params.donationId,
        amount: params.amount,
        currency: params.currency,
        // Mask donor info if needed
      },
    });
  }
}






