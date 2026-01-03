import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common";
import { FirebaseService } from "../firebase/firebase.service";
import { CreateWithdrawalDto, EvidenceKind, TokenType } from "@opencause/types";
import { EvidenceService } from "../evidence/evidence.service";
import { Web3Service } from "../web3/web3.service";
import { QueueService } from "../queue/queue.service";
import { RazorpayService } from "../payments/razorpay.service";
import { FxRateService } from "../crypto/fx-rate.service";
import { CryptoAddressService } from "../crypto/crypto-address.service";
import { evaluateReleasePolicy } from "@opencause/policy";
import { parseUnits } from "viem";
import * as admin from "firebase-admin";

@Injectable()
export class WithdrawalsService {
  constructor(
    private firebase: FirebaseService,
    private evidenceService: EvidenceService,
    private web3Service: Web3Service,
    private queueService: QueueService,
    private razorpayService: RazorpayService,
    private fxRateService: FxRateService,
    private cryptoAddressService: CryptoAddressService
  ) {}

  /**
   * Get crypto symbol from TokenType
   */
  private getCryptoSymbol(tokenType: TokenType): string {
    switch (tokenType) {
      case TokenType.NATIVE:
        return "ETH";
      case TokenType.USDC:
        return "USDC";
      case TokenType.USDT:
        return "USDT";
      default:
        return "CRYPTO";
    }
  }

  /**
   * Get token decimals for conversion
   */
  private getTokenDecimals(tokenType: TokenType): number {
    switch (tokenType) {
      case TokenType.NATIVE:
        return 18; // ETH has 18 decimals
      case TokenType.USDC:
      case TokenType.USDT:
        return 6; // USDC/USDT have 6 decimals
      default:
        return 18; // Default to 18
    }
  }

  /**
   * Get CoinGecko ID for crypto symbol
   */
  private getCoingeckoId(symbol: string): string {
    const mapping: Record<string, string> = {
      ETH: "ethereum",
      USDC: "usd-coin",
      USDT: "tether",
      BTC: "bitcoin",
      LTC: "litecoin",
      BNB: "binancecoin",
      AVAX: "avalanche-2",
    };
    return mapping[symbol.toUpperCase()] || symbol.toLowerCase();
  }

  /**
   * Validate address format based on chain/network
   */
  private validateAddressForChain(address: string, addressFormat: string, networkId: string): boolean {
    if (!address) return false;

    switch (addressFormat.toLowerCase()) {
      case "ethereum":
        // Ethereum format: 0x followed by 40 hex characters (42 total)
        return /^0x[a-fA-F0-9]{40}$/.test(address);
      
      case "bitcoin":
        // Bitcoin/Litecoin format: Base58, typically 26-35 characters
        // Starts with 1, 3, bc1, or m, n (testnet)
        return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$|^[mn2][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address);
      
      case "solana":
        // Solana format: Base58, 32-44 characters
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      
      case "cosmos":
        // Cosmos format: Bech32, starts with specific prefixes
        return /^(cosmos|osmo|terra)[a-z0-9]{38,59}$/.test(address);
      
      default:
        // For unknown formats, do basic validation (non-empty, reasonable length)
        return address.length >= 10 && address.length <= 100;
    }
  }

  /**
   * Get chain key from networkId for crypto config lookup
   */
  private getChainKey(networkId: string): string | null {
    const mapping: Record<string, string> = {
      "ethereum_mainnet": "ETH",
      "polygon_mainnet": "POLYGON",
      "bsc_mainnet": "BSC",
      "avalanche_mainnet": "AVALANCHE",
      "arbitrum_mainnet": "ARBITRUM",
      "optimism_mainnet": "OPTIMISM",
      "base_mainnet": "BASE",
    };
    return mapping[networkId] || null;
  }

