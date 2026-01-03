import { Controller, Get, Post, Body, Param, Query, Request, HttpException, HttpStatus } from "@nestjs/common";
import { PaymentIntentsService, CreatePaymentIntentDto } from "./payment-intents.service";
import { FirestoreRepository } from "@opencause/firebase";
import { FirebaseService } from "../firebase/firebase.service";
import { getEnabledNetworks, getAssetsByNetwork, getEnabledAssets, getAsset, getNetwork } from "@opencause/crypto-core";
import { FxRateService } from "./fx-rate.service";
import { CryptoVerificationService } from "./crypto-verification.service";
import { CryptoVerifyService } from "./crypto-verify.service";
import { CampaignPublicService } from "./campaign-public.service";
import * as admin from "firebase-admin";

@Controller("crypto")
export class CryptoNewController {
  constructor(
    private firebase: FirebaseService,
    private paymentIntents: PaymentIntentsService,
    private fxRate: FxRateService,
    private verificationService: CryptoVerificationService,
    private cryptoVerify: CryptoVerifyService,
    private campaignPublic: CampaignPublicService
  ) {}

  private get repo(): FirestoreRepository {
    return new FirestoreRepository(this.firebase.firestore);
  }

  /**
   * GET /crypto/networks
   * Get all enabled networks (from crypto-core registry)
   */
  @Get("networks")
  async getNetworks() {
    // Use crypto-core registry directly, not Firestore
    return getEnabledNetworks();
  }

  /**
   * GET /crypto/assets?networkId=...
   * Get assets by network (from crypto-core registry)
   */
  @Get("assets")
  async getAssets(@Query("networkId") networkId?: string) {
    // Use crypto-core registry directly, not Firestore
    if (networkId) {
      return getAssetsByNetwork(networkId);
    }
    return getEnabledAssets();
  }

  /**
   * POST /crypto/payment-intents
   * Create a payment intent
   */
  @Post("payment-intents")
  async createPaymentIntent(@Request() req: any, @Body() body: CreatePaymentIntentDto) {
    try {
      const userId = req.user?.id; // Optional auth (allows guests)
      return await this.paymentIntents.createIntent(body, userId);
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      console.error("Error stack:", error.stack);
      // Return error details in development
      if (process.env.NODE_ENV !== "production") {
        throw {
          statusCode: 500,
          message: error.message || "Internal server error",
          error: error.stack,
        };
      }
      throw error;
    }
  }

  /**
   * GET /payment-intents/:intentId
   * Get payment intent status
   */
  @Get("payment-intents/:intentId")
  async getPaymentIntent(@Param("intentId") intentId: string) {
    try {
      const intent = await this.paymentIntents.getIntent(intentId);
      if (!intent) {
        return { error: "Payment intent not found" };
      }
      return intent;
    } catch (error: any) {
      console.error("Error getting payment intent:", error);
      console.error("Error stack:", error.stack);
      if (process.env.NODE_ENV !== "production") {
        throw {
          statusCode: 500,
          message: error.message || "Internal server error",
          error: error.stack,
        };
      }
      throw error;
    }
  }

  /**
   * GET /crypto/fx-rate?assetId=...
   * Get FX rate for an asset (USD per unit)
   */
  @Get("fx-rate")
  async getFxRate(@Query("assetId") assetId: string, @Query("coingeckoId") coingeckoId?: string) {
    if (!assetId) {
      return { error: "assetId is required" };
    }
    
    // Get asset to find coingecko ID
    const asset = getAsset(assetId);
    const coingeckoIdToUse = coingeckoId || asset?.coingeckoId || assetId;
    
    const rate = await this.fxRate.getRate(coingeckoIdToUse);
    return { assetId, coingeckoId: coingeckoIdToUse, rate, timestamp: Date.now() };
  }

  /**
   * GET /crypto/fx-rates?assetIds=...
   * Get FX rates for multiple assets
   */
  @Get("fx-rates")
  async getFxRates(@Query("assetIds") assetIds: string) {
    if (!assetIds) {
      return { error: "assetIds is required (comma-separated)" };
    }
    
    const ids = assetIds.split(",").map(id => id.trim());
    const rates: Record<string, string> = {};
    
    // Fetch rates for all assets
    await Promise.all(ids.map(async (assetId) => {
      try {
        const asset = getAsset(assetId);
        const coingeckoId = asset?.coingeckoId || assetId;
        rates[assetId] = await this.fxRate.getRate(coingeckoId);
      } catch (error) {
        console.error(`Failed to fetch rate for ${assetId}:`, error);
        rates[assetId] = "0";
      }
    }));
    
    return { rates, timestamp: Date.now() };
  }

