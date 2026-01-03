import { Injectable, ForbiddenException, BadRequestException } from "@nestjs/common";
import { randomBytes, createHash } from "crypto";
import { FirebaseService } from "../firebase/firebase.service";
import { FirestoreRepository } from "@opencause/firebase";
import { getNetwork, getAsset, getEnabledNetworks, CryptoNetwork } from "@opencause/crypto-core";
import { buildQRUri, getExplorerAddressUrl } from "@opencause/crypto-core";
import * as admin from "firebase-admin";
import { HDWalletService } from "./hd-wallet.service";
import { FxRateService } from "./fx-rate.service";
import { CampaignPublicService } from "./campaign-public.service";
import { parseUnits } from "viem";

export interface CreatePaymentIntentDto {
  campaignId: string;
  networkId: string;
  assetId: string;
  amountUsd?: string;
  amountNative?: string;
  isAnonymous?: boolean;
  donorLabel?: string; // Display name (if not anonymous)
}

export interface PaymentIntentResponse {
  intentId: string;
  campaignId: string;
  networkId: string;
  assetId: string;
  depositAddress: string;
  qrString: string;
  amountNative: string;
  amountUsd: string;
  fxRate: string;
  expiresAt: string;
  explorerBaseUrl: string;
  explorerAddressUrl: string;
  status: string;
  confirmedTxHash?: string;
  startBlock?: string;
}

@Injectable()
export class PaymentIntentsService {
  private _repo: FirestoreRepository | null = null;

  constructor(
    private firebase: FirebaseService,
    private hdWallet: HDWalletService,
    private fxRate: FxRateService,
    private campaignPublic: CampaignPublicService
  ) {}

  // Lazy initialization of repository to ensure firestore is ready
  private get repo(): FirestoreRepository {
    if (!this._repo) {
      if (!this.firebase.firestore) {
        throw new Error("Firestore not initialized in FirebaseService");
      }
      this._repo = new FirestoreRepository(this.firebase.firestore);
    }
    return this._repo;
  }

  /**
   * Create a payment intent
   */
  async createIntent(dto: CreatePaymentIntentDto, userId?: string): Promise<PaymentIntentResponse> {
    // Check goal lock (race-safe transaction check)
    const goalCheck = await this.campaignPublic.checkGoalMetTransaction(dto.campaignId);
    if (goalCheck.goalMet) {
      throw new ForbiddenException("Campaign goal has been met. Donations are no longer accepted.");
    }

    // Validate inputs
    if (!dto.amountUsd && !dto.amountNative) {
      throw new BadRequestException("Either amountUsd or amountNative must be provided");
    }

    // Get network and asset
    const network = getNetwork(dto.networkId);
    const asset = getAsset(dto.assetId);

    if (!network || !asset) {
      throw new Error("Invalid network or asset");
    }

    if (!network.enabled || !asset.enabled) {
      throw new Error("Network or asset is disabled");
    }

    // Get FX rate and convert amounts
    let amountNative: string;
    let amountUsd: string;
    let fxRate: string;

    if (dto.amountNative) {
      amountNative = dto.amountNative;
      // Convert to USD using FX rate service
      fxRate = await this.fxRate.getRate(asset.coingeckoId || asset.assetId);
      amountUsd = await this.fxRate.nativeToUsd(
        asset.assetId,
        asset.coingeckoId,
        asset.decimals,
        amountNative
      );
    } else {
      amountUsd = dto.amountUsd!;
      // Convert from USD using FX rate service
      fxRate = await this.fxRate.getRate(asset.coingeckoId || asset.assetId);
      amountNative = await this.fxRate.usdToNative(
        asset.assetId,
        asset.coingeckoId,
        asset.decimals,
        amountUsd
      );
    }

    // Get or create campaign deposit address
    const depositDocId = `${dto.campaignId}_${dto.assetId}_${dto.networkId}`;
    let deposit = await this.repo.getDeposit(depositDocId);

    if (!deposit) {
      // Generate deposit address
      try {
        const address = await this.generateDepositAddress(
          dto.campaignId,
          dto.assetId,
          dto.networkId,
          network,
          asset
        );

        deposit = await this.repo.createOrGetDeposit(depositDocId, {
          campaignId: dto.campaignId,
          assetId: dto.assetId,
          networkId: dto.networkId,
          address: address.address,
          vaultAddress: address.vaultAddress || undefined,
          derivationPath: address.derivationPath || undefined,
          addressIndex: address.addressIndex || 0,
        });
      } catch (error: any) {
        console.error("Error generating deposit address:", error);
        throw new Error(`Failed to generate deposit address: ${error.message}`);
      }
    }

    // Create payment intent
    const intentId = this.generateIntentId();
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    );

