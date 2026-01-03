import { Injectable } from "@nestjs/common";
import { FirestoreRepository } from "@opencause/firebase";
import { FirebaseService } from "../firebase/firebase.service";
import { CampaignPublicDoc, CampaignStatsPublicDoc } from "@opencause/firebase";
import * as admin from "firebase-admin";

/**
 * Service to manage public campaign data (sync from private to public collections)
 */
@Injectable()
export class CampaignPublicService {
  private _repo: FirestoreRepository | null = null;

  constructor(private firebase: FirebaseService) {}

  private get repo(): FirestoreRepository {
    if (!this._repo) {
      this._repo = new FirestoreRepository(this.firebase.firestore);
    }
    return this._repo;
  }

  /**
   * Sync campaign to public collection (called when campaign status changes)
   */
  async syncCampaignPublic(campaignId: string): Promise<void> {
    const db = admin.firestore();
    const campaignSnap = await db.collection("campaigns").doc(campaignId).get();
    
    if (!campaignSnap.exists) {
      return; // Campaign not found
    }

    const campaign = campaignSnap.data() as any;
    
    const publicDoc: CampaignPublicDoc = {
      campaignId,
      title: campaign.title || "",
      description: campaign.description,
      goalInr: campaign.goalInr || "0",
      status: this.mapStatus(campaign.status),
      coverImage: campaign.imageUrl,
      createdAt: campaign.createdAt,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    await this.repo.createOrUpdateCampaignPublic(campaignId, publicDoc);
  }

  /**
   * Check if goal is met (using campaign_stats_public or compute from stats)
   */
  async isGoalMet(campaignId: string): Promise<boolean> {
    const stats = await this.repo.getCampaignStatsPublic(campaignId);
    if (stats) {
      return stats.goalMet || false;
    }

    // Fallback: check from private campaign data
    const db = admin.firestore();
    const campaignSnap = await db.collection("campaigns").doc(campaignId).get();
    if (!campaignSnap.exists) {
      return false;
    }

    const campaign = campaignSnap.data() as any;
    const goalInr = BigInt(campaign.goalInr || "0");
    const raisedInr = BigInt(campaign.raisedInr || "0");
    
    return raisedInr >= goalInr;
  }

  /**
   * Check goal met using Firestore transaction (race-safe)
   */
  async checkGoalMetTransaction(campaignId: string): Promise<{ goalMet: boolean; currentTotal: string }> {
    const db = admin.firestore();
    
    return await db.runTransaction(async (tx) => {
      const statsRef = db.collection("campaign_stats_public").doc(campaignId);
      const statsSnap = await tx.get(statsRef);
      
      let currentTotal = "0";
      let goalInr = "0";
      let goalMet = false;

      if (statsSnap.exists) {
        const stats = statsSnap.data() as CampaignStatsPublicDoc;
        currentTotal = stats.totalInrLive || "0";
        goalInr = stats.goalInr || "0";
        goalMet = stats.goalMet || false;
      } else {
        // Fallback to campaign doc
        const campaignRef = db.collection("campaigns").doc(campaignId);
        const campaignSnap = await tx.get(campaignRef);
        if (campaignSnap.exists) {
          const campaign = campaignSnap.data() as any;
          goalInr = campaign.goalInr || "0";
          currentTotal = campaign.raisedInr || "0";
          goalMet = BigInt(currentTotal) >= BigInt(goalInr);
        }
      }

      return { goalMet, currentTotal };
    });
  }

  /**
   * Update campaign stats public (compute from donations)
   */
  async updateCampaignStatsPublic(campaignId: string): Promise<void> {
    // This will be called by worker after donation is confirmed
    // For now, we compute from campaign doc as fallback
    const db = admin.firestore();
    const campaignSnap = await db.collection("campaigns").doc(campaignId).get();
    
    if (!campaignSnap.exists) {
      return;
    }

    const campaign = campaignSnap.data() as any;
    const goalInr = BigInt(campaign.goalInr || "0");
    const raisedInr = BigInt(campaign.raisedInr || "0");
    
    const stats: CampaignStatsPublicDoc = {
      campaignId,
      goalInr: campaign.goalInr || "0",
      totalInrLive: campaign.raisedInr || "0", // TODO: Compute from donations + live prices
      totalsByAsset: {}, // TODO: Aggregate from donations_public
      percent: goalInr > 0n ? Number((raisedInr * 10000n) / goalInr) / 100 : 0,
      goalMet: raisedInr >= goalInr,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    await this.repo.createOrUpdateCampaignStatsPublic(campaignId, stats);
  }

  private mapStatus(status: string): "DRAFT" | "LIVE" | "PAUSED" | "GOAL_MET" | "CLOSED" {
    switch (status) {
      case "ACTIVE":
        return "LIVE";
      case "GOAL_MET":
        return "GOAL_MET";
      case "PAUSED":
        return "PAUSED";
      case "COMPLETED":
      case "CANCELLED":
        return "CLOSED";
      default:
        return "DRAFT";
    }
  }
}






