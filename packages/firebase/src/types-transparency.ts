/**
 * Enhanced types for transparent milestones + proof-based withdrawals + activity feed
 */

import * as admin from "firebase-admin";
export type Timestamp = admin.firestore.Timestamp;

// ============================================
// PROOF POLICY & CAMPAIGN ENHANCEMENTS
// ============================================

export type ExpenseCategory = 
  | "MATERIALS"
  | "SERVICES"
  | "EDUCATION"
  | "HEALTHCARE"
  | "INFRASTRUCTURE"
  | "ADMINISTRATIVE"
  | "MARKETING"
  | "OTHER";

export type DocumentType =
  | "GST_TAX_INVOICE"
  | "RECEIPT"
  | "QUOTATION"
  | "PAYMENT_PROOF"
  | "INSTITUTION_VERIFICATION"
  | "PHOTO_VIDEO"
  | "CONTRACT"
  | "OTHER";

export interface ProofPolicy {
  // Default GST invoice requirement (not hard requirement, but preference)
  gstInvoiceExpected?: boolean;
  
  // Allowed expense categories for this campaign
  allowedCategories: ExpenseCategory[];
  
  // Allowed document types per category
  allowedDocTypesByCategory: Record<ExpenseCategory, DocumentType[]>;
  
  // Feature flags
  advancePaymentsAllowed: boolean;
  reimbursementsAllowed: boolean;
  
  // When to show proofs publicly
  showProofsAfter: "APPROVAL" | "PAYMENT"; // Default: "APPROVAL"
  
  // Show rejection reasons publicly?
  showRejectionReasons: boolean; // Default: false
}

export type MilestoneStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "FUNDING_COMPLETED"
  | "WITHDRAWAL_IN_REVIEW"
  | "PAID_OUT";

export interface MilestoneDoc {
  id: string;
  campaignId: string;
  title: string;
  description: string;
  targetAmountInr?: string; // Decimal string
  targetAmountCrypto?: string; // Decimal string
  targetCurrency?: string; // Which currency this milestone targets
  status: MilestoneStatus;
  
  // Proof policy override (optional, inherits from campaign if not set)
  proofPolicyOverride?: Partial<ProofPolicy>;
  
  // Computed fields (updated by allocation logic)
  receivedAmountInr?: string;
  receivedAmountCrypto?: string;
  
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  fundingCompletedAt?: Timestamp;
}

export interface DonationAllocationDoc {
  id: string;
  donationId: string;
  campaignId: string;
  milestoneId: string;
  amount: string; // Decimal string
  currency: string; // "INR" | crypto symbol
  createdAt?: Timestamp;
}

// ============================================
// EVENT SYSTEM (Activity Feed)
// ============================================

export type EventType =
  | "CAMPAIGN_PUBLISHED"
  | "DONATION_RECEIVED"
  | "DONATION_ALLOCATED"
  | "MILESTONE_FUNDING_COMPLETED"
  | "WITHDRAWAL_SUBMITTED"
  | "WITHDRAWAL_UNDER_REVIEW"
  | "WITHDRAWAL_APPROVED"
  | "WITHDRAWAL_REJECTED"
  | "WITHDRAWAL_PAID"
  | "PROOF_PUBLISHED";

export type EventVisibility = "PUBLIC" | "ORGANIZER_ONLY" | "ADMIN_ONLY";

export type EventEntityType = "DONATION" | "MILESTONE" | "WITHDRAWAL" | "CAMPAIGN";

export interface EventDoc {
  id: string; // cuid
  campaignId: string;
  type: EventType;
  visibility: EventVisibility;
  actorUserId?: string | null; // User who triggered (nullable for system events)
  entityType: EventEntityType;
  entityId: string; // Reference to Donation.id, Milestone.id, WithdrawalRequest.id, etc.
  data: Record<string, any>; // JSON blob: amounts, masked info, tx hash, milestone title snapshot, etc.
  createdAt: Timestamp;
  
  // Indexed fields for querying
  _campaignId: string; // Denormalized for queries
  _type: EventType;
  _entityType: EventEntityType;
  _entityId: string;
}

// ============================================
// ENHANCED WITHDRAWAL REQUEST (Policy-driven)
// ============================================

export interface WithdrawalLineItemDoc {
  id: string;
  withdrawalRequestId: string;
  category: ExpenseCategory;
  expenseType: string; // e.g., "Textbooks", "Tuition", "Supplies"
  description: string;
  amount: string; // Decimal string
  currency: string;
  createdAt?: Timestamp;
}

export interface WithdrawalDocumentDoc {
  id: string;
  withdrawalRequestId: string;
  documentType: DocumentType;
  fileUrl: string;
  fileMimeType: string;
  fileSha256: string;
  metadata?: Record<string, any>; // e.g., institutionName, vendorName, etc.
  createdAt?: Timestamp;
}

export interface CounterpartyDoc {
  id: string;
  withdrawalRequestId: string;
  name: string;
  gstRegistered: boolean;
  gstin?: string | null;
  contactInfo?: Record<string, any>; // phone, email (optional)
  createdAt?: Timestamp;
}

// Enhanced withdrawal request (extends existing WithdrawalDoc)
export interface WithdrawalRequestEnhancedDoc {
  // Existing fields from WithdrawalDoc
  campaignId: string;
  milestoneId?: string | null; // Required if campaign has milestones (unless single pool)
  requesterUserId: string;
  currency: "INR" | "USDT" | "USDC" | "ETH" | "MATIC";
  amount: string;
  payoutRail: "UPI" | "BANK" | "CRYPTO";
  
  // Payout details (existing)
  upiVpa?: string | null;
  bankAccountNumber?: string | null; // Encrypted
  bankIfsc?: string | null;
  bankBeneficiaryName?: string | null;
  cryptoAddress?: string | null;
  chainId?: number | null;
  
  // Policy-driven fields (new)
  purposeCategory: ExpenseCategory;
  lineItems?: string[]; // Array of WithdrawalLineItemDoc IDs (relation)
  documents?: string[]; // Array of WithdrawalDocumentDoc IDs (relation)
  counterparty?: string | null; // CounterpartyDoc ID (relation)
  
  // Invoice/evidence fields (existing)
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  invoiceAmount?: string | null;
  vendorName?: string | null;
  vendorGstin?: string | null;
  
  // Status and audit (existing)
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "PAID";
  rejectionReason?: string | null;
  approvedAt?: Timestamp | null;
  paidAt?: Timestamp | null;
  txHash?: string | null;
  explorerUrl?: string | null;
  gstinOcrStatus?: "PENDING" | "FOUND" | "NOT_FOUND";
  
  // Flags
  isAdvance?: boolean; // If true, auto-flag UNDER_REVIEW
  isReimbursement?: boolean;
  
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================
// ENHANCED CAMPAIGN (extends existing)
// ============================================

export interface CampaignEnhancedDoc {
  // Existing fields
  id: string;
  title: string;
  description?: string;
  category?: string;
  coverImageUrl?: string;
  status: "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED" | "REJECTED";
  organizerId: string;
  goalInr?: string;
  goalCrypto?: string;
  raisedInr?: string;
  raisedCrypto?: string;
  startDate?: Timestamp;
  endDate?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  
  // New fields for transparency
  currenciesEnabled?: string[]; // ["INR", "USDT", "ETH", ...]
  proofPolicy?: ProofPolicy;
  isSinglePool?: boolean; // If true, no milestone allocation (direct withdrawals)
  
  // Computed/public fields
  milestones?: string[]; // Array of MilestoneDoc IDs (denormalized for queries)
  publishedAt?: Timestamp | null;
}