    // Calculate expectedAmountRaw (with nonce for exact matching)
    const decimals = asset.decimals || 18;
    let expectedAmountRaw: bigint;
    try {
      const baseAmountRaw = parseUnits(amountNative, decimals);
      // Add small random nonce (0.000001 to 0.000999 in raw units) to ensure unique amounts
      // This prevents collisions when multiple donors use the same deposit address
      const nonceMax = parseUnits("0.001", decimals);
      const nonceMin = parseUnits("0.000001", decimals);
      const nonceRange = nonceMax - nonceMin;
      const nonce = nonceMin + BigInt(Math.floor(Math.random() * Number(nonceRange)));
      expectedAmountRaw = baseAmountRaw + nonce;
    } catch (error) {
      console.error("Failed to parse amount with nonce:", error);
      // Fallback: use base amount without nonce
      expectedAmountRaw = parseUnits(amountNative, decimals);
    }

    // Get startBlockByNetwork for ALL enabled EVM networks (for cross-chain detection)
    const startBlockByNetwork: { [networkId: string]: string } = {};
    const enabledNetworks = getEnabledNetworks();
    const evmNetworks = enabledNetworks.filter((n) => n.type === "EVM");

    for (const evmNet of evmNetworks) {
      try {
        const rpcUrl = this.getRpcUrl(evmNet.networkId);
        if (rpcUrl) {
          const { createPublicClient, http } = await import("viem");
          const publicClient = createPublicClient({
            transport: http(rpcUrl),
          });
          const currentBlock = await publicClient.getBlockNumber();
          startBlockByNetwork[evmNet.networkId] = currentBlock.toString();
        }
      } catch (error) {
        console.warn(`Failed to get startBlock for ${evmNet.networkId}:`, error);
        // Continue without this network's startBlock
      }
    }

    // Create payment intent with all fields
    const intentData: any = {
      campaignId: dto.campaignId,
      assetId: dto.assetId, // Expected asset (what user selected)
      networkId: dto.networkId, // Expected network (what user selected)
      depositRef: deposit.id,
      depositAddress: deposit.address, // Store for easy access
      amountNative, // Expected formatted amount (for display)
      amountUsd,
      fxRate,
      rateProvider: "COINGECKO",
      expiresAt,
      status: "CREATED",
      expectedUsd: amountUsd, // Expected USD amount (for display)
      expectedNative: amountNative, // Expected native amount (for display)
      expectedAmountRaw: expectedAmountRaw.toString(), // Raw amount with nonce (for exact matching)
      expectedDecimals: decimals,
      expectedTokenAddress: asset.assetType === "ERC20" ? (asset.contractAddress || null) : null,
      startBlockByNetwork: Object.keys(startBlockByNetwork).length > 0 ? startBlockByNetwork : undefined,
      lastScannedBlockByNetwork: {}, // Initialize empty, worker will populate
    };

    const intent = await this.repo.createPaymentIntent(intentId, intentData);

    // Build QR string
    const qrString = buildQRUri(network, asset, deposit.address, amountNative);
    const explorerAddressUrl = getExplorerAddressUrl(network, deposit.address);