  /**
   * Get human-readable chain name
   */
  private getChainName(networkId: string): string {
    const mapping: Record<string, string> = {
      "ethereum_mainnet": "Ethereum",
      "polygon_mainnet": "Polygon",
      "bsc_mainnet": "BSC",
      "avalanche_mainnet": "Avalanche",
      "arbitrum_mainnet": "Arbitrum",
      "optimism_mainnet": "Optimism",
      "base_mainnet": "Base",
      "bitcoin_mainnet": "Bitcoin",
      "litecoin_mainnet": "Litecoin",
      "solana_mainnet": "Solana",
    };
    return mapping[networkId] || networkId.replace(/_mainnet$/, "").replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Convert chainId number to networkId string
   */
  private networkIdFromChainId(chainId?: number): string | null {
    if (!chainId) return null;
    const mapping: Record<number, string> = {
      1: "ethereum_mainnet",
      137: "polygon_mainnet",
      56: "bsc_mainnet",
      43114: "avalanche_mainnet",
      42161: "arbitrum_mainnet",
      10: "optimism_mainnet",
      8453: "base_mainnet",
    };
    return mapping[chainId] || null;
  }

  /**
   * Get address format for a crypto/chain combination
   */
  private getAddressFormatForCrypto(symbol: string, chainKey: string | null): string {
    // Default address formats based on symbol and chain
    const formatMap: Record<string, string> = {
      // Ethereum-based chains
      "ETH": "ethereum",
      "USDC-ETH": "ethereum",
      "USDC-POLYGON": "ethereum",
      "USDC-BSC": "ethereum",
      "USDC-AVALANCHE": "ethereum",
      "USDC-ARBITRUM": "ethereum",
      "USDC-OPTIMISM": "ethereum",
      "USDC-BASE": "ethereum",
      "USDT-ETH": "ethereum",
      "USDT-POLYGON": "ethereum",
      "USDT-BSC": "ethereum",
      "USDT-AVALANCHE": "ethereum",
      "USDT-ARBITRUM": "ethereum",
      "USDT-OPTIMISM": "ethereum",
      "USDT-BASE": "ethereum",
      // Bitcoin-based
      "BTC": "bitcoin",
      "LTC": "bitcoin",
      // Solana
      "SOL": "solana",
      // Default to ethereum for unknown
    };
    
    const key = chainKey ? `${symbol}-${chainKey}` : symbol;
    return formatMap[key] || "ethereum"; // Default to ethereum format
  }

  async create(userId: string, dto: CreateWithdrawalDto) {
    const campaign = await this.firebase.getCampaignById(dto.campaignId) as any;

    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    if (campaign.organizerId !== userId) {
      throw new ForbiddenException("Only organizer can create withdrawals");
    }

    // Parse and validate amount
    const amountNum = parseFloat(dto.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new BadRequestException("Invalid amount");
    }

    // Determine actual withdrawal amount and token type
    let actualAmountNative: string; // Amount in native token (preserve decimals)
    let actualTokenType: TokenType = dto.tokenType;

    if (dto.tokenType === TokenType.INR) {
      // INR withdrawal - amount is in rupees
      actualAmountNative = amountNum.toString();
    } else {
      // Crypto withdrawal - check if amount is in INR or native crypto
      // If dto.amountInr is provided, convert from INR to crypto
      if ((dto as any).amountInr) {
        const inrAmount = parseFloat((dto as any).amountInr);
        if (isNaN(inrAmount) || inrAmount <= 0) {
          throw new BadRequestException("Invalid INR amount for conversion");
        }
        
        // Get crypto symbol and decimals for conversion
        const cryptoSymbol = this.getCryptoSymbol(dto.tokenType);
        const decimals = this.getTokenDecimals(dto.tokenType);
        
        // Get USD price of crypto, then convert INR -> USD -> Crypto
        try {
          const coingeckoId = this.getCoingeckoId(cryptoSymbol);
          const usdPrice = await this.fxRateService.getRate(coingeckoId);
          const inrToUsdRate = 83; // TODO: Get real INR/USD rate
          const usdAmount = inrAmount / inrToUsdRate;
          const cryptoAmount = usdAmount / parseFloat(usdPrice);
          actualAmountNative = cryptoAmount.toFixed(decimals);
        } catch (error: any) {
          throw new BadRequestException(`Failed to convert INR to ${cryptoSymbol}: ${error.message}`);
        }
      } else {
        // Amount is already in native crypto (preserve decimals)
        actualAmountNative = amountNum.toString();
      }
    }

    // Check available balance
    // For INR: amounts stored as integer strings (paise)
    // For crypto: amounts stored as decimal strings (native units)
    let availableAmount: bigint;
    if (actualTokenType === TokenType.INR) {
      const raisedPaise = BigInt(campaign.raisedInr || "0");
      const withdrawnPaise = BigInt(campaign.withdrawnInr || "0");
      availableAmount = raisedPaise - withdrawnPaise;
      
      // Convert requested amount to paise
      const requestedPaise = BigInt(Math.round(parseFloat(actualAmountNative) * 100));
      if (requestedPaise > availableAmount) {
        throw new BadRequestException(
          `Insufficient balance. Available: ₹${(Number(availableAmount) / 100).toFixed(2)}, Requested: ₹${actualAmountNative}`
        );
      }
    } else {
      // For crypto, use decimal string comparison (more accurate than BigInt)
      const raisedCrypto = parseFloat(campaign.raisedCrypto || "0");
      const withdrawnCrypto = parseFloat(campaign.withdrawnCrypto || "0");
      const availableCrypto = raisedCrypto - withdrawnCrypto;
      const requestedCrypto = parseFloat(actualAmountNative);
      
      if (requestedCrypto > availableCrypto) {
        const cryptoSymbol = this.getCryptoSymbol(actualTokenType);
        throw new BadRequestException(
          `Insufficient balance. Available: ${availableCrypto.toFixed(8)} ${cryptoSymbol}, Requested: ${actualAmountNative} ${cryptoSymbol}`
        );
      }
    }

    // Validate withdrawal details based on type
    if (dto.tokenType === TokenType.INR) {
      // INR withdrawals require bank account details
      if (!dto.bankAccountNumber || !dto.bankIfsc || !dto.bankAccountHolderName) {
        throw new BadRequestException("Bank account details are required for INR withdrawals");
      }
    } else {
      // Crypto withdrawals - validate address based on chain/network
      if (!dto.payee) {
        throw new BadRequestException("Recipient address is required for crypto withdrawals");
      }

      // Get network/chain info from DTO or use defaults
      const networkId = (dto as any).networkId || (dto as any).chainId?.toString() || "ethereum_mainnet";
      const cryptoSymbol = this.getCryptoSymbol(actualTokenType);
      
      // Get crypto config to determine address format
      let cryptoConfig: any = null;
      try {
        // Try to get config for specific chain (e.g., USDC-POLYGON)
        const chainKey = this.getChainKey(networkId);
        const cryptoKey = chainKey ? `${cryptoSymbol}-${chainKey}` : cryptoSymbol;
        cryptoConfig = (this.cryptoAddressService as any).SUPPORTED_CRYPTOS?.[cryptoKey] || 
                      (this.cryptoAddressService as any).SUPPORTED_CRYPTOS?.[cryptoSymbol];
      } catch (error) {
        // Fallback to default
      }

      // Validate address format based on chain
      const addressFormat = cryptoConfig?.addressFormat || "ethereum";
      const isValid = this.validateAddressForChain(dto.payee, addressFormat, networkId);
      
      if (!isValid) {
        const chainName = this.getChainName(networkId);
        throw new BadRequestException(
          `Invalid ${cryptoSymbol} address format for ${chainName}. Please check the address format for the selected chain.`
        );
      }
      
      // Validate token address for ERC20 tokens (only for EVM chains)
      if ((dto.tokenType === TokenType.USDC || dto.tokenType === TokenType.USDT) && 
          (addressFormat === "ethereum" || networkId.includes("ethereum") || networkId.includes("polygon") || networkId.includes("bsc"))) {
        if (!dto.tokenAddress || !dto.tokenAddress.startsWith("0x") || dto.tokenAddress.length !== 42) {
          throw new BadRequestException(`Valid token contract address required for ${dto.tokenType} on ${this.getChainName(networkId)}`);
        }
      }
    }

    // Get milestones (optional for direct withdrawals)
    let milestone = null;
    if (dto.milestoneId) {
      const milestones = await this.firebase.query("milestones", "campaignId", "==", dto.campaignId);
      milestone = milestones.find((m) => m.id === dto.milestoneId);
      
      if (!milestone) {
        throw new NotFoundException("Milestone not found");
      }
    }

    // Create evidence bundle and get hash/CID
    const { evidenceHash, evidenceCid } = await this.evidenceService.createEvidenceBundle(
      dto.evidenceBundle
    );

    // Check for duplicate hash
    const existing = await this.firebase.query("evidence", "evidenceHash", "==", evidenceHash);
    if (existing.length > 0) {
      throw new BadRequestException("Duplicate evidence hash detected");
    }

    // Evaluate policy (only for milestone-based withdrawals)
    if (milestone) {
      const policyResult = evaluateReleasePolicy({
        milestone: {
          ...milestone,
          capAmount: milestone.capAmount,
          releasedAmount: milestone.releasedAmount || "0",
          status: milestone.status as any,
        },
        campaignStatus: campaign.status as any,
        totalReleased: milestone.releasedAmount || "0",
        requestedAmount: dto.amount,
        coolingOffPassed: true,
        reviewWindowOpen: true,
        duplicateHashDetected: existing.length > 0,
        vendorAllowlisted: true,
      });

      if (!policyResult.allowed) {
        throw new BadRequestException(policyResult.reason);
      }
    }

    // Determine token address for crypto withdrawals
    let tokenAddr = dto.tokenAddress;
    if (dto.tokenType !== TokenType.INR) {
      // For crypto, set default token addresses if not provided
      if (!tokenAddr) {
        if (dto.tokenType === TokenType.USDC) {
          tokenAddr = process.env.USDC_TOKEN_ADDRESS || "0xA8CE8aee21bC2A48a5EF670afCc9254C68Dd62c3";
        } else if (dto.tokenType === TokenType.USDT) {
          tokenAddr = process.env.USDT_TOKEN_ADDRESS || "0x1E4a5963aBFD975d8c9021ce480b42188849D41d";
        } else if (dto.tokenType === TokenType.NATIVE) {
          tokenAddr = "0x0000000000000000000000000000000000000000"; // Native token
        }
      }
    }

    // Store amount - preserve decimals for crypto, convert to paise for INR
    const amountToStore = actualTokenType === TokenType.INR
      ? Math.round(parseFloat(actualAmountNative) * 100).toString() // Convert to paise
      : actualAmountNative; // Store as decimal string for crypto (preserve precision)

    // Get user info for requestedByName
    const user = await this.firebase.getUserById(userId) as any;
    const requestedByName = user?.name || "Organizer";

    // Generate withdrawal ID
    const withdrawalId = require("crypto").randomBytes(16).toString("hex");
    const db = this.firebase.firestore;
    const now = admin.firestore.FieldValue.serverTimestamp();

    // Prepare invoice info from evidenceBundle
    // proofIds may be in metadata.proofIds, metadata.proofFileUrl (as JSON string), or artifacts
    let proofIds: string[] = [];
    
    // First, try to get from metadata.proofIds (array)
    if (Array.isArray((dto.evidenceBundle as any)?.metadata?.proofIds)) {
      proofIds = (dto.evidenceBundle as any).metadata.proofIds;
    } 
    // Otherwise, try to parse from metadata.proofFileUrl (JSON string)
    else if ((dto.evidenceBundle as any)?.metadata?.proofFileUrl) {
      try {
        const parsed = JSON.parse((dto.evidenceBundle as any).metadata.proofFileUrl);
        if (Array.isArray(parsed)) {
          proofIds = parsed;
        }
      } catch (e) {
        // If parsing fails, try to extract from artifacts
        console.warn("Failed to parse proofFileUrl, trying artifacts:", e);
      }
    }
    
    // If still empty, try to extract from artifacts
    if (proofIds.length === 0 && Array.isArray((dto.evidenceBundle as any)?.artifacts)) {
      proofIds = (dto.evidenceBundle as any).artifacts
        .map((art: any) => art.hash || art.cid || art.proofId)
        .filter(Boolean);
    }
    const invoiceInfo = {
      vendorName: (dto.evidenceBundle as any)?.metadata?.vendorName || "",
      invoiceNumber: (dto.evidenceBundle as any)?.metadata?.invoiceNumber || "",
      invoiceDate: (dto.evidenceBundle as any)?.metadata?.invoiceDate || "",
      gstRegistered: (dto.evidenceBundle as any)?.metadata?.gstRegistered || false,
      gstin: (dto.evidenceBundle as any)?.metadata?.gstin || "",
      proofIds,
    };

    // Mask payee for public display
    const maskPayee = (payee: string, method: "INR" | "CRYPTO"): string => {
      if (!payee) return "";
      if (method === "CRYPTO") {
        // Mask crypto address: show first 6 and last 4 characters
        if (payee.length > 10) {
          return `${payee.substring(0, 6)}...${payee.substring(payee.length - 4)}`;
        }
        return payee;
      } else {
        // For INR, mask account number (last 4 digits)
        if (dto.bankAccountNumber && dto.bankAccountNumber.length >= 4) {
          return `****${dto.bankAccountNumber.slice(-4)}`;
        }
        return "****";
      }
    };

    // Create withdrawals_private doc (server/admin only)
    const privateRef = db.collection("withdrawals_private").doc(withdrawalId);
    await privateRef.set({
      withdrawalId,
      campaignId: dto.campaignId,
      requestedByUid: userId,
      requestedByName,
      method: actualTokenType === TokenType.INR ? "INR" : "CRYPTO",
      amountInrPaise: actualTokenType === TokenType.INR ? amountToStore : null,
      amountCryptoRaw: actualTokenType !== TokenType.INR ? amountToStore : null,
      decimals: actualTokenType !== TokenType.INR ? this.getTokenDecimals(actualTokenType) : null,
      assetSymbol: actualTokenType !== TokenType.INR ? this.getCryptoSymbol(actualTokenType) : null,
      networkId: (dto as any).networkId || null,
      payee: {
        // INR
        upiId: (dto as any).upiVpa || null,
        bankAccount: dto.bankAccountNumber || null,
        ifsc: dto.bankIfsc || null,
        accountName: dto.bankAccountHolderName || null,
        // CRYPTO
        address: actualTokenType !== TokenType.INR ? dto.payee : null,
        networkId: actualTokenType !== TokenType.INR ? ((dto as any).networkId || null) : null,
      },
      invoice: invoiceInfo,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    });

    // Create withdrawals_public doc (public)
    const amountDisplay = actualTokenType === TokenType.INR
      ? `₹${parseFloat(actualAmountNative).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
      : `${actualAmountNative} ${this.getCryptoSymbol(actualTokenType)}`;
    
    const publicRef = db
      .collection("withdrawals_public")
      .doc(dto.campaignId)
      .collection("items")
      .doc(withdrawalId);
    
    await publicRef.set({
      withdrawalId,
      campaignId: dto.campaignId,
      method: actualTokenType === TokenType.INR ? "INR" : "CRYPTO",
      amountDisplay,
      assetSymbol: actualTokenType !== TokenType.INR ? this.getCryptoSymbol(actualTokenType) : null,
      networkId: (dto as any).networkId || null,
      status: "PENDING",
      publicNote: "Pending review",
      proofSummary: { count: proofIds.length },
      payeeMasked: maskPayee(dto.payee || dto.bankAccountNumber || "", actualTokenType === TokenType.INR ? "INR" : "CRYPTO"),
      createdAt: now,
      updatedAt: now,
    });

    // Create review_queue doc
    const reviewQueueRef = db.collection("review_queue").doc(withdrawalId);
    await reviewQueueRef.set({
      withdrawalId,
      campaignId: dto.campaignId,
      createdAt: now,
      status: "PENDING",
      method: actualTokenType === TokenType.INR ? "INR" : "CRYPTO",
      amountInrPaise: actualTokenType === TokenType.INR ? amountToStore : null,
      assetSymbol: actualTokenType !== TokenType.INR ? this.getCryptoSymbol(actualTokenType) : null,
    });

    // Also create in legacy withdrawals collection for backward compatibility
    const withdrawal = await this.firebase.create("withdrawals", {
      id: withdrawalId,
      campaignId: dto.campaignId,
      milestoneId: dto.milestoneId || null,
      organizerId: userId,
      payee: dto.payee,
      amount: amountToStore,
      amountNative: actualAmountNative,
      tokenAddress: tokenAddr || (actualTokenType === TokenType.INR ? "INR" : ""),
      tokenType: actualTokenType,
      evidenceHash,
      evidenceCid,
      status: "SUBMITTED",
      bankAccountNumber: dto.bankAccountNumber,
      bankIfsc: dto.bankIfsc,
      bankAccountHolderName: dto.bankAccountHolderName,
    });

    // Store evidence record
    await this.firebase.create("evidence", {
      kind: "WITHDRAWAL_REQUEST",
      campaignId: dto.campaignId,
      evidenceHash,
      evidenceCid,
      amount: dto.amount,
      submitterId: userId,
    });

    // Anchor on-chain
    try {
      await this.web3Service.anchorEvidence({
        kind: EvidenceKind.WITHDRAWAL_REQUEST,
        campaignId: dto.campaignId,
        evidenceHash: `0x${evidenceHash}`,
        amount: actualAmountNative, // Use actual native amount
      });
    } catch (error) {
      console.error("Failed to anchor evidence:", error);
    }

    // Queue notification to donors
    const donations = await this.firebase.query("donations", "campaignId", "==", dto.campaignId);
    const uniqueDonorIds = [...new Set(donations.map((d) => d.donorId))];

    for (const donorId of uniqueDonorIds) {
      await this.queueService.addNotificationJob({
        userId: donorId,
        type: "WITHDRAWAL_REQUESTED",
        title: "Withdrawal Requested",
        message: `A withdrawal of ${actualAmountNative} ${actualTokenType === TokenType.INR ? 'INR' : this.getCryptoSymbol(actualTokenType)} has been requested for ${campaign.title}`,
        link: `/campaigns/${dto.campaignId}/proofs`,
      });
    }

    return {
      id: withdrawalId,
      ...withdrawal,
    };
  }

  /**
   * Get public withdrawals for a campaign
   */
  async getPublicWithdrawals(campaignId: string) {
    const db = this.firebase.firestore;
    const publicRef = db
      .collection("withdrawals_public")
      .doc(campaignId)
      .collection("items");
    
    const snapshot = await publicRef.orderBy("createdAt", "desc").get();
    
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  /**
   * Reject a withdrawal request
   */
  async reject(
    withdrawalId: string,
    reviewerId: string,
    reasonPublic: string,
    reasonInternal?: string
  ) {
    if (!reasonPublic || reasonPublic.trim().length === 0) {
      throw new BadRequestException("Public reason is required for rejection");
    }

    const db = this.firebase.firestore;
    const privateRef = db.collection("withdrawals_private").doc(withdrawalId);
    const privateDoc = await privateRef.get();
    
    if (!privateDoc.exists) {
      throw new NotFoundException("Withdrawal not found");
    }
    
    const withdrawal = privateDoc.data() as any;
    if (withdrawal.status !== "PENDING") {
      throw new BadRequestException(`Withdrawal is not in PENDING status. Current status: ${withdrawal.status}`);
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    // Update withdrawals_private
    await privateRef.update({
      status: "REJECTED",
      adminDecision: {
        decidedByUid: reviewerId,
        decidedAt: now,
        reason: reasonInternal || reasonPublic,
        note: reasonInternal,
      },
      updatedAt: now,
    });

    // Update withdrawals_public
    const publicRef = db
      .collection("withdrawals_public")
      .doc(withdrawal.campaignId)
      .collection("items")
      .doc(withdrawalId);
    
    await publicRef.update({
      status: "REJECTED",
      rejectionReasonPublic: reasonPublic,
      publicNote: `Rejected: ${reasonPublic}`,
      updatedAt: now,
    });

    // Update review_queue
    const reviewQueueRef = db.collection("review_queue").doc(withdrawalId);
    await reviewQueueRef.update({
      status: "REJECTED",
    });

    // Update legacy withdrawals collection for backward compatibility
    const legacyRef = db.collection("withdrawals").doc(withdrawalId);
    const legacyDoc = await legacyRef.get();
    if (legacyDoc.exists) {
      await legacyRef.update({
        status: "REJECTED",
        reviewerId,
        reviewNotes: reasonPublic,
      });
    }

    return {
      id: withdrawalId,
      status: "REJECTED",
      rejectionReasonPublic: reasonPublic,
    };
  }

  async approve(withdrawalId: string, reviewerId: string, notes?: string) {
    const db = this.firebase.firestore;
    const privateRef = db.collection("withdrawals_private").doc(withdrawalId);
    const privateDoc = await privateRef.get();
    
    if (!privateDoc.exists) {
      // Fallback to legacy collection
      const withdrawal = await this.firebase.getById("withdrawals", withdrawalId) as any;
      if (!withdrawal) {
        throw new NotFoundException("Withdrawal not found");
      }
      if (withdrawal.status !== "SUBMITTED") {
        throw new BadRequestException("Withdrawal is not in SUBMITTED status");
      }
      // Legacy withdrawals - would need separate handling
      throw new BadRequestException("Legacy withdrawal format detected. Please contact support.");
    }
    
    const withdrawal = privateDoc.data() as any;
    if (withdrawal.status !== "PENDING") {
      throw new BadRequestException(`Withdrawal is not in PENDING status. Current status: ${withdrawal.status}`);
    }

    const campaign = await this.firebase.getCampaignById(withdrawal.campaignId) as any;
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    // Handle INR withdrawals with Razorpay payout
    if (withdrawal.method === "INR") {
      const payee = withdrawal.payee || {};
      if (!payee.bankAccount || !payee.ifsc || !payee.accountName) {
        throw new BadRequestException("Bank account details are missing for INR withdrawal");
      }

      try {
        // withdrawal.amountInrPaise is already in paise (integer string)
        const amountInPaise = parseInt(withdrawal.amountInrPaise || "0");

        // Create Razorpay payout
        const payout = await this.razorpayService.createPayout({
          accountNumber: payee.bankAccount,
          amount: amountInPaise,
          currency: "INR",
          mode: "NEFT",
          purpose: "payout",
          fundAccount: {
            accountType: "bank_account",
            bankAccount: {
              name: payee.accountName,
              ifsc: payee.ifsc,
              accountNumber: payee.bankAccount,
            },
          },
          notes: {
            withdrawalId,
            campaignId: withdrawal.campaignId,
            reviewerId,
          },
        });

        const finalStatus = payout.requires_manual_processing ? "APPROVED" : "PAID";
        const payoutStatus = payout.status;

        // Update withdrawals_private
        await privateRef.update({
          status: finalStatus,
          adminDecision: {
            decidedByUid: reviewerId,
            decidedAt: now,
            note: notes,
          },
          payoutId: payout.id,
          payoutStatus,
          updatedAt: now,
        });

        // Update withdrawals_public
        const publicRef = db
          .collection("withdrawals_public")
          .doc(withdrawal.campaignId)
          .collection("items")
          .doc(withdrawalId);
        
        await publicRef.update({
          status: finalStatus,
          publicNote: finalStatus === "PAID" ? "Payment completed" : "Approved, payment processing",
          updatedAt: now,
        });

        // Update review_queue
        const reviewQueueRef = db.collection("review_queue").doc(withdrawalId);
        await reviewQueueRef.update({
          status: "APPROVED",
        });

        // Update campaign withdrawn amount
        const newWithdrawnInr = (
          BigInt(campaign.withdrawnInr || "0") + BigInt(withdrawal.amountInrPaise || "0")
        ).toString();
        await this.firebase.updateCampaign(withdrawal.campaignId, {
          withdrawnInr: newWithdrawnInr,
        });

        return {
          id: withdrawalId,
          status: finalStatus,
          payoutId: payout.id,
          payoutStatus,
        };
      } catch (error: any) {
        const message = error?.message || "Unknown error";
        throw new BadRequestException(`Failed to create Razorpay payout: ${message}`);
      }
    } else {
      // Handle Crypto withdrawals (blockchain flow)
      const payee = withdrawal.payee || {};
      if (!payee.address) {
        throw new BadRequestException("Recipient address is required for crypto withdrawals");
      }
      
      const networkId = withdrawal.networkId || "ethereum_mainnet";
      const assetSymbol = withdrawal.assetSymbol || "ETH";
      const amountCryptoRaw = withdrawal.amountCryptoRaw || "0";
      const decimals = withdrawal.decimals || 18;
      
      const addressFormat = this.getAddressFormatForCrypto(assetSymbol, this.getChainKey(networkId));
      const isValid = this.validateAddressForChain(payee.address, addressFormat, networkId);
      
      if (!isValid) {
        const chainName = this.getChainName(networkId);
        throw new BadRequestException(
          `Invalid ${assetSymbol} address format for ${chainName}. Expected ${addressFormat} format.`
        );
      }

      // Validate vault address
      if (!campaign.vaultAddress) {
        throw new BadRequestException("Campaign vault address not found. Vault must be deployed for crypto withdrawals.");
      }

      // Determine token address for release (use default token addresses based on asset)
      let tokenAddrForRelease = "0x0000000000000000000000000000000000000000"; // Default to native
      if (assetSymbol === "USDC") {
        tokenAddrForRelease = process.env.USDC_TOKEN_ADDRESS || "0xA8CE8aee21bC2A48a5EF670afCc9254C68Dd62c3";
      } else if (assetSymbol === "USDT") {
        tokenAddrForRelease = process.env.USDT_TOKEN_ADDRESS || "0x1E4a5963aBFD975d8c9021ce480b42188849D41d";
      }

      try {
        // Release funds from vault contract
        const txHash = await this.web3Service.releaseFunds(
          campaign.vaultAddress,
          null, // No milestone for direct withdrawals
          tokenAddrForRelease,
          amountCryptoRaw, // Use raw amount (integer string)
          payee.address,
          "" // evidenceHash - not needed for release
        );

        // Update withdrawals_private
        await privateRef.update({
          status: "PAID",
          adminDecision: {
            decidedByUid: reviewerId,
            decidedAt: now,
            note: notes,
          },
          txHash,
          updatedAt: now,
        });

        // Update withdrawals_public
        const publicRef = db
          .collection("withdrawals_public")
          .doc(withdrawal.campaignId)
          .collection("items")
          .doc(withdrawalId);
        
        await publicRef.update({
          status: "PAID",
          publicNote: "Payment completed",
          updatedAt: now,
        });

        // Update review_queue
        const reviewQueueRef = db.collection("review_queue").doc(withdrawalId);
        await reviewQueueRef.update({
          status: "APPROVED",
        });

        // Update campaign withdrawn amount
        const newWithdrawnCrypto = (
          BigInt(campaign.withdrawnCrypto || "0") + BigInt(amountCryptoRaw)
        ).toString();
        await this.firebase.updateCampaign(withdrawal.campaignId, {
          withdrawnCrypto: newWithdrawnCrypto,
        });

        return { 
          id: withdrawalId,
          txHash, 
          status: "PAID",
        };
      } catch (error: any) {
        const message = error?.message || "Unknown error";
        console.error("Crypto withdrawal error:", error);
        throw new BadRequestException(`Failed to release crypto funds: ${message}`);
      }
    }
  }

  /**
   * Get review queue (pending withdrawals)
   */
  async getReviewQueue(status: "PENDING" | "APPROVED" | "REJECTED" = "PENDING") {
    const db = this.firebase.firestore;
    const reviewQueueRef = db.collection("review_queue");
    
    // Fetch without orderBy to avoid composite index requirement, sort in memory instead
    const snapshot = await reviewQueueRef
      .where("status", "==", status)
      .limit(100)
      .get();
    
    // Fetch detailed info from withdrawals_private
    const withdrawals = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const queueItem = doc.data();
        const privateRef = db.collection("withdrawals_private").doc(queueItem.withdrawalId);
        const privateDoc = await privateRef.get();
        
        if (!privateDoc.exists) {
          return null;
        }
        
        const privateData = privateDoc.data() as any;
        const campaign = await this.firebase.getCampaignById(queueItem.campaignId) as any;
        
        return {
          withdrawalId: queueItem.withdrawalId,
          campaignId: queueItem.campaignId,
          campaignTitle: campaign?.title || "Unknown Campaign",
          method: queueItem.method,
          amountInrPaise: queueItem.amountInrPaise,
          amountNative: privateData.amountCryptoNative || null, // For crypto withdrawals
          assetSymbol: queueItem.assetSymbol,
          createdAt: queueItem.createdAt,
          status: queueItem.status,
          // Include invoice summary
          invoice: {
            vendorName: privateData.invoice?.vendorName,
            invoiceNumber: privateData.invoice?.invoiceNumber,
            proofCount: privateData.invoice?.proofIds?.length || 0,
            proofIds: privateData.invoice?.proofIds || [],
          },
        };
      })
    );
    
    // Filter out nulls and sort by createdAt descending (newest first)
    const validWithdrawals = withdrawals.filter((w) => w !== null);
    
    // Sort by createdAt descending (newest first)
    validWithdrawals.sort((a: any, b: any) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
      return bTime - aTime; // Descending order
    });
    
    return validWithdrawals;
  }

  /**
   * Get withdrawal details for review (admin/reviewer only)
   */
  async getWithdrawalForReview(withdrawalId: string) {
    const db = this.firebase.firestore;
    const privateRef = db.collection("withdrawals_private").doc(withdrawalId);
    const privateDoc = await privateRef.get();
    
    if (!privateDoc.exists) {
      throw new NotFoundException("Withdrawal not found");
    }
    
    const withdrawal = privateDoc.data() as any;
    const campaign = await this.firebase.getCampaignById(withdrawal.campaignId) as any;
    
    return {
      ...withdrawal,
      campaignTitle: campaign?.title || "Unknown Campaign",
    };
  }

  async findByCampaign(campaignId: string) {
    const withdrawals = await this.firebase.query("withdrawals", "campaignId", "==", campaignId);
    
    // Get organizer and reviewer info
    const withdrawalsWithUsers = await Promise.all(
      withdrawals.map(async (w: any) => {
        const organizer = await this.firebase.getUserById(w.organizerId);
        const reviewer = w.reviewerId ? await this.firebase.getUserById(w.reviewerId) : null;
        
        return {
          ...w,
          organizer: organizer ? {
            id: organizer.id,
            name: (organizer as any).name,
          } : null,
          reviewer: reviewer ? {
            id: reviewer.id,
            name: (reviewer as any).name,
          } : null,
        };
      })
    );

    return withdrawalsWithUsers.sort((a: any, b: any) => {
      const aTime = a.createdAt?.toDate?.() ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const bTime = b.createdAt?.toDate?.() ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }

  async getAvailableBalance(campaignId: string) {
    const campaign = await this.firebase.getCampaignById(campaignId) as any;

    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    const raisedInr = BigInt(campaign.raisedInr || "0");
    const withdrawnInr = BigInt(campaign.withdrawnInr || "0");
    const availableInr = raisedInr - withdrawnInr;

    const raisedCrypto = BigInt(campaign.raisedCrypto || "0");
    const withdrawnCrypto = BigInt(campaign.withdrawnCrypto || "0");
    const availableCrypto = raisedCrypto - withdrawnCrypto;

    return {
      inr: {
        raised: raisedInr.toString(),
        withdrawn: withdrawnInr.toString(),
        available: availableInr.toString(),
      },
      crypto: {
        raised: raisedCrypto.toString(),
        withdrawn: withdrawnCrypto.toString(),
        available: availableCrypto.toString(),
      },
    };
  }

  async markPayoutCompleted(
    withdrawalId: string,
    adminId: string,
    payoutId?: string,
    notes?: string
  ) {
    const withdrawal = await this.firebase.getById("withdrawals", withdrawalId) as any;

    if (!withdrawal) {
      throw new NotFoundException("Withdrawal not found");
    }

    if (withdrawal.status !== "APPROVED_PENDING_PAYOUT") {
      throw new BadRequestException("Withdrawal is not in APPROVED_PENDING_PAYOUT status");
    }

    // Update withdrawal to mark payout as completed
    await this.firebase.update("withdrawals", withdrawalId, {
      status: "APPROVED",
      payoutId: payoutId || withdrawal.payoutId,
      payoutStatus: "processed",
      payoutCompletedAt: new Date().toISOString(),
      payoutCompletedBy: adminId,
      payoutNotes: notes,
    });

    return {
      ...withdrawal,
      status: "APPROVED",
      payoutStatus: "processed",
    };
  }

  async getVaultBalance(campaignId: string, tokenAddress?: string) {
    const campaign = await this.firebase.getCampaignById(campaignId) as any;

    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    if (!campaign.vaultAddress) {
      throw new BadRequestException("Campaign vault not deployed");
    }

    try {
      const balance = await this.web3Service.getVaultBalance(
        campaign.vaultAddress,
        tokenAddress
      );

      return {
        vaultAddress: campaign.vaultAddress,
        tokenAddress: tokenAddress || "NATIVE",
        balance,
        campaignId,
      };
    } catch (error: any) {
      throw new BadRequestException(`Failed to get vault balance: ${error.message}`);
    }
  }
}

