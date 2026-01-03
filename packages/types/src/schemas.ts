import { z } from "zod";
import {
  UserRole,
  CampaignStatus,
  MilestoneStatus,
  WithdrawalStatus,
  DonationType,
  EvidenceKind,
  KYCStatus,
  TokenType,
} from "./enums";

// Auth & User
export const SignupSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  name: z.string().min(1),
  otp: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  otp: z.string().optional(),
  password: z.string().optional(),
});

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.nativeEnum(UserRole),
  did: z.string().optional(),
  kycStatus: z.nativeEnum(KYCStatus),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// KYC & VC
export const KYCSchema = z.object({
  name: z.string(),
  aadhaarLast4: z.string().length(4).optional(),
  pan: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  // NGO specific
  registrationNumber: z.string().optional(),
  section12A: z.string().optional(),
  section80G: z.string().optional(),
  fcraRegistered: z.boolean().optional(),
});

export const VCSchema = z.object({
  "@context": z.array(z.string()),
  type: z.array(z.string()),
  credentialSubject: z.record(z.any()),
  issuer: z.string(),
  issuanceDate: z.string(),
  proof: z.object({
    type: z.string(),
    created: z.string(),
    proofPurpose: z.string(),
    verificationMethod: z.string(),
    jws: z.string().optional(),
  }),
});

// Campaign
export const MilestoneSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  capAmount: z.string(), // BigInt as string
  proofTypes: z.array(z.string()),
  coolingOffHours: z.number().default(0),
  reviewWindowHours: z.number().default(24),
  status: z.nativeEnum(MilestoneStatus).default(MilestoneStatus.PENDING),
  releasedAmount: z.string().default("0"),
});

export const CreateCampaignSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string(),
  goalInr: z.string(),
  goalCrypto: z.string().optional(),
  startDate: z.date(),
  endDate: z.date(),
  milestones: z.array(MilestoneSchema).min(1),
  imageUrl: z.string().optional(), // Can be URL or base64 data URI
});

export const CampaignSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  goalInr: z.string(),
  goalCrypto: z.string().optional(),
  raisedInr: z.string().default("0"),
  raisedCrypto: z.string().default("0"),
  status: z.nativeEnum(CampaignStatus),
  vaultAddress: z.string().optional(),
  organizerId: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Donation
export const CreateDonationSchema = z.object({
  campaignId: z.string(),
  type: z.nativeEnum(DonationType),
  amount: z.string(),
  amountUsd: z.string().optional(), // USD value for crypto donations to calculate INR equivalent
  tokenAddress: z.string().optional(),
  tokenType: z.nativeEnum(TokenType).optional(),
  txHash: z.string().optional(),
  orderId: z.string().optional(),
});

export const DonationSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  donorId: z.string(),
  type: z.nativeEnum(DonationType),
  amount: z.string(),
  tokenAddress: z.string().optional(),
  tokenType: z.nativeEnum(TokenType).optional(),
  txHash: z.string().optional(),
  orderId: z.string().optional(),
  evidenceHash: z.string().optional(),
  createdAt: z.date(),
});

// Withdrawal & Evidence
export const EvidenceArtifactSchema = z.object({
  type: z.string(), // invoice, receipt, photo, document
  cid: z.string().optional(),
  hash: z.string(),
  url: z.string().optional(),
});

export const EvidenceBundleSchema = z.object({
  milestoneId: z.string(),
  payee: z.string(),
  amount: z.string(),
  artifacts: z.array(EvidenceArtifactSchema),
  invoiceHash: z.string().optional(),
  mediaHashes: z.array(z.string()).optional(),
  signatures: z.record(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

export const CreateWithdrawalSchema = z.object({
  campaignId: z.string(),
  milestoneId: z.string().optional(), // Optional for direct INR/Crypto withdrawals
  payee: z.string(),
  amount: z.string(), // Amount in native crypto or INR
  amountInr: z.string().optional(), // Optional: Amount in INR (for crypto withdrawals with INR input)
  tokenAddress: z.string().optional(), // Optional for INR withdrawals, required for ERC20 tokens
  tokenType: z.nativeEnum(TokenType),
  networkId: z.string().optional(), // Network/chain ID (e.g., "ethereum_mainnet", "polygon_mainnet")
  chainId: z.number().optional(), // Legacy chain ID support
  evidenceBundle: EvidenceBundleSchema,
  // Bank account details for INR withdrawals
  bankAccountNumber: z.string().optional(),
  bankIfsc: z.string().optional(),
  bankAccountHolderName: z.string().optional(),
});

export const WithdrawalSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  milestoneId: z.string(),
  organizerId: z.string(),
  payee: z.string(),
  amount: z.string(),
  tokenAddress: z.string(),
  tokenType: z.nativeEnum(TokenType),
  evidenceHash: z.string(),
  evidenceCid: z.string().optional(),
  status: z.nativeEnum(WithdrawalStatus),
  txHash: z.string().optional(),
  reviewerId: z.string().optional(),
  reviewNotes: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Evidence Registry
export const AnchorEvidenceSchema = z.object({
  kind: z.nativeEnum(EvidenceKind),
  campaignId: z.string().optional(),
  amount: z.string().optional(),
  evidenceHash: z.string(),
  metadata: z.record(z.any()).optional(),
});


