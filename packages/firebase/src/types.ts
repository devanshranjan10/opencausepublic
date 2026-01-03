/**
 * Firestore Type Definitions
 * 
 * Defines types for all Firestore collections per the data model spec.
 */

import * as admin from "firebase-admin";

export type Timestamp = admin.firestore.Timestamp;

// Export transparency types
export * from "./types-transparency";

// 1) crypto_networks/{networkId}
export interface CryptoNetworkDoc {
  type: "EVM" | "UTXO" | "SOL";
  chainId?: number;
  symbol: string;
  rpcUrlRef?: string;
  explorerBaseUrl: string;
  enabled: boolean;
  confirmationsRequired: number;
  coinType?: number;
  bech32Prefix?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// 2) crypto_assets/{assetId}
export interface CryptoAssetDoc {
  networkId: string;
  symbol: string;
  name: string;
  assetType: "NATIVE" | "ERC20" | "UTXO" | "SOL" | "SPL";
  contractAddress?: string;
  decimals: number;
  enabled: boolean;
  coingeckoId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// 3) campaigns/{campaignId}
export interface CampaignDoc {
  title: string;
  description?: string;
  createdBy: string;
  status: "DRAFT" | "LIVE" | "PAUSED" | "CLOSED";
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// 4) campaign_deposits/{campaignId_assetId_networkId}
export interface CampaignDepositDoc {
  campaignId: string;
  assetId: string;
  networkId: string;
  address: string;
  vaultAddress?: string;
  derivationPath?: string;
  addressIndex?: number;
  createdAt?: Timestamp;
}

// 5) payment_intents/{intentId}
export interface PaymentIntentDoc {
  campaignId: string;
  assetId: string; // Expected asset (what user selected)
  networkId: string; // Expected network (what user selected)
  depositRef: string; // campaign_deposits docId
  depositAddress: string; // The address shown in QR/copy
  amountNative: string; // decimal string (expected, formatted)
  amountUsd: string;
  fxRate: string;
  rateProvider: "COINGECKO" | "EXCHANGE" | "MANUAL";
  expiresAt: Timestamp;
  status: "CREATED" | "DETECTING" | "CONFIRMING" | "CONFIRMED" | "EXPIRED" | "FAILED" | "MISMATCH";
  
  // CRITICAL: replay protection + scanning cursor (per network for multi-chain detection)
  startBlockByNetwork?: { [networkId: string]: string }; // Block number at intent creation per network
  lastScannedBlockByNetwork?: { [networkId: string]: string }; // Scanning cursor per network
  
  // CRITICAL: exact amount match (like exchanges) - includes nonce
  expectedAmountRaw?: string; // in smallest units (wei / token units) with nonce
  expectedDecimals?: number;
  expectedTokenAddress?: string | null; // For ERC20, null for native
  expectedUsd?: string; // Expected USD amount (for display)
  expectedNative?: string; // Expected native amount (for display)
  
  // Detection result (what was actually received on-chain)
  detectedNetworkId?: string; // Actual network where tx was found
  detectedAssetType?: "NATIVE" | "ERC20";
  detectedTokenAddress?: string | null;
  detectedAmountRaw?: string; // Actual amount from chain
  detectedAmountNative?: string; // Actual amount formatted
  confirmedTxHash?: string; // Transaction hash that confirmed the intent
  actualAmountNative?: string; // Deprecated, use detectedAmountNative
  actualAmountRaw?: string; // Deprecated, use detectedAmountRaw
  usdAtConfirm?: string; // USD value at confirmation time
  txHash?: string; // Deprecated, use confirmedTxHash
  startBlock?: string; // Deprecated, use startBlockByNetwork
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// 6) chain_txs/{networkId_txHash}
export interface ChainTxDoc {
  networkId: string;
  assetId: string;
  depositRef: string;
  intentId?: string;
  txHash: string;
  from?: string;
  to: string;
  amountNative: string;
  block?: string | number;
  confirmations: number;
  status: "SEEN" | "CONFIRMING" | "CONFIRMED";
  explorerUrl: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// 7) campaign_stats/{campaignId}
export interface CampaignStatsDoc {
  totalsUsd: string;
  totalsByAsset: Record<string, string>; // assetId_networkId => total donated
  balanceByAsset: Record<string, string>; // assetId_networkId => current balance
  updatedAt?: Timestamp;
}

// 8) withdrawals/{withdrawalId}
export interface WithdrawalDoc {
  campaignId: string;
  milestoneId?: string | null;
  requesterUserId: string;
  
