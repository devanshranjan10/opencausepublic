import { Injectable } from "@nestjs/common";
import { FirebaseService } from "../firebase/firebase.service";
import { FxRateService } from "../crypto/fx-rate.service";
import * as admin from "firebase-admin";

export interface AssetBalance {
  assetSymbol: string;
  networkId?: string;
  assetId?: string;
  amountNative: string; // Decimal string
  amountRaw?: string; // Raw amount (for crypto)
  decimals?: number;
  inrValue?: string; // INR value at current prices
}

export interface CampaignBalanceBreakdown {
  campaignId: string;
  totalInr: string;
  assets: AssetBalance[];
  // Network fee estimates (in native token)
  networkFees: {
    ethereum?: string;
    bsc?: string;
    polygon?: string;
    solana?: string;
    [networkId: string]: string | undefined;
  };
}

@Injectable()
export class CampaignBalanceService {
  constructor(
    private firebase: FirebaseService,
    private fxRate: FxRateService
  ) {}

  /**
   * Get campaign balance breakdown by asset
   */
  async getCampaignBalance(campaignId: string): Promise<CampaignBalanceBreakdown> {
    const db = admin.firestore();
    
    // Get all donations for this campaign from donations_public
    const donationsRef = db
      .collection("donations_public")
      .doc(campaignId)
      .collection("items");
    
    const donationsSnap = await donationsRef.get();
    
    // Aggregate by asset
    const assetMap = new Map<string, AssetBalance>();
    let totalInr = BigInt(0);
    
    for (const doc of donationsSnap.docs) {
      const donation = doc.data() as any;
      
      // Skip pending/unconfirmed donations
      if (donation.verified === false) {
        continue;
      }
      
      // Handle INR donations separately (no assetSymbol/networkId)
      if (donation.type === "INR") {
        const amount = parseFloat(donation.amountNative || "0");
        if (amount > 0) {
          const inrKey = "INR";
          if (!assetMap.has(inrKey)) {
            assetMap.set(inrKey, {
              assetSymbol: "INR",
              amountNative: "0",
            });
          }
          const balance = assetMap.get(inrKey)!;
          const currentAmount = parseFloat(balance.amountNative || "0");
          balance.amountNative = (currentAmount + amount).toFixed(2);
          totalInr += BigInt(Math.round(amount * 100)); // Convert to paise
        }
        continue;
      }
      
      // Handle crypto donations
      const assetKey = donation.assetSymbol || "UNKNOWN";
      const networkKey = donation.networkId || "";
      const fullKey = networkKey ? `${assetKey}_${networkKey}` : assetKey;
      
      if (!assetMap.has(fullKey)) {
        assetMap.set(fullKey, {
          assetSymbol: donation.assetSymbol || "UNKNOWN",
          networkId: donation.networkId,
          assetId: donation.assetId,
          amountNative: "0",
          decimals: donation.decimals,
        });
      }
      
      const balance = assetMap.get(fullKey)!;
      const amount = parseFloat(donation.amountNative || "0");
      if (amount > 0) {
        const currentAmount = parseFloat(balance.amountNative || "0");
        balance.amountNative = (currentAmount + amount).toFixed(8);
        // Don't add to totalInr here - we'll calculate from USD prices at the end
      }
    }
    
    // Also check legacy donations collection
    const legacyDonationsSnap = await db
      .collection("donations")
      .where("campaignId", "==", campaignId)
      .get();
    
    for (const doc of legacyDonationsSnap.docs) {
      const donation = doc.data() as any;
      
      if (donation.type === "INR") {
        const amount = parseFloat(donation.amount || "0");
        if (amount > 0) {
          const inrKey = "INR";
          if (!assetMap.has(inrKey)) {
            assetMap.set(inrKey, {
              assetSymbol: "INR",
              amountNative: "0",
            });
          }
          const balance = assetMap.get(inrKey)!;
          const currentAmount = parseFloat(balance.amountNative || "0");
          balance.amountNative = (currentAmount + amount).toFixed(2);
          totalInr += BigInt(Math.round(amount * 100));
        }
      } else if (donation.amountNative) {
        const assetSymbol = donation.tokenType || "CRYPTO";
        const networkId = donation.networkId || "";
        const fullKey = networkId ? `${assetSymbol}_${networkId}` : assetSymbol;
        
        if (!assetMap.has(fullKey)) {
          assetMap.set(fullKey, {
            assetSymbol,
            networkId,
            amountNative: "0",
          });
        }
        
        const balance = assetMap.get(fullKey)!;
        const amount = parseFloat(donation.amountNative || "0");
        if (amount > 0) {
          const currentAmount = parseFloat(balance.amountNative || "0");
          balance.amountNative = (currentAmount + amount).toFixed(8);
          
          if (donation.amountUsd) {
            // Convert USD to INR (83 INR per USD)
            const inrValue = parseFloat(donation.amountUsd) * 83;
            totalInr += BigInt(Math.round(inrValue * 100));
          }
        }
      }
    }
    
    // Calculate USD values for crypto assets (don't double count in totalInr)
    const assetsArray = Array.from(assetMap.values());
    let cryptoTotalInr = BigInt(0);
    for (const asset of assetsArray) {
      if (asset.assetSymbol !== "INR" && asset.amountNative) {
        try {
          // Get USD rate for the asset
          const coingeckoId = this.getCoinGeckoId(asset.assetSymbol);
          if (coingeckoId) {
            const usdRate = await this.fxRate.getRate(coingeckoId);
            const amount = parseFloat(asset.amountNative);
            const usdValue = amount * parseFloat(usdRate);
            asset.inrValue = (usdValue * 83).toFixed(2); // Convert USD to INR
            cryptoTotalInr += BigInt(Math.round(usdValue * 83 * 100));
          }
        } catch (error) {
          console.warn(`Failed to get price for ${asset.assetSymbol}:`, error);
        }
      }
    }

    // Also get campaign doc to check raisedInr for verification
    const campaignSnap = await db.collection("campaigns").doc(campaignId).get();
    const campaignData = campaignSnap.exists ? campaignSnap.data() : null;
    
    // Recalculate total: INR donations + crypto (from USD prices)
    const finalCalculatedTotal = totalInr + cryptoTotalInr;

    // Get network fee estimates (in native token units)
    const networkFees: CampaignBalanceBreakdown["networkFees"] = {
      ethereum_mainnet: "0.001", // ~$2-5 at current gas prices (ETH)
      bsc_mainnet: "0.0005", // ~$0.10-0.50 (BNB)
      polygon_mainnet: "0.1", // ~$0.01-0.10 (MATIC)
      solana_mainnet: "0.000005", // ~$0.0001 (SOL)
      ethereum: "0.001",
      bsc: "0.0005",
      polygon: "0.1",
      solana: "0.000005",
    };
    
    // Use campaign.raisedInr if available (as it's the source of truth)
    let finalTotalInr = (Number(finalCalculatedTotal) / 100).toFixed(2);
    if (campaignData?.raisedInr) {
      const campaignRaised = parseFloat(String(campaignData.raisedInr));
      // Use campaign raisedInr as it's the source of truth
      finalTotalInr = campaignRaised.toFixed(2);
    }
    
    return {
      campaignId,
      totalInr: finalTotalInr,
      assets: assetsArray,
      networkFees,
    };
  }

  private getCoinGeckoId(symbol: string): string | null {
    const symbolLower = symbol.toLowerCase();
    const mapping: Record<string, string> = {
      btc: "bitcoin",
      eth: "ethereum",
      usdt: "tether",
      usdc: "usd-coin",
      bnb: "binancecoin",
      sol: "solana",
      matic: "matic-network",
      ltc: "litecoin",
      doge: "dogecoin",
      bch: "bitcoin-cash",
      xrp: "ripple",
      ada: "cardano",
      avax: "avalanche-2",
    };
    return mapping[symbolLower] || null;
  }
}