    return {
      intentId,
      campaignId: dto.campaignId,
      networkId: dto.networkId,
      assetId: dto.assetId,
      depositAddress: deposit.address,
      qrString,
      amountNative,
      amountUsd,
      fxRate,
      expiresAt: expiresAt.toDate().toISOString(),
      explorerBaseUrl: network.explorerBaseUrl,
      explorerAddressUrl,
      status: intent.status,
    };
  }

  /**
   * Get payment intent by ID
   */
  async getIntent(intentId: string): Promise<PaymentIntentResponse | null> {
    try {
      const intent = await this.repo.getPaymentIntent(intentId);
      if (!intent) {
        console.warn(`Payment intent not found: ${intentId}`);
        return null;
      }

      if (!intent.depositRef) {
        console.error(`Payment intent ${intentId} missing depositRef`);
        throw new Error("Payment intent is missing deposit reference");
      }

      const deposit = await this.repo.getDeposit(intent.depositRef);
      if (!deposit) {
        console.error(`Deposit not found for intent ${intentId}, depositRef: ${intent.depositRef}`);
        throw new Error("Deposit address not found for payment intent");
      }

      const network = getNetwork(intent.networkId);
      const asset = getAsset(intent.assetId);
      if (!network || !asset) {
        console.error(`Invalid network or asset for intent ${intentId}: ${intent.networkId}/${intent.assetId}`);
        throw new Error("Invalid network or asset configuration");
      }

      if (!deposit.address) {
        console.error(`Deposit ${intent.depositRef} missing address`);
        throw new Error("Deposit address is missing");
      }

      const qrString = buildQRUri(network, asset, deposit.address, intent.amountNative);
      const explorerAddressUrl = getExplorerAddressUrl(network, deposit.address);

      // Get latest transaction if exists
      let latestTx = null;
      try {
        const txs = await this.repo.getChainTxsByIntent(intentId);
        latestTx = txs[0] || null;
      } catch (txError) {
        // Transaction lookup is optional, don't fail if it errors
        console.warn(`Error fetching transactions for intent ${intentId}:`, txError);
      }

      return {
        intentId,
        campaignId: intent.campaignId,
        networkId: intent.networkId,
        assetId: intent.assetId,
        depositAddress: deposit.address,
        qrString,
        amountNative: intent.amountNative,
        amountUsd: intent.amountUsd,
        fxRate: intent.fxRate,
        expiresAt: (intent.expiresAt as admin.firestore.Timestamp).toDate().toISOString(),
        explorerBaseUrl: network.explorerBaseUrl,
        explorerAddressUrl,
        status: intent.status,
        confirmedTxHash: (intent as any).confirmedTxHash,
        startBlock: (intent as any).startBlock,
      };
    } catch (error: any) {
      console.error(`Error in getIntent for ${intentId}:`, error);
      throw error;
    }
  }

  /**
   * Generate deposit address for campaign+asset+network
   */
  private async generateDepositAddress(
    campaignId: string,
    assetId: string,
    networkId: string,
    network: any,
    asset: any
  ): Promise<{ address: string; vaultAddress?: string; derivationPath?: string; addressIndex?: number }> {
    // Extract crypto symbol and blockchain name for HD wallet
    const crypto = asset.symbol;
    const blockchain = networkId.split("_")[0]; // e.g., "bsc_mainnet" -> "bsc"
    
    // For EVM: use vault contract address if available, otherwise derive
    if (network.type === "EVM") {
      // TODO: Get vault address from factory contract
      // For now, derive HD wallet address
      const walletInfo = await this.hdWallet.generateAddress(
        campaignId,
        crypto,
        blockchain,
        0
      );
      return {
        address: walletInfo.address,
        derivationPath: walletInfo.derivationPath,
        addressIndex: 0,
      };
    }

    // For UTXO and SOL: derive HD wallet address
    const walletInfo = await this.hdWallet.generateAddress(
      campaignId,
      crypto,
      blockchain,
      0
    );

    return {
      address: walletInfo.address,
      derivationPath: walletInfo.derivationPath,
      addressIndex: 0,
    };
  }

  /**
   * Generate unique intent ID
   */
  private generateIntentId(): string {
    return createHash("sha256")
      .update(`${Date.now()}-${randomBytes(16).toString("hex")}`)
      .digest("hex")
      .substring(0, 32);
  }

  /**
   * Get RPC URL for network
   */
  private getRpcUrl(networkId: string): string | null {
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

    return rpcUrls[networkId] || null;
  }
}