  // Currency and amount
  currency: "INR" | "USDT" | "USDC" | "ETH" | "MATIC";
  amount: string; // Decimal string
  amountNative?: string; // For crypto, same as amount in native units
  
  // Payout rail and details
  payoutRail: "UPI" | "BANK" | "CRYPTO";
  
  // INR payout fields (UPI)
  upiVpa?: string | null;
  
  // INR payout fields (BANK)
  bankAccountNumber?: string | null; // Encrypted
  bankIfsc?: string | null;
  bankBeneficiaryName?: string | null;
  
  // Crypto payout fields
  cryptoAddress?: string | null;
  chainId?: number | null;
  assetId?: string; // Legacy support
  networkId?: string; // Legacy support
  toAddress?: string; // Legacy support
  
  // Invoice/proof details
  invoiceNumber: string;
  invoiceDate: string; // ISO date string
  invoiceAmount: string; // Decimal string
  vendorName: string;
  vendorGstin?: string | null; // Required for INR
  proofFileUrl: string;
  proofMimeType: string;
  proofSha256: string;
  proofCids?: string[]; // Legacy IPFS support
  
  // GSTIN OCR status
  gstinOcrStatus?: "PENDING" | "FOUND" | "NOT_FOUND";
  
  // Status tracking
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "PAID";
  rejectionReason?: string | null;
  approvedAt?: Timestamp | null;
  paidAt?: Timestamp | null;
  
  // Transaction details (crypto)
  txHash?: string | null;
  explorerUrl?: string | null;
  
  // Legacy fields
  createdBy?: string; // Use requesterUserId
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// 9) withdrawal_approvals/{withdrawalId_reviewerId}
export interface WithdrawalApprovalDoc {
  withdrawalId: string;
  reviewerId: string;
  decision: "APPROVE" | "REJECT";
  note?: string;
  createdAt?: Timestamp;
}

// 10) key_configs/{keyId}
export interface KeyConfigDoc {
  type: "XPUB" | "SAFE" | "KMS" | "MPC" | "INDEX_STATE";
  networkId?: string;
  assetSymbol?: string;
  xpub?: string;
  kmsKeyRef?: string;
  mpcVaultRef?: string;
  safeAddress?: string;
  encryptedConfigBlob?: string;
  lastProcessedBlock?: string | number;
  updatedAt?: Timestamp;
}

// ============================================
// PUBLIC COLLECTIONS (client-readable)
// ============================================

// campaigns_public/{campaignId}
export interface CampaignPublicDoc {
  campaignId: string; // Reference to original campaign
  title: string;
  description?: string;
  goalInr: string;
  status: "DRAFT" | "LIVE" | "PAUSED" | "GOAL_MET" | "CLOSED";
  coverImage?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// campaign_stats_public/{campaignId}
export interface CampaignStatsPublicDoc {
  campaignId: string;
  goalInr: string;
  totalInrLive: string; // Computed from totalsByAsset + current prices
  totalsByAsset: Record<string, string>; // assetId => amountNative (string decimal)
  percent: number; // (totalInrLive / goalInr) * 100
  goalMet: boolean;
  updatedAt?: Timestamp;
}

// donations_public/{campaignId}/items/{donationId}
export interface DonationPublicDoc {
  donationId: string;
  campaignId: string;
  type: "CRYPTO" | "INR";
  donorLabel: string; // "Anonymous" or display name
  isAnonymous: boolean;

  // Amount truth
  assetSymbol: string; // "USDT", "BNB", "INR"
  networkId?: string; // "bsc" etc (crypto only)
  amountNative: string; // formatted string from chain or INR amount
  amountRaw?: string; // crypto only, smallest units
  decimals?: number; // crypto only

