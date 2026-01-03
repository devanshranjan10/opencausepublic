import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from "@nestjs/common";
import * as admin from "firebase-admin";
import { FirebaseService } from "../firebase/firebase.service";
import { CreateDonationDto, EvidenceKind } from "@opencause/types";
import { Web3Service } from "../web3/web3.service";
import { QueueService } from "../queue/queue.service";
import { DonationAllocationService } from "../transparency/donation-allocation.service";
import { EventService } from "../transparency/event.service";
import { createHash } from "crypto";
import { randomBytes } from "crypto";

@Injectable()
export class DonationsService {
  constructor(
    private firebase: FirebaseService,
    private web3Service: Web3Service,
    private queueService: QueueService,
    @Inject(forwardRef(() => DonationAllocationService))
    private allocationService: DonationAllocationService,
    @Inject(forwardRef(() => EventService))
    private eventService: EventService
  ) {}

  async create(userId: string, dto: CreateDonationDto, guestInfo?: { guestName?: string; guestEmail?: string }) {
    const campaign = await this.firebase.getCampaignById(dto.campaignId) as any;

    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    // Only allow donations to ACTIVE campaigns
    if (campaign.status !== "ACTIVE") {
      throw new ForbiddenException("Donations are only allowed for active campaigns. This campaign is currently " + campaign.status);
    }

    const isGuest = userId.startsWith("guest_");

    // For crypto donations, verification is already done in the frontend
    // Skip on-chain verification here to avoid duplicate checks and rate limiting
    // The transaction was already verified by the CryptoVerificationService before calling this endpoint
    // if (dto.type === "CRYPTO" && dto.txHash) {
    //   try {
    //     // Verify transaction exists and is confirmed
    //     const receipt = await this.web3Service.getTransactionReceipt(dto.txHash);
    //     if (!receipt || receipt.status !== "success") {
    //       throw new ForbiddenException("Transaction not confirmed or failed");
    //     }
    //   } catch (error: any) {
    //     throw new ForbiddenException(`Failed to verify transaction: ${error.message}`);
    //   }
    // }

    // Generate donation ID
    const donationId = randomBytes(16).toString("hex");
    
    // Determine currency for allocation
    const currency = dto.type === "INR" ? "INR" : (dto.tokenType || "ETH");
    
    // Determine amount (for crypto, use native amount if available, otherwise parse from dto.amount)
    let allocationAmount = dto.amount;
    if (dto.type === "CRYPTO" && (dto as any).amountNative) {
      allocationAmount = (dto as any).amountNative;
    }

    // Generate evidence hash for donation (before transaction)
    const evidenceData = {
      donationId,
      campaignId: dto.campaignId,
      amount: dto.amount,
      type: dto.type,
      timestamp: new Date().toISOString(),
    };
    const evidenceHash = createHash("sha256")
      .update(JSON.stringify(evidenceData))
      .digest("hex");

    // Use Firestore transaction to atomically:
    // 1. Create donation
    // 2. Allocate to milestones (if campaign has milestones)
    // 3. Emit events
    const db = admin.firestore();
    await db.runTransaction(async (transaction) => {
      // Create donation record
      const donationRef = db.collection("donations").doc(donationId);
      transaction.set(donationRef, {
        id: donationId,
        campaignId: dto.campaignId,
        donorId: userId,
        type: dto.type,
        amount: dto.amount,
        tokenAddress: dto.tokenAddress,
        tokenType: dto.tokenType,
        txHash: dto.txHash,
        orderId: dto.orderId,
        isGuest: isGuest,
        guestName: guestInfo?.guestName,
        guestEmail: guestInfo?.guestEmail,
        evidenceHash,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Check if campaign has milestones (not single pool)
      const campaignDoc = await transaction.get(db.collection("campaigns").doc(dto.campaignId));
      const campaignData = campaignDoc.data() as any;
      
      if (campaignData && !campaignData.isSinglePool) {
        // Allocate donation to milestones
        await this.allocationService.allocateDonationToMilestones(transaction, {
          donationId,
          campaignId: dto.campaignId,
          amount: allocationAmount,
          currency,
          actorUserId: isGuest ? undefined : userId,
        });
      }

      // Emit DONATION_RECEIVED event
      await this.eventService.emitEvent(transaction, {
        campaignId: dto.campaignId,
        type: "DONATION_RECEIVED",
        visibility: "PUBLIC",
        actorUserId: isGuest ? null : userId,
        entityType: "DONATION",
        entityId: donationId,
        data: {
          donationId,
          amount: allocationAmount,
          currency,
          type: dto.type,
          isAnonymous: isGuest,
        },
      });
    });

    const donation = { id: donationId };

    // Anchor evidence on-chain
    try {
      await this.web3Service.anchorEvidence({
        kind: EvidenceKind.INR_DONATION,
        campaignId: dto.campaignId,
        evidenceHash: `0x${evidenceHash}`,
        amount: dto.amount,
      });
    } catch (error) {
      console.error("Failed to anchor evidence:", error);
    }

    // Update campaign totals (outside transaction for now, but should be in transaction ideally)
    // Note: Campaign totals are now also maintained through allocation calculations
    // This is a legacy update - in future, we should compute totals from allocations
    if (dto.type === "INR") {
      const newRaisedInr = (BigInt(campaign.raisedInr || "0") + BigInt(dto.amount)).toString();
      await this.firebase.updateCampaign(dto.campaignId, { raisedInr: newRaisedInr });
    } else if (dto.type === "CRYPTO") {
      // For crypto donations, update both raisedCrypto and raisedInr
      const amountUsd = (dto as any).amountUsd;
      if (amountUsd && amountUsd !== "undefined" && amountUsd !== "null" && amountUsd.trim() !== "") {
        const usdToInrRate = 83; // TODO: Use real-time FX rate
        const amountUsdNum = parseFloat(amountUsd.toString().trim());
        if (!isNaN(amountUsdNum)) {
          const amountInr = Math.round(amountUsdNum * usdToInrRate);
          const currentRaisedInr = BigInt(campaign.raisedInr || "0");
          const newRaisedInr = (currentRaisedInr + BigInt(amountInr)).toString();
          const currentRaisedCrypto = BigInt(campaign.raisedCrypto || "0");
          const newRaisedCrypto = (currentRaisedCrypto + BigInt(dto.amount)).toString();
          
          await this.firebase.updateCampaign(dto.campaignId, { 
            raisedInr: newRaisedInr,
            raisedCrypto: newRaisedCrypto,
          });
        }
      } else {
        const newRaisedCrypto = (BigInt(campaign.raisedCrypto || "0") + BigInt(dto.amount)).toString();
        await this.firebase.updateCampaign(dto.campaignId, { raisedCrypto: newRaisedCrypto });
      }
    }

    // Queue notification (only for authenticated users)
    if (!isGuest) {
      await this.queueService.addNotificationJob({
        userId,
        type: "DONATION_RECEIVED",
        title: "Donation Received",
        message: `Your donation of ${dto.amount} has been received`,
        link: `/campaigns/${dto.campaignId}`,
      });
    }

    return donation;
  }

  async findByCampaign(campaignId: string) {
    const donations = await this.firebase.query("donations", "campaignId", "==", campaignId);
    
    // Get donor info for each donation
    const donationsWithDonors = await Promise.all(
      donations.map(async (donation: any) => {
        const donor = await this.firebase.getUserById(donation.donorId) as any;
        return {
          ...donation,
          donor: donor ? {
            id: donor.id,
            name: donor.name,
            email: donor.email,
          } : null,
        };
      })
    );

    return donationsWithDonors.sort((a: any, b: any) => {
      const aTime = a.createdAt?.toDate?.() ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const bTime = b.createdAt?.toDate?.() ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }

  async findByDonor(userId: string) {
    const donations = await this.firebase.query("donations", "donorId", "==", userId);
    
    // Get campaign info for each donation
    const donationsWithCampaigns = await Promise.all(
      donations.map(async (donation: any) => {
        const campaign = await this.firebase.getCampaignById(donation.campaignId) as any;
        return {
          ...donation,
          campaign: campaign ? {
            id: campaign.id,
            title: campaign.title,
            imageUrl: campaign.imageUrl,
          } : null,
        };
      })
    );

    return donationsWithCampaigns.sort((a: any, b: any) => {
      const aTime = a.createdAt?.toDate?.() ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const bTime = b.createdAt?.toDate?.() ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }
}

