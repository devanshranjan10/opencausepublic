/**
 * Intent Watch Processor
 * 
 * Server-side auto-detection of incoming crypto payments across all enabled EVM chains.
 * Scans for exact amount matches to prevent replay attacks and ensure accurate detection.
 */

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as admin from "firebase-admin";
import { createPublicClient, http, Chain } from "viem";
import { getEnabledNetworks, CryptoNetwork, getAsset, maskTxHash } from "@opencause/crypto-core";
import { scanErc20Exact } from "../evm/scanErc20";
import { scanNativeExact } from "../evm/scanNative";

interface NetworkConfig {
  id: string;
  rpcUrl: string;
  explorerBaseUrl: string;
  chainId: number;
  viemChain: Chain;
}

export class IntentWatchProcessor {
  private db = getFirestore();
  private networkConfigs: Map<string, NetworkConfig> = new Map();
  private rpcUrlCache: Map<string, string> = new Map();

  constructor() {
    this.initializeNetworkConfigs();
  }

  private initializeNetworkConfigs() {
    const networks = getEnabledNetworks().filter((n) => n.type === "EVM");
    
    for (const net of networks) {
      const rpcUrl = this.getRpcUrl(net.networkId);
      if (!rpcUrl || !net.chainId) continue;

      const viemChain: Chain = {
        id: net.chainId,
        name: net.name,
        nativeCurrency: {
          name: net.symbol,
          symbol: net.symbol,
          decimals: 18,
        },
        rpcUrls: {
          default: {
            http: [rpcUrl],
          },
        },
      } as Chain;

      this.networkConfigs.set(net.networkId, {
        id: net.networkId,
        rpcUrl,
        explorerBaseUrl: net.explorerBaseUrl,
        chainId: net.chainId,
        viemChain,
      });
    }
  }

  private getRpcUrl(networkId: string): string | null {
    if (this.rpcUrlCache.has(networkId)) {
      return this.rpcUrlCache.get(networkId) || null;
    }

    const rpcUrls: Record<string, string> = {
      ethereum_mainnet: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
      polygon_mainnet: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      bsc_mainnet: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org",
      avalanche_mainnet: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
      arbitrum_mainnet: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
      optimism_mainnet: process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
      base_mainnet: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      fantom_mainnet: process.env.FANTOM_RPC_URL || "https://rpc.ftm.tools",
    };

    const url = rpcUrls[networkId] || null;
    if (url) {
      this.rpcUrlCache.set(networkId, url);
    }
    return url;
  }

  /**
   * Main tick function - should be called periodically (every 5-10 seconds)
   */
  async tick() {
    const now = Date.now();

    try {
      const intentsSnap = await this.db
        .collection("payment_intents")
        .where("status", "in", ["CREATED", "DETECTING", "CONFIRMING"])
        .limit(50)
        .get();

      console.log(`[IntentWatch] Scanning ${intentsSnap.size} pending intents...`);

      for (const doc of intentsSnap.docs) {
        const intent = doc.data() as any;
        const intentId = doc.id;

        // Check expiration
        if (intent.expiresAt?.toMillis?.() && intent.expiresAt.toMillis() < now) {
          await doc.ref.update({
            status: "EXPIRED",
            updatedAt: Timestamp.now(),
          });
          console.log(`[IntentWatch] Intent ${intentId} expired`);
          continue;
        }

        // Skip if no expectedAmountRaw (old intent format)
        if (!intent.expectedAmountRaw) {
          console.warn(`[IntentWatch] Intent ${intentId} missing expectedAmountRaw, skipping`);
          continue;
        }

        await this.detectEvmAcrossChains(doc.ref, intent);
      }
    } catch (error: any) {
      console.error("[IntentWatch] Error in tick:", error);
    }
  }

