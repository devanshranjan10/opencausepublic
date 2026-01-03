import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import * as admin from "firebase-admin";
import {
  MilestoneDoc,
  MilestoneStatus,
  ProofPolicy,
  Timestamp,
} from "@opencause/firebase";

/**
 * Milestone Service
 * Manages milestone creation, updates, and status tracking
 */
@Injectable()
export class MilestoneService {
  /**
   * Create a milestone for a campaign
   */
  async createMilestone(
    campaignId: string,
    data: {
      title: string;
      description: string;
      targetAmountInr?: string;
      targetAmountCrypto?: string;
      targetCurrency?: string;
      proofPolicyOverride?: Partial<ProofPolicy>;
    }
  ): Promise<string> {
    const db = admin.firestore();

    // Verify campaign exists
    const campaignRef = db.collection("campaigns").doc(campaignId);
    const campaignSnap = await campaignRef.get();
    if (!campaignSnap.exists) {
      throw new NotFoundException("Campaign not found");
    }

    // Validate amounts
    if (data.targetAmountInr && parseFloat(data.targetAmountInr) <= 0) {
      throw new BadRequestException("Target amount must be greater than 0");
    }
    if (data.targetAmountCrypto && parseFloat(data.targetAmountCrypto) <= 0) {
      throw new BadRequestException("Target amount must be greater than 0");
    }

    if (!data.targetAmountInr && !data.targetAmountCrypto) {
      throw new BadRequestException("At least one target amount (INR or crypto) is required");
    }

    const milestoneRef = db.collection("milestones").doc();
    const milestoneDoc: MilestoneDoc = {
      id: milestoneRef.id,
      campaignId,
      title: data.title,
      description: data.description,
      targetAmountInr: data.targetAmountInr,
      targetAmountCrypto: data.targetAmountCrypto,
      targetCurrency: data.targetCurrency,
      status: "NOT_STARTED",
      proofPolicyOverride: data.proofPolicyOverride,
      receivedAmountInr: "0",
      receivedAmountCrypto: "0",
      createdAt: admin.firestore.FieldValue.serverTimestamp() as Timestamp,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() as Timestamp,
    };

    await milestoneRef.set(milestoneDoc);

    // Update campaign milestones array (denormalized)
    await campaignRef.update({
      milestones: admin.firestore.FieldValue.arrayUnion(milestoneRef.id),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return milestoneRef.id;
  }

  /**
   * Get all milestones for a campaign
   */
  async getCampaignMilestones(campaignId: string): Promise<MilestoneDoc[]> {
    const db = admin.firestore();
    
    // Query without orderBy to avoid index requirement, sort in memory
    const snapshot = await db
      .collection("milestones")
      .where("campaignId", "==", campaignId)
      .get();

    const milestones = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as MilestoneDoc[];

    // Sort by createdAt in memory (ascending)
    milestones.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 
                   ((a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : 0) ||
                   0;
      const bTime = b.createdAt?.toMillis?.() || 
                   ((b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : 0) ||
                   0;
      return aTime - bTime;
    });

    return milestones;
  }

  /**
   * Get a single milestone
   */
  async getMilestone(milestoneId: string): Promise<MilestoneDoc | null> {
    const db = admin.firestore();
    const doc = await db.collection("milestones").doc(milestoneId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as MilestoneDoc;
  }

  /**
   * Update milestone status
   */
  async updateMilestoneStatus(
    milestoneId: string,
    status: MilestoneStatus
  ): Promise<void> {
    const db = admin.firestore();
    const milestoneRef = db.collection("milestones").doc(milestoneId);
    
    const update: Partial<MilestoneDoc> = {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() as Timestamp,
    };

    if (status === "FUNDING_COMPLETED") {
      update.fundingCompletedAt = admin.firestore.FieldValue.serverTimestamp() as Timestamp;
    }

    await milestoneRef.update(update);
  }
}

