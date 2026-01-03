import { Injectable } from "@nestjs/common";
import { FirebaseService } from "../firebase/firebase.service";
import * as admin from "firebase-admin";

@Injectable()
export class StatsService {
  constructor(private firebase: FirebaseService) {}

  /**
   * Calculate campaign raised amount from donations (same logic as featured campaigns)
   * Uses the same query logic as the donations-public endpoint
   * If calculation succeeds, update campaign.raisedInr with the calculated value
   * Returns the raised amount in rupees
   */
  private async calculateAndUpdateCampaignRaised(campaign: any, db: admin.firestore.Firestore): Promise<number> {
    try {
      // Use the same query logic as the donations-public endpoint
      const campaignDonationsRef = db
        .collection("donations_public")
        .doc(campaign.id)
        .collection("items");
      
      let donations: any[] = [];
      
      try {
        // Try to get donations with orderBy (same as endpoint)
        const publicDonationsSnap = await campaignDonationsRef
          .orderBy("createdAt", "desc")
          .limit(200)
          .get();
        
        if (!publicDonationsSnap.empty) {
          donations = publicDonationsSnap.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              donationId: doc.id,
              ...data,
            };
          });
        }
      } catch (indexError: any) {
        // If index doesn't exist, try without orderBy
        console.warn(`[Stats] Index error for donations_public, trying without orderBy:`, indexError.message);
        const publicDonationsSnap = await campaignDonationsRef.get();
        donations = publicDonationsSnap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            donationId: doc.id,
            ...data,
          };
        });
      }
      
      // Always also check legacy donations collection to ensure we get all donations
      // Some donations might only be in legacy collection
      console.log(`[Stats] Campaign ${campaign.id}: Found ${donations.length} in donations_public, checking legacy donations...`);
      const legacyDonations = await db.collection("donations")
        .where("campaignId", "==", campaign.id)
        .limit(200)
        .get();
      
      const existingDonationIds = new Set(donations.map(d => d.donationId || d.id));
      
      // Add legacy donations that aren't already in donations_public
      for (const doc of legacyDonations.docs) {
        if (existingDonationIds.has(doc.id)) continue;
        
        const data = doc.data();
        if (data.type === "INR") {
          const amountInr = parseFloat(data.amount || "0");
          if (amountInr > 0 && data.orderId) {
            donations.push({
              donationId: doc.id,
              type: "INR",
              verified: true,
              amountNative: amountInr.toString(),
              inrAtConfirm: amountInr.toString(),
            });
          }
        } else if (data.txHash) {
          // For crypto, use amountInr if available, otherwise calculate from amountUsd
          let inrAtConfirm = "0";
          if (data.amountInr) {
            inrAtConfirm = parseFloat(data.amountInr).toFixed(2);
          } else if (data.amountUsd) {
            const usdValue = parseFloat(data.amountUsd);
            if (usdValue > 0) {
              inrAtConfirm = (usdValue * 83).toFixed(2);
            }
          }
          if (parseFloat(inrAtConfirm) > 0) {
            donations.push({
              donationId: doc.id,
              type: "CRYPTO",
              verified: true,
              amountNative: data.amountNative || "0",
              inrAtConfirm,
            });
          }
        }
      }
      
      console.log(`[Stats] Campaign ${campaign.id}: Total donations after merging legacy: ${donations.length}`);
      
      console.log(`[Stats] Campaign ${campaign.id}: Got ${donations.length} donations from endpoint`);
      
      // Log first donation structure for debugging
      if (donations.length > 0) {
        const firstDonation = donations[0];
        console.log(`[Stats] Campaign ${campaign.id}: Sample donation:`, {
          id: firstDonation.id || firstDonation.donationId,
          verified: firstDonation.verified,
          verifiedOnChain: firstDonation.verifiedOnChain,
          type: firstDonation.type,
          hasInrAtConfirm: !!firstDonation.inrAtConfirm,
          inrAtConfirm: firstDonation.inrAtConfirm,
          amountNative: firstDonation.amountNative,
          assetSymbol: firstDonation.assetSymbol,
        });
      }
      
      // Calculate sum of inrAtConfirm from verified donations (EXACT same logic as featured campaigns)
      let processedCount = 0;
      let skippedCount = 0;
      const donationsTotal = donations.reduce((sum: number, donation: any, index: number) => {
        // EXACT same check as featured campaigns: if (!donation.verified) return sum;
        if (!donation.verified) {
          skippedCount++;
          if (index < 3) {
            console.log(`[Stats] Campaign ${campaign.id}: Skipping unverified donation ${donation.id || donation.donationId}`);
          }
          return sum;
        }
        
        if (donation.type === "INR") {
          // EXACT same logic as featured campaigns
          const amount = parseFloat(donation.amountNative || "0");
          if (amount > 0) {
            processedCount++;
            return sum + amount;
          }
        }
        
        // For crypto donations: ALWAYS use inrAtConfirm (EXACT same as featured campaigns)
        if (donation.inrAtConfirm && parseFloat(donation.inrAtConfirm) > 0) {
          processedCount++;
          return sum + parseFloat(donation.inrAtConfirm);
        } else {
          skippedCount++;
          if (index < 3) {
            // Log first 3 donations missing inrAtConfirm for debugging
            console.log(`[Stats] Campaign ${campaign.id}: Donation ${donation.id || donation.donationId} missing inrAtConfirm:`, {
              hasInrAtConfirm: !!donation.inrAtConfirm,
              inrAtConfirm: donation.inrAtConfirm,
              type: donation.type,
              amountUsd: donation.amountUsd,
              amountNative: donation.amountNative,
              assetSymbol: donation.assetSymbol,
            });
          }
        }
        
        return sum;
      }, 0);
      
      // Log detailed breakdown
      const inrDonations = donations.filter(d => d.type === "INR" && d.verified);
      const cryptoDonations = donations.filter(d => d.type === "CRYPTO" && d.verified && d.inrAtConfirm);
      const inrTotal = inrDonations.reduce((sum, d) => sum + parseFloat(d.amountNative || "0"), 0);
      const cryptoTotal = cryptoDonations.reduce((sum, d) => sum + parseFloat(d.inrAtConfirm || "0"), 0);
      
      console.log(`[Stats] Campaign ${campaign.id}: Breakdown - ${inrDonations.length} INR donations (₹${inrTotal.toFixed(2)}), ${cryptoDonations.length} crypto donations with inrAtConfirm (₹${cryptoTotal.toFixed(2)}), Total: ₹${donationsTotal.toFixed(2)}`);
      console.log(`[Stats] Campaign ${campaign.id}: Calculated ₹${donationsTotal.toFixed(2)} from ${donations.length} donations (${processedCount} processed, ${skippedCount} skipped), current campaign.raisedInr: ₹${(parseInt(campaign.raisedInr || "0") / 100).toFixed(2)}`);
      
      // If we successfully calculated from donations and it's > 0, update campaign.raisedInr
      if (donationsTotal > 0) {
        const newRaisedInrPaise = Math.round(donationsTotal * 100);
        const currentRaisedInr = parseInt(campaign.raisedInr || "0");
        
        // Only update if different (to avoid unnecessary writes)
        if (newRaisedInrPaise !== currentRaisedInr) {
          try {
            await db.collection("campaigns").doc(campaign.id).update({
              raisedInr: newRaisedInrPaise.toString(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`[Stats] ✅ Updated campaign ${campaign.id} raisedInr: ${currentRaisedInr} -> ${newRaisedInrPaise} paise (₹${donationsTotal.toFixed(2)})`);
          } catch (updateError) {
            console.error(`[Stats] ❌ Failed to update campaign ${campaign.id} raisedInr:`, updateError);
          }
        } else {
          console.log(`[Stats] Campaign ${campaign.id} raisedInr already up to date: ${newRaisedInrPaise} paise`);
        }
        
        return donationsTotal;
      }
      
      // Fallback to campaign.raisedInr / 100 if no donations or calculation failed
      console.log(`[Stats] Campaign ${campaign.id}: Using fallback campaign.raisedInr: ₹${(parseInt(campaign.raisedInr || "0") / 100).toFixed(2)}`);
      return parseInt(campaign.raisedInr || "0") / 100;
    } catch (error) {
      // If endpoint fails, fallback to campaign.raisedInr / 100
      console.error(`[Stats] ❌ Error calculating raised for campaign ${campaign.id}:`, error);
      return parseInt(campaign.raisedInr || "0") / 100;
    }
  }

  async getPlatformStats() {
    try {
      // Get all campaigns
      const campaigns = await this.firebase.queryAll("campaigns");
      const activeCampaigns = campaigns.filter((c: any) => c.status === "ACTIVE");
      
      const db = this.firebase.firestore;
      let totalRaisedPaise = 0;
      let allDonations: any[] = [];
      
      // Calculate total raised the same way as featured campaigns component
      // For each campaign: calculate from donations, update campaign.raisedInr if successful, use as fallback
      for (const campaign of campaigns) {
        const campaignRaisedRupees = await this.calculateAndUpdateCampaignRaised(campaign, db);
        
        // Convert to paise and add to total
        totalRaisedPaise += Math.round(campaignRaisedRupees * 100);
        
        // Also collect donations for counts
        try {
          const campaignDonationsRef = db
            .collection("donations_public")
            .doc(campaign.id)
            .collection("items");
          const campaignDonationsSnap = await campaignDonationsRef.get();
          const donations = campaignDonationsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          allDonations = [...allDonations, ...donations];
        } catch (error) {
          // Ignore errors for donation collection
        }
      }
      
      // Also get donations from donations collection for totalDonations count
      try {
        const legacyDonations = await this.firebase.queryAll("donations");
        allDonations = [...allDonations, ...legacyDonations];
      } catch (error) {
        console.warn("[Stats] Failed to fetch donations collection:", error);
      }
      
      console.log(`[Stats] Total raised: ${totalRaisedPaise} paise (₹${(totalRaisedPaise / 100).toFixed(2)}) from ${campaigns.length} campaigns`);
      
      // Get verified organizers (users with KYC_VERIFIED status and organizer roles)
      const allUsers = await this.firebase.queryAll("users");
      const verifiedOrganizers = allUsers.filter((u: any) => 
        (u.role === "INDIVIDUAL_ORGANIZER" || u.role === "NGO_ORGANIZER") &&
        u.kycStatus === "VERIFIED"
      );

      return {
        activeCampaigns: activeCampaigns.length,
        totalCampaigns: campaigns.length,
        totalDonations: allDonations.length,
        totalRaised: totalRaisedPaise.toString(), // In paise
        verifiedOrganizers: verifiedOrganizers.length,
        totalDonors: new Set(allDonations.map((d: any) => d.donorId || d.donorLabel)).size,
      };
    } catch (error) {
      console.error("Error fetching platform stats:", error);
      return {
        activeCampaigns: 0,
        totalCampaigns: 0,
        totalDonations: 0,
        totalRaised: "0",
        verifiedOrganizers: 0,
        totalDonors: 0,
      };
    }
  }
}