  private async detectEvmAcrossChains(intentRef: FirebaseFirestore.DocumentReference, intent: any) {
    const depositAddress = (intent.depositAddress || "").toLowerCase();
    if (!depositAddress) {
      console.warn(`[IntentWatch] Intent ${intentRef.id} missing depositAddress`);
      return;
    }

    const expectedValue = BigInt(intent.expectedAmountRaw);
    const expectedTokenAddress = intent.expectedTokenAddress;
    const isErc20 = !!expectedTokenAddress && expectedTokenAddress !== "0x0000000000000000000000000000000000000000";

    // Update status to DETECTING if not already
    if (intent.status !== "DETECTING") {
      await intentRef.update({
        status: "DETECTING",
        updatedAt: Timestamp.now(),
      });
    }

    // Scan all enabled EVM networks
    for (const [networkId, netConfig] of this.networkConfigs.entries()) {
      try {
        // Normalize token address for comparison (case-insensitive)
        const normalizedExpectedToken = expectedTokenAddress?.toLowerCase();
        
        const client = createPublicClient({
          transport: http(netConfig.rpcUrl),
          chain: netConfig.viemChain,
        });

        const latest = await client.getBlockNumber();
        const startBlockByNetwork = intent.startBlockByNetwork || {};
        const lastScannedBlockByNetwork = intent.lastScannedBlockByNetwork || {};

        const start = BigInt(startBlockByNetwork[networkId] || latest.toString());
        let last = BigInt(lastScannedBlockByNetwork[networkId] || start.toString());

        // Scan small window each tick (40 blocks) to avoid RPC abuse
        const fromBlock = last;
        const scanWindow = 40n;
        const toBlock = last + scanWindow > latest ? latest : last + scanWindow;

        if (fromBlock > latest) {
          // Already scanned past latest, skip
          continue;
        }

        let found: {
          txHash: `0x${string}`;
          value: bigint;
          assetType: "NATIVE" | "ERC20";
          token?: string;
          blockNumber?: string;
        } | null = null;

        // 1) If expected asset is ERC20/BEP20, try that first
        if (isErc20 && expectedTokenAddress) {
          // Normalize addresses for comparison (case-insensitive)
          const normalizedToken = expectedTokenAddress.toLowerCase() as `0x${string}`;
          const normalizedDeposit = depositAddress.toLowerCase() as `0x${string}`;
          
          console.log(
            `[IntentWatch] Scanning ERC20/BEP20 on ${networkId}: token=${normalizedToken}, deposit=${normalizedDeposit}, expectedValue=${expectedValue.toString()}, blocks=${fromBlock.toString()}-${toBlock.toString()}`
          );
          
          const result = await scanErc20Exact({
            client,
            tokenAddress: normalizedToken,
            toAddress: normalizedDeposit,
            fromBlock,
            toBlock,
            expectedValue,
          });
          if (result) {
            found = {
              txHash: result.txHash,
              value: result.value,
              assetType: "ERC20",
              token: normalizedToken,
              blockNumber: result.blockNumber,
            };
            console.log(`[IntentWatch] ✅ Found ERC20/BEP20 transaction on ${networkId}: ${result.txHash}, value=${result.value.toString()}`);
          } else {
            console.log(`[IntentWatch] No ERC20/BEP20 match on ${networkId} in blocks ${fromBlock.toString()}-${toBlock.toString()}`);
          }
        }

        // 2) Also detect native (wrong asset but still "good")
        if (!found) {
          const result = await scanNativeExact({
            client,
            toAddress: depositAddress,
            fromBlock,
            toBlock,
            expectedValue,
          });
          if (result) {
            found = {
              txHash: result.txHash,
              value: result.value,
              assetType: "NATIVE",
              blockNumber: result.blockNumber,
            };
          }
        }

        // Advance cursor
        await intentRef.update({
          lastScannedBlockByNetwork: {
            ...lastScannedBlockByNetwork,
            [networkId]: toBlock.toString(),
          },
          updatedAt: Timestamp.now(),
        });

        if (found) {
          console.log(
            `[IntentWatch] Found transaction ${found.txHash} on ${networkId} for intent ${intentRef.id}`
          );
          await this.recordFoundTxAndConfirm(intentRef, intent, networkId, netConfig, found);
          return; // Stop after first match across chains
        }
      } catch (error: any) {
        // Log error but continue scanning other networks
        if (!error.message?.includes("rate limit") && !error.message?.includes("timeout")) {
          console.warn(`[IntentWatch] Error scanning ${networkId} for intent ${intentRef.id}:`, error.message);
        }
      }
    }
  }