  /**
   * POST /crypto/verify-transaction
   * Verify a transaction with confirmation checking
   */
  @Post("verify-transaction")
  async verifyTransaction(@Body() body: {
    txHash: string;
    networkId: string;
    assetId: string;
    expectedAmount?: string;
    expectedAddress?: string;
    minConfirmations?: number;
  }) {
    try {
      const result = await this.verificationService.verifyTransaction(
        body.txHash,
        body.networkId,
        body.assetId,
        body.expectedAmount,
        body.expectedAddress,
        body.minConfirmations || 2
      );
      return result;
    } catch (error: any) {
      console.error("Error verifying transaction:", error);
      console.error("Error stack:", error.stack);
      return {
        verified: false,
        confirmations: 0,
        error: error.message || "Transaction verification failed",
      };
    }
  }

  /**
   * POST /crypto/verify-intent
   * Verify transaction for payment intent (new chain-truth endpoint)
   * This uses intent-based verification and stores chain amounts only
   */
  @Post("verify-intent")
  async verifyIntent(@Body() body: { intentId: string; txHash: string }) {
    if (!body.intentId || !body.txHash) {
      throw new HttpException(
        { message: "intentId and txHash are required", error: "Bad Request" },
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      const result = await this.cryptoVerify.verifyIntentTx(body.intentId, body.txHash);
      return result;
    } catch (error: any) {
      console.error("Intent verification error:", error);
      
      // If it's already a NestJS exception, rethrow it
      if (error.status && error.message) {
        throw error;
      }
      
      // Otherwise, wrap it in an HttpException
      throw new HttpException(
        { message: error.message || "Verification failed", error: "Verification Error" },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * GET /crypto/payment-intents/:intentId/check
   * Check if a payment intent has been fulfilled (auto-detect transaction)
   * This endpoint checks on-chain for transactions to the deposit address
   */
  @Get("payment-intents/:intentId/check")
  async checkPaymentIntent(@Param("intentId") intentId: string) {
    try {
      const intent = await this.paymentIntents.getIntent(intentId);
      if (!intent) {
        return { found: false, error: "Payment intent not found" };
      }

      // If already confirmed, return the status
      if (intent.status === "CONFIRMED" && intent.confirmedTxHash) {
        return {
          found: true,
          intentId: intent.intentId,
          status: intent.status,
          depositAddress: intent.depositAddress,
          txHash: intent.confirmedTxHash,
        };
      }

      // Check on-chain for transactions (only for EVM networks)
      const network = getNetwork(intent.networkId);
      if (network && network.type === "EVM" && intent.startBlock) {
        try {
          const detectedTx = await this.cryptoVerify.detectTransactionOnChain(
            intentId,
            intent.depositAddress,
            intent.networkId,
            intent.assetId,
            intent.startBlock
          );
          
          if (detectedTx) {
            return {
              found: true,
              intentId: intent.intentId,
              status: "DETECTED",
              depositAddress: intent.depositAddress,
              txHash: detectedTx.txHash,
            };
          }
        } catch (detectError) {
          console.error("Error detecting transaction on-chain:", detectError);
          // Continue to return current status even if detection fails
        }
      }

      // Return current status
      return {
        found: true,
        intentId: intent.intentId,
        status: intent.status,
        depositAddress: intent.depositAddress,
      };
    } catch (error: any) {
      console.error("Error checking payment intent:", error);
      console.error("Error stack:", error.stack);
      return {
        found: false,
        error: error.message || "Internal server error",
      };
    }
  }

  /**
   * GET /crypto/campaigns/:campaignId/donations-public
   * Get public donations for a campaign (no auth required)
   * Falls back to legacy donations collection if public collection is empty
   */
  @Get("campaigns/:campaignId/donations-public")
  async getCampaignDonationsPublic(@Param("campaignId") campaignId: string) {
    try {
      const db = this.firebase.firestore;
      
      // Read from new donations_public collection structure
      const publicDonationsRef = db
        .collection("donations_public")
        .doc(campaignId)
        .collection("items");
      
      try {
        const publicDonationsSnap = await publicDonationsRef
          .orderBy("createdAt", "desc")
          .limit(200)
          .get();
        
        if (!publicDonationsSnap.empty) {
          // First, collect all donation IDs that might need fixing
          const donationsToFix: Array<{ doc: admin.firestore.QueryDocumentSnapshot, data: any }> = [];
          const donationsData = publicDonationsSnap.docs.map((doc) => {
            const data = doc.data();
            const amountNativeNum = parseFloat(data.amountNative || "0");
            const inrAtConfirmNum = parseFloat(data.inrAtConfirm || "0");
            
            // Check if inrAtConfirm seems wrong (for crypto, it should be much larger than amountNative)
            // For example, 0.01 LTC should be ~₹73, not ₹0.83
            // Threshold: if inrAtConfirm is less than amountNative * 1000, it's likely wrong
            // (0.01 LTC * 1000 = 10, so 0.83 < 10 means it's wrong)
            if (data.type === "CRYPTO" && amountNativeNum > 0) {
              const threshold = amountNativeNum * 1000;
              if (inrAtConfirmNum > 0 && inrAtConfirmNum < threshold) {
                // inrAtConfirm exists but seems too small
                console.log(`[DonationsPublic] Donation ${doc.id} flagged for fix: inrAtConfirm=${inrAtConfirmNum} < threshold=${threshold} (amountNative=${amountNativeNum})`);
                donationsToFix.push({ doc, data });
              } else if (!data.inrAtConfirm || inrAtConfirmNum === 0) {
                // inrAtConfirm is missing
                console.log(`[DonationsPublic] Donation ${doc.id} flagged for fix: missing inrAtConfirm`);
                donationsToFix.push({ doc, data });
              }
            }
            return { doc, data };
          });
          
          // Fix donations that have incorrect inrAtConfirm - MUST complete before mapping
          if (donationsToFix.length > 0) {
            console.log(`[DonationsPublic] Found ${donationsToFix.length} donations with suspicious inrAtConfirm, checking legacy donations...`);
            const fixResults = await Promise.all(
              donationsToFix.map(async ({ doc, data }) => {
                try {
                  // Try to find legacy donation by ID first
                  let legacyDonation = await db.collection("donations").doc(doc.id).get();
                  
                  // Extract txHash from explorerUrl if not in data
                  let txHash = data.txHash;
                  if (!txHash && data.explorerUrl) {
                    const match = data.explorerUrl.match(/\/(?:tx|transaction)\/([0-9a-fA-F]+)/);
                    if (match) {
                      txHash = match[1];
                    }
                  }
                  
                  // If not found by ID, try to find by txHash (for crypto donations)
                  if (!legacyDonation.exists && txHash) {
                    const txHashQuery = await db.collection("donations")
                      .where("txHash", "==", txHash)
                      .where("campaignId", "==", campaignId)
                      .limit(1)
                      .get();
                    
                    if (!txHashQuery.empty) {
                      legacyDonation = txHashQuery.docs[0];
                      console.log(`[DonationsPublic] Found legacy donation by txHash ${txHash}: ${legacyDonation.id}`);
                    }
                  }
                  
                  // Also try searching by amountNative, assetSymbol, and campaignId as last resort
                  if (!legacyDonation.exists && data.amountNative && data.assetSymbol) {
                    const amountQuery = await db.collection("donations")
                      .where("campaignId", "==", campaignId)
                      .where("amountNative", "==", data.amountNative)
                      .where("tokenType", "==", data.assetSymbol)
                      .limit(10)
                      .get();
                    
                    if (!amountQuery.empty) {
                      // Find the one with matching txHash if available, or just use the first one
                      const matching = amountQuery.docs.find(d => {
                        const dData = d.data();
                        return txHash && dData.txHash === txHash;
                      }) || amountQuery.docs[0];
                      
                      if (matching) {
                        legacyDonation = matching;
                        console.log(`[DonationsPublic] Found legacy donation by amount/asset: ${legacyDonation.id}`);
                      }
                    }
                  }
                  
                  let fixedInr = data.inrAtConfirm; // Default to current value
                  
                  if (legacyDonation.exists) {
                    const legacyData = legacyDonation.data();
                    if (legacyData?.amountInr && parseFloat(legacyData.amountInr) > 0) {
                      // Use the exact stored amountInr value (at time of donation)
                      fixedInr = parseFloat(legacyData.amountInr).toFixed(2);
                      console.log(`[DonationsPublic] ✅ Fixed donation ${doc.id} inrAtConfirm: ${data.inrAtConfirm} -> ${fixedInr} (from legacy donation ${legacyDonation.id})`);
                    } else if (legacyData?.amountUsd && parseFloat(legacyData.amountUsd) > 0) {
                      // Fallback: calculate from amountUsd if amountInr is not available
                      const usdValue = parseFloat(legacyData.amountUsd);
                      // Check if amountUsd seems reasonable (should be around 0.88 for 0.01 LTC)
                      if (usdValue > 0.1 && usdValue < 100) {
                        fixedInr = (usdValue * 83).toFixed(2);
                        console.log(`[DonationsPublic] ✅ Fixed donation ${doc.id} inrAtConfirm: ${data.inrAtConfirm} -> ${fixedInr} (calculated from legacy amountUsd: $${usdValue})`);
                      }
                    } else {
                      console.log(`[DonationsPublic] ⚠️ Legacy donation ${legacyDonation.id} found but no amountInr or valid amountUsd`);
                    }
                  } else {
                    console.log(`[DonationsPublic] ⚠️ No legacy donation found for ${doc.id} (txHash: ${data.txHash})`);
                  }
                  
                  return { docId: doc.id, fixedInr };
                } catch (error) {
                  console.error(`[DonationsPublic] ❌ Error fixing donation ${doc.id}:`, error);
                  return { docId: doc.id, fixedInr: data.inrAtConfirm };
                }
              })
            );
            
            // Apply fixes to the data objects
            const fixMap = new Map(fixResults.map(r => [r.docId, r.fixedInr]));
            console.log(`[DonationsPublic] Fix map:`, Array.from(fixMap.entries()));
            donationsData.forEach(({ doc, data }) => {
              if (fixMap.has(doc.id)) {
                const oldValue = data.inrAtConfirm;
                data.inrAtConfirm = fixMap.get(doc.id)!;
                console.log(`[DonationsPublic] Applied fix to donation ${doc.id}: ${oldValue} -> ${data.inrAtConfirm}`);
              }
            });
          }
          
          const donations = donationsData.map(({ doc, data }) => {
            // Always regenerate explorer URL based on assetSymbol to ensure correct blockchain
            let explorerUrl = data.explorerUrl;
            if (data.assetSymbol) {
              const symbol = data.assetSymbol.toUpperCase();
              // Try to get txHash from various sources
              let txHash = data.txHash;
              if (!txHash && data.explorerUrl) {
                // Extract hash from existing explorerUrl (format: .../tx/HASH or .../transaction/HASH)
                const match = data.explorerUrl.match(/\/(?:tx|transaction)\/([0-9a-fA-F]+)/);
                if (match) {
                  txHash = match[1];
                }
              }
              
              if (txHash) {
                const cleanHash = txHash.replace(/^0x/i, "");
                if (symbol === "LTC") {
                  explorerUrl = `https://blockchair.com/litecoin/transaction/${cleanHash}`;
                } else if (symbol === "BTC") {
                  explorerUrl = `https://blockchair.com/bitcoin/transaction/${cleanHash}`;
                } else if (symbol === "SOL") {
                  explorerUrl = `https://solscan.io/tx/${txHash}`;
                }
                // For other assets (ETH, USDT, USDC, etc.), keep existing explorerUrl
              }
            }
            
            // Use the corrected inrAtConfirm value (data.inrAtConfirm was updated in the Promise.all above)
            // This ensures we use the exact value stored at donation time, not a recalculated value
            return {
              ...data,
              donationId: doc.id,
              explorerUrl, // Override with corrected URL
              inrAtConfirm: data.inrAtConfirm, // Use corrected value (fixed above if needed)
            };
          })
            .filter((donation: any) => {
              // Hard filter: only verified donations with valid amounts
              if (!donation.verified) return false;
              
              // Filter out 0 amounts
              if (donation.type === "CRYPTO") {
                const amountNative = parseFloat(donation.amountNative || "0");
                const amountRaw = parseFloat(donation.amountRaw || "0");
                if (amountNative <= 0 && amountRaw <= 0) return false;
              } else if (donation.type === "INR") {
                const amountInrPaise = parseFloat(donation.amountInrPaise || "0");
                const amountNative = parseFloat(donation.amountNative || "0");
                if (amountInrPaise <= 0 && amountNative <= 0) return false;
              }
              
              // Must have createdAt
              if (!donation.createdAt) return false;
              
              return true;
            });
          
          // Deduplicate by donationId
          const seen = new Map<string, any>();
          for (const donation of donations) {
            if (!seen.has(donation.donationId)) {
              seen.set(donation.donationId, donation);
            }
          }
          
          // Sort by createdAt DESC
          const sorted = Array.from(seen.values()).sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
            const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
            return bTime - aTime;
          });
          
          return sorted;
        }
      } catch (indexError: any) {
        // If index doesn't exist, fall back to legacy query
        console.warn("Index error for donations_public, falling back to legacy:", indexError.message);
      }

      // Fallback: read from legacy donations collection and transform
      // Use simpler query without compound where+orderBy to avoid index requirement
      const legacyDonations = await db.collection("donations")
        .where("campaignId", "==", campaignId)
        .limit(200) // Get more to ensure we don't miss any
        .get();
      
      // Include ALL donations (both CRYPTO and INR) and sort in memory
      const allDonations = legacyDonations.docs
        .sort((a, b) => {
          const aTime = a.data().createdAt?.toMillis?.() || a.data().createdAt?.seconds * 1000 || 0;
          const bTime = b.data().createdAt?.toMillis?.() || b.data().createdAt?.seconds * 1000 || 0;
          return bTime - aTime; // Descending (newest first)
        });

      const transformed = await Promise.all(
        allDonations.map(async (doc) => {
          const data = doc.data();
          
          // Handle INR donations
          if (data.type === "INR") {
            const amountInr = parseFloat(data.amount || "0");
            // Skip 0 amount donations
            if (amountInr <= 0) return null;
            // Skip unverified donations
            if (!data.orderId) return null;
            
            return {
              donationId: doc.id,
              campaignId: data.campaignId,
              type: "INR",
              donorLabel: data.guestName || "Anonymous",
              isAnonymous: !data.guestName,
              assetSymbol: "INR",
              amountNative: amountInr.toString(),
              amountInrPaise: Math.round(amountInr * 100).toString(),
              verified: true,
              verifiedOnChain: false,
              createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: data.updatedAt || data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
            };
          }
        
        // Handle CRYPTO donations
        // Try to get networkId from tokenAddress or infer from tokenType
        let networkId = data.networkId || this.inferNetworkId(data);
        
        // Infer asset symbol first to detect mismatches
        const assetSymbol = this.getAssetSymbolFromTx(data, networkId);
        
        // If stored networkId doesn't match the asset, override it
        // This fixes old records with incorrect networkId stored
        if (assetSymbol === "LTC" && networkId?.includes("ethereum")) {
          networkId = "litecoin_mainnet";
        } else if (assetSymbol === "BTC" && networkId?.includes("ethereum")) {
          networkId = "bitcoin_mainnet";
        } else if (assetSymbol === "SOL" && networkId?.includes("ethereum")) {
          networkId = "solana_mainnet";
        } else if (!networkId || networkId === "unknown") {
          // If we still don't have a networkId, infer from assetSymbol
          networkId = this.inferNetworkId(data);
        }
        
        // Format amount - if it's a raw string, try to convert
        let amountNative = "0";
        if (data.amountNative) {
          amountNative = data.amountNative;
        } else if (data.amount) {
          // Try to format the amount
          amountNative = this.formatAmount(data.amount, data.tokenAddress);
        }
        
        // Skip 0 amount donations
        const amountNativeNum = parseFloat(amountNative);
        const amountRawNum = parseFloat(data.amount || "0");
        if (amountNativeNum <= 0 && amountRawNum <= 0) return null;
        
        // Skip unverified donations (must have txHash)
        if (!data.txHash) return null;
        
        // Calculate INR values - ALWAYS use stored amountInr (exact value at time of donation)
        // NEVER recalculate - we need the exact value that was stored when donation was made
        let inrAtConfirm = "0";
        
        // ALWAYS check if amountInr is stored first (this is the exact value at verification time)
        if (data.amountInr && parseFloat(data.amountInr) > 0) {
          // Use the exact stored value - do not modify or recalculate
          inrAtConfirm = parseFloat(data.amountInr).toFixed(2);
          console.log(`[DonationsPublic] ✅ Using stored amountInr for donation ${doc.id}: ₹${inrAtConfirm} (exact value at donation time)`);
        } else {
          // Only calculate from amountUsd if amountInr is completely missing
          // This should be rare - amountInr should always be set during verification
          let amountUsd = (data as any).amountUsd;
          const amountUsdNum = amountUsd ? parseFloat(amountUsd) : 0;
          if (amountUsd && !isNaN(amountUsdNum) && amountUsdNum > 0) {
            // Use the stored amountUsd and convert with the rate that was used at that time
            // Note: This is a fallback - amountInr should always be present
            inrAtConfirm = (amountUsdNum * 83).toFixed(2);
            console.log(`[DonationsPublic] ⚠️ Missing amountInr for donation ${doc.id}, calculated from amountUsd: ₹${inrAtConfirm}`);
          } else {
            console.log(`[DonationsPublic] ❌ No amountInr or amountUsd for donation ${doc.id}, cannot determine INR value`);
          }
        }
        
        const donorLabel = data.guestName || "Anonymous";
        
        // Use blockTimestamp for createdAt if available (for accurate crypto donation timestamps)
        let createdAt = data.createdAt;
        if (data.blockTimestamp) {
          createdAt = data.blockTimestamp;
        }
        // createdAt should always exist for verified donations, but if it doesn't, skip this donation
        if (!createdAt) {
          return null;
        }
        
        // Transform legacy donation to public format
        return {
          donationId: doc.id,
          campaignId: data.campaignId,
          type: "CRYPTO",
          donorLabel,
          isAnonymous: !data.guestName && !data.donorId,
          assetSymbol,
          networkId: networkId || "unknown",
          amountNative,
          amountRaw: data.amount,
          decimals: data.decimals || 18,
          verified: true,
          verifiedOnChain: true,
          txHashMasked: data.txHash ? this.maskTxHash(data.txHash) : undefined,
          // Always regenerate explorer URL based on assetSymbol to ensure correct blockchain explorer
          // This fixes old records that might have wrong explorer URLs or networkId stored
          explorerUrl: (() => {
            if (!data.txHash) return data.explorerUrl;
            const symbol = assetSymbol?.toUpperCase();
            const cleanHash = data.txHash.replace(/^0x/i, "");
            if (symbol === "LTC") {
              return `https://blockchair.com/litecoin/transaction/${cleanHash}`;
            }
            if (symbol === "BTC") {
              return `https://blockchair.com/bitcoin/transaction/${cleanHash}`;
            }
            if (symbol === "SOL") {
              return `https://solscan.io/tx/${data.txHash}`;
            }
            // For EVM tokens, use networkId-based URL generation
            return this.getExplorerUrl(networkId, data.txHash) || data.explorerUrl;
          })(),
          blockTimestamp: data.blockTimestamp,
          blockNumber: data.blockNumber,
          createdAt,
          updatedAt: data.updatedAt || createdAt,
          inrAtConfirm,
        };
      })
      );

      // Filter out null entries
      const filtered = transformed.filter((d) => d !== null);

      // Deduplicate by donationId (deterministic ID based on transaction)
      const seen = new Map<string, typeof filtered[0]>();
      for (const donation of filtered) {
        if (!donation) continue;
        
        // Use donationId as primary key
        if (!seen.has(donation.donationId)) {
          seen.set(donation.donationId, donation);
        } else {
          // If duplicate donationId, keep the one with more recent createdAt
          const existing = seen.get(donation.donationId)!;
          const existingTime = existing.createdAt?.toMillis?.() || existing.createdAt?.seconds * 1000 || 0;
          const currentTime = donation.createdAt?.toMillis?.() || donation.createdAt?.seconds * 1000 || 0;
          if (currentTime > existingTime) {
            seen.set(donation.donationId, donation);
          }
        }
      }

      // Convert map values to array and sort by createdAt DESC
      const sorted = Array.from(seen.values()).sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
        return bTime - aTime;
      });
      
      return sorted;
    } catch (error: any) {
      console.error("Error fetching public donations:", error);
      throw new HttpException(
        error.message || "Failed to fetch donations",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private inferNetworkId(data: any): string | undefined {
    // Try to infer network from tokenType or transaction hash format
    const tokenType = data.tokenType?.toUpperCase();
    
    // Infer from tokenType if it's a native token symbol
    if (tokenType === "LTC") return "litecoin_mainnet";
    if (tokenType === "BTC") return "bitcoin_mainnet";
    if (tokenType === "SOL") return "solana_mainnet";
    if (tokenType === "ETH" || tokenType === "NATIVE") {
      // Check if it's actually on a different network by checking tokenAddress
      if (data.tokenAddress) {
        // Token addresses starting with 0x are EVM, default to Ethereum
        return "ethereum_mainnet";
      }
    }
    
    // Infer from transaction hash format (UTXO hashes don't start with 0x)
    if (data.txHash && !data.txHash.startsWith("0x") && !data.txHash.startsWith("0X")) {
      // Non-0x hash could be UTXO (Bitcoin/Litecoin) or Solana
      // Check tokenType to narrow it down
      if (tokenType === "LTC") return "litecoin_mainnet";
      if (tokenType === "BTC") return "bitcoin_mainnet";
      // Default to Litecoin for non-0x hashes if we can't determine
      return "litecoin_mainnet";
    }
    
    // Try to infer from token address format
    if (data.tokenAddress) {
      // EVM addresses start with 0x
      if (data.tokenAddress.startsWith("0x")) {
        return "ethereum_mainnet"; // Default EVM network
      }
    }
    
    return undefined;
  }

  private getAssetSymbolFromTx(data: any, networkId?: string): string {
    // Check tokenType first - if it's a known symbol, use it directly
    if (data.tokenType && typeof data.tokenType === "string") {
      const tokenTypeUpper = data.tokenType.toUpperCase();
      // Handle known token types
      if (tokenTypeUpper === "USDT") return "USDT";
      if (tokenTypeUpper === "USDC") return "USDC";
      if (tokenTypeUpper === "NATIVE") {
        // Native token depends on network
        if (networkId?.includes("ethereum")) return "ETH";
        if (networkId?.includes("bsc")) return "BNB";
        if (networkId?.includes("polygon")) return "MATIC";
        return "ETH"; // Default
      }
      // If tokenType is a valid symbol (like "LTC", "BTC", "ETH", etc.), use it directly
      // This handles cases where tokenType is set to the asset symbol (e.g., "LTC" for Litecoin)
      if (tokenTypeUpper.length <= 6 && /^[A-Z0-9]+$/.test(tokenTypeUpper)) {
        return tokenTypeUpper;
      }
    }
    
    // Try to infer from tokenAddress (could map common addresses)
    if (data.tokenAddress) {
      // Common USDT addresses
      const usdtAddresses = [
        "0xdAC17F958D2ee523a2206206994597C13D831ec7", // Ethereum
        "0x55d398326f99059fF775485246999027B3197955", // BSC
      ];
      if (usdtAddresses.includes(data.tokenAddress.toLowerCase())) return "USDT";
      
      // Common USDC addresses
      const usdcAddresses = [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // Ethereum
        "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // BSC
      ];
      if (usdcAddresses.includes(data.tokenAddress.toLowerCase())) return "USDC";
    }
    
    // Infer from network
    if (networkId?.includes("litecoin")) return "LTC";
    if (networkId?.includes("bitcoin")) return "BTC";
    if (networkId?.includes("ethereum")) return "ETH";
    if (networkId?.includes("bsc")) return "BNB";
    if (networkId?.includes("polygon")) return "MATIC";
    if (networkId?.includes("solana")) return "SOL";
    
    return "CRYPTO";
  }

  /**
   * Estimate USD value using FX rate service (async)
   * Always fetches real-time prices from CoinGecko API - no hardcoded prices
   */
  private async estimateUsdFromAmountWithFxRate(
    amountNative: string,
    assetSymbol: string,
    networkId?: string
  ): Promise<string> {
    const amount = parseFloat(amountNative);
    if (isNaN(amount) || amount <= 0) return "0";
    
    // Declare coingeckoId outside try block for error handling
    let coingeckoId: string | undefined;
    
    try {
      // Try to get asset info to find coingecko ID from network/asset registry
      
      // First, try to get from asset registry if networkId is available
      if (networkId) {
        try {
          const assetId = `${assetSymbol.toLowerCase()}_${networkId}`;
          const asset = getAsset(assetId);
          if (asset?.coingeckoId) {
            coingeckoId = asset.coingeckoId;
          }
        } catch (error) {
          // Ignore errors, fall back to symbol mapping
        }
      }
      
      // Map asset symbols to coingecko IDs (fallback)
      if (!coingeckoId) {
        const coingeckoIdMap: Record<string, string> = {
          LTC: "litecoin",
          BTC: "bitcoin",
          ETH: "ethereum",
          BNB: "binancecoin",
          MATIC: "matic-network",
          USDT: "tether",
          USDC: "usd-coin",
          SOL: "solana",
        };
        
        const symbolUpper = assetSymbol.toUpperCase();
        if (coingeckoIdMap[symbolUpper]) {
          coingeckoId = coingeckoIdMap[symbolUpper];
        } else {
          // Default to lowercase symbol if not in map
          coingeckoId = assetSymbol.toLowerCase();
        }
      }
      
      // Get real-time price from FX rate service (CoinGecko API)
      const priceUsd = await this.fxRate.getRate(coingeckoId);
      const priceNum = parseFloat(priceUsd);
      
      if (!isNaN(priceNum) && priceNum > 0) {
        return (amount * priceNum).toFixed(2);
      } else {
        console.warn(`Invalid price returned for ${assetSymbol} (coingeckoId: ${coingeckoId}): ${priceUsd}`);
        return "0";
      }
      } catch (error) {
        const errorCoingeckoId = coingeckoId || assetSymbol.toLowerCase();
        console.error(`Failed to fetch FX rate for ${assetSymbol} (coingeckoId: ${errorCoingeckoId}):`, error);
      // Return 0 instead of using hardcoded prices
      return "0";
    }
  }

  private getExplorerUrl(networkId: string | undefined, txHash: string): string {
    if (!networkId) return `https://etherscan.io/tx/${txHash}`;
    const networkIdLower = networkId.toLowerCase();
    
    // UTXO networks (Bitcoin/Litecoin) use Blockchair - remove 0x prefix if present
    if (networkIdLower.includes("litecoin")) {
      const cleanHash = txHash.startsWith("0x") || txHash.startsWith("0X") ? txHash.slice(2) : txHash;
      return `https://blockchair.com/litecoin/transaction/${cleanHash}`;
    }
    if (networkIdLower.includes("bitcoin")) {
      const cleanHash = txHash.startsWith("0x") || txHash.startsWith("0X") ? txHash.slice(2) : txHash;
      return `https://blockchair.com/bitcoin/transaction/${cleanHash}`;
    }
    
    // EVM networks (keep 0x prefix)
    if (networkIdLower.includes("bsc")) return `https://bscscan.com/tx/${txHash}`;
    if (networkIdLower.includes("polygon")) return `https://polygonscan.com/tx/${txHash}`;
    if (networkIdLower.includes("arbitrum")) return `https://arbiscan.io/tx/${txHash}`;
    if (networkIdLower.includes("optimism")) return `https://optimistic.etherscan.io/tx/${txHash}`;
    if (networkIdLower.includes("base")) return `https://basescan.org/tx/${txHash}`;
    if (networkIdLower.includes("ethereum")) return `https://etherscan.io/tx/${txHash}`;
    
    // Solana
    if (networkIdLower.includes("solana")) return `https://solscan.io/tx/${txHash}`;
    
    // Default to Etherscan for unknown networks
    return `https://etherscan.io/tx/${txHash}`;
  }

  private maskTxHash(txHash: string): string {
    if (!txHash || txHash.length < 10) return txHash;
    const hash = txHash.startsWith("0x") ? txHash.slice(2) : txHash;
    const prefix = txHash.startsWith("0x") ? "0x" : "";
    if (hash.length < 10) return txHash;
    return `${prefix}${hash.slice(0, 6)}…${hash.slice(-4)}`;
  }

  private formatAmount(amount: string, tokenAddress?: string): string {
    // If amount is in wei/smallest unit, convert to readable format
    // For now, just return as-is if it's already a decimal string
    if (amount.includes(".")) return amount;
    // Otherwise, assume it's in smallest units and convert (simplified)
    try {
      const num = BigInt(amount);
      // Default to 18 decimals for most tokens
      const decimals = 18;
      const divisor = BigInt(10 ** decimals);
      const whole = num / divisor;
      const remainder = num % divisor;
      if (remainder === 0n) return whole.toString();
      return `${whole}.${remainder.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
    } catch {
      return amount;
    }
  }
}