  // Verification
  verified: boolean; // true for both
  verifiedOnChain: boolean; // true ONLY for crypto
  txHashMasked?: string; // crypto only AND only if not anonymous
  explorerUrl?: string; // crypto only AND only if not anonymous
  txHashPrivateRef?: string; // points to private doc

  // Timestamps
  createdAt: Timestamp; // ALWAYS set (never unknown)
  blockTimestamp?: Timestamp; // crypto only, from chain block time
  blockNumber?: string; // crypto only

  // Fiat display
  inrAtConfirm?: string; // snapshot at confirm time
  updatedAt: Timestamp;
}

// payment_intents_public/{intentId}
export interface PaymentIntentPublicDoc {
  intentId: string;
  campaignId: string;
  status: "CREATED" | "DETECTING" | "CONFIRMING" | "CONFIRMED" | "EXPIRED" | "FAILED" | "MISMATCH";
  depositAddress: string;
  expectedAsset: string; // assetId
  expectedNetwork: string; // networkId
  expectedAmountNative?: string;
  expiresAt: Timestamp;
  // Detection result (what actually arrived):
  detectedNetworkId?: string;
  detectedAssetSymbol?: string;
  detectedAmountNative?: string;
  inrLive?: string;
  explorerUrl?: string; // Only if not anonymous
  txHashMasked?: string; // Only if not anonymous (first 6 + "…" + last 4)
  updatedAt?: Timestamp;
}

// ============================================
// PRIVATE COLLECTIONS (server-only)
// ============================================

// donations_private/{donationId}
export interface DonationPrivateDoc {
  donationId: string;
  campaignId: string;
  // Donor info (may be null for anonymous)
  donorUid?: string | null;
  donorEmail?: string | null;
  donorName?: string | null;
  isAnonymous: boolean;
  // Transaction details (always stored, even if anonymous)
  txHash: string; // Full hash (always stored for audit)
  fullExplorerUrl: string;
  networkId: string;
  assetId: string;
  assetSymbol: string;
  assetType: "NATIVE" | "ERC20" | "UTXO" | "SOL" | "SPL";
  rawAmount: string; // BigInt string
  decimals: number;
  tokenAddress?: string | null;
  amountNative: string; // Decimal string
  // Price snapshots
  inrAtConfirm: string;
  usdAtConfirm?: string;
  priceAtConfirm?: string;
  // Receipt/verification data
  receiptData?: any; // Full transaction receipt/logs
  blockNumber?: string;
  confirmations: number;
  createdAt?: Timestamp;
}

// payment_intents_private/{intentId}
export interface PaymentIntentPrivateDoc {
  intentId: string;
  campaignId: string;
  // Donor info (may be null)
  donorUid?: string | null;
  donorName?: string | null;
  isAnonymous: boolean;
  // Scanning/replay protection
  startBlockByNetwork: { [networkId: string]: string };
  lastScannedBlockByNetwork?: { [networkId: string]: string };
  // Expected amount (with nonce for uniqueness)
  expectedAmountRaw: string; // BigInt string with nonce
  expectedDecimals: number;
  expectedTokenAddress?: string | null;
  expectedAmountNative: string;
  // Detection result
  detectedNetworkId?: string;
  detectedAssetType?: "NATIVE" | "ERC20";
  detectedTokenAddress?: string | null;
  detectedAmountRaw?: string;
  detectedAmountNative?: string;
  confirmedTxHash?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// chain_txs_private/{networkId_txHash}
export interface ChainTxPrivateDoc {
  networkId: string;
  txHash: string; // Full hash
  to: string; // Deposit address
  from?: string;
  amountRaw: string; // BigInt string
  amountNative: string;
  assetType: "NATIVE" | "ERC20";
  tokenAddress?: string | null;
  blockNumber?: string;
  confirmations: number;
  status: "SEEN" | "CONFIRMING" | "CONFIRMED";
  explorerUrl: string;
  intentId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