  private async recordFoundTxAndConfirm(
    intentRef: FirebaseFirestore.DocumentReference,
    intent: any,
    networkId: string,
    netConfig: NetworkConfig,
    found: {
      txHash: `0x${string}`;
      value: bigint;
      assetType: "NATIVE" | "ERC20";
      token?: string;
      blockNumber?: string;
    }
  ) {
    const txDocId = `${networkId}_${found.txHash}`;
    const txRef = this.db.collection("chain_txs_private").doc(txDocId);

    // Get decimals and asset info
    const decimals = intent.expectedDecimals || 18;
    const assetId = intent.assetId || this.inferAssetId(networkId, found);
    const asset = assetId ? getAsset(assetId) : null;
    const assetSymbol = asset?.symbol || (found.assetType === "ERC20" ? "TOKEN" : "ETH");
    
    // Format amount in native units
    const amountNative = this.formatUnits(found.value, decimals);
    
    // Get block timestamp from chain
    let blockTimestamp: admin.firestore.Timestamp | null = null;
    let blockNumberStr: string | null = null;
    
    if (found.blockNumber) {
      blockNumberStr = found.blockNumber.toString();
      try {
        const client = createPublicClient({
          transport: http(netConfig.rpcUrl),
          chain: netConfig.viemChain,
        });
        const block = await client.getBlock({ blockNumber: BigInt(found.blockNumber) });
        if (block.timestamp) {
          blockTimestamp = admin.firestore.Timestamp.fromMillis(Number(block.timestamp) * 1000);
        }
      } catch (error) {
        console.warn(`[IntentWatch] Failed to fetch block timestamp:`, error);
      }
    }

    // Use block timestamp if available, otherwise use now
    const createdAt = blockTimestamp || admin.firestore.Timestamp.now();

    // Get intent private data for donor info
    const intentPrivateRef = this.db.collection("payment_intents_private").doc(intentRef.id);
    const intentPrivateSnap = await intentPrivateRef.get();
    const intentPrivate = intentPrivateSnap.exists ? intentPrivateSnap.data() : null;
    
    const isAnonymous = intentPrivate?.isAnonymous || false;
    const donorLabel = intentPrivate?.donorName || (isAnonymous ? "Anonymous" : "Anonymous");
    const donorUid = intentPrivate?.donorUid || null;

    // Create deterministic donationId
    const toAddressLower = (intent.depositAddress || "").toLowerCase();
    const tokenAddrOrSymbol = found.token?.toLowerCase() || assetSymbol.toLowerCase();
    const donationId = `${networkId}_${found.txHash}_${toAddressLower}_${tokenAddrOrSymbol}`;

    const explorerTxUrl = `${netConfig.explorerBaseUrl}/tx/${found.txHash}`;

    try {
      await this.db.runTransaction(async (t) => {
        // Check if chain_tx already exists
        const txExists = await t.get(txRef);
        if (txExists.exists) {
          console.log(`[IntentWatch] Transaction ${found.txHash} already recorded, skipping`);
          return;
        }

        // Check if donation already exists (deterministic ID prevents duplicates)
        const donationPublicRef = this.db
          .collection("donations_public")
          .doc(intent.campaignId)
          .collection("items")
          .doc(donationId);
        const donationExists = await t.get(donationPublicRef);
        if (donationExists.exists) {
          console.log(`[IntentWatch] Donation ${donationId} already exists, skipping`);
          return;
        }

        // Create chain_tx_private record
        t.set(
          txRef,
          {
            networkId,
            txHash: found.txHash,
            to: intent.depositAddress,
            from: null, // Could be fetched from receipt if needed
            amountRaw: found.value.toString(),
            amountNative,
            assetType: found.assetType,
            tokenAddress: found.token ?? null,
            blockNumber: blockNumberStr,
            confirmations: 0,
            status: "SEEN",
            explorerUrl: explorerTxUrl,
            intentId: intentRef.id,
            createdAt: createdAt,
            updatedAt: admin.firestore.Timestamp.now(),
          }
        );

        // Create donation_private record
        const donationPrivateRef = this.db.collection("donations_private").doc(donationId);
        t.set(donationPrivateRef, {
          donationId,
          campaignId: intent.campaignId,
          donorUid,
          donorName: intentPrivate?.donorName || null,
          donorEmail: null, // Not stored for privacy
          isAnonymous,
          txHash: found.txHash,
          fullExplorerUrl: explorerTxUrl,
          networkId,
          assetId: assetId || "unknown",
          assetSymbol,
          assetType: found.assetType,
          rawAmount: found.value.toString(),
          decimals,
          tokenAddress: found.token ?? null,
          amountNative,
          inrAtConfirm: null, // Will be computed by price service
          usdAtConfirm: null,
          priceAtConfirm: null,
          blockNumber: blockNumberStr,
          confirmations: 0,
          createdAt: createdAt,
        });

        // Create donation_public record (anonymous-safe)
        const donationPublicData: any = {
          donationId,
          campaignId: intent.campaignId,
          type: "CRYPTO",
          donorLabel,
          isAnonymous,
          assetSymbol,
          networkId,
          amountNative,
          amountRaw: found.value.toString(),
          decimals,
          verified: true,
          verifiedOnChain: true,
          createdAt: createdAt,
          blockTimestamp: blockTimestamp,
          blockNumber: blockNumberStr,
          updatedAt: admin.firestore.Timestamp.now(),
        };

        // Only include explorer info if NOT anonymous
        if (!isAnonymous) {
          donationPublicData.txHashMasked = maskTxHash(found.txHash);
          donationPublicData.explorerUrl = explorerTxUrl;
        } else {
          donationPublicData.txHashPrivateRef = donationId; // Reference to private doc for audit
        }

        t.set(donationPublicRef, donationPublicData);

        // Update intent with detection result
        t.update(intentRef, {
          status: "CONFIRMING",
          confirmedTxHash: found.txHash,
          txHash: found.txHash,
          detectedNetworkId: networkId,
          detectedAssetType: found.assetType,
          detectedTokenAddress: found.token ?? null,
          detectedAmountRaw: found.value.toString(),
          detectedAmountNative: amountNative,
          updatedAt: admin.firestore.Timestamp.now(),
        });

        // Update intent public
        const intentPublicRef = this.db.collection("payment_intents_public").doc(intentRef.id);
        t.update(intentPublicRef, {
          status: "CONFIRMING",
          detectedNetworkId: networkId,
          detectedAssetSymbol: assetSymbol,
          detectedAmountNative: amountNative,
          explorerUrl: !isAnonymous ? explorerTxUrl : undefined,
          txHashMasked: !isAnonymous ? maskTxHash(found.txHash) : undefined,
          updatedAt: admin.firestore.Timestamp.now(),
        });
      });

      console.log(`[IntentWatch] ✅ Recorded transaction ${found.txHash} and donation ${donationId} for intent ${intentRef.id}`);
    } catch (error: any) {
      console.error(`[IntentWatch] Error recording transaction:`, error);
    }
  }

  private formatUnits(value: bigint, decimals: number): string {
    const divisor = BigInt(10 ** decimals);
    const whole = value / divisor;
    const remainder = value % divisor;
    if (remainder === 0n) return whole.toString();
    const remainderStr = remainder.toString().padStart(decimals, "0").replace(/0+$/, "");
    return remainderStr ? `${whole}.${remainderStr}` : whole.toString();
  }

  private inferAssetId(networkId: string, found: { assetType: "NATIVE" | "ERC20"; token?: string }): string | null {
    // Try to infer assetId from network and token
    if (found.assetType === "NATIVE") {
      if (networkId.includes("ethereum")) return "eth_ethereum_mainnet";
      if (networkId.includes("bsc")) return "bnb_bsc_mainnet";
      if (networkId.includes("polygon")) return "matic_polygon_mainnet";
    }
    // For ERC20, would need token address mapping
    return null;
  }

  private getExplorerBase(networkId: string): string {
    const netConfig = this.networkConfigs.get(networkId);
    return netConfig?.explorerBaseUrl || "https://etherscan.io";
  }
}

