import { z } from "zod";

/**
 * Enhanced withdrawal request validation schemas
 */

export const WithdrawalCurrencySchema = z.enum(["INR", "USDT", "USDC", "ETH", "MATIC"]);

export const WithdrawalPayoutRailSchema = z.enum(["UPI", "BANK", "CRYPTO"]);

export const WithdrawalStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "PAID",
]);

export const GstinOcrStatusSchema = z.enum(["PENDING", "FOUND", "NOT_FOUND"]);

// UPI validation regex
const upiVpaRegex = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;

// IFSC validation regex
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// GSTIN validation regex
const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// Ethereum address validation
const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;

// Bank account number: 8-18 digits
const bankAccountRegex = /^[0-9]{8,18}$/;

/**
 * Base withdrawal request schema (shared fields)
 */
const BaseWithdrawalRequestSchema = z.object({
  campaignId: z.string().min(1, "Campaign ID is required").optional(), // Optional in form, set in API
  milestoneId: z.string().nullable().optional(),
  currency: WithdrawalCurrencySchema,
  payoutRail: WithdrawalPayoutRailSchema,
  amount: z.string().regex(/^\d+(\.\d+)?$/, "Invalid amount format"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invoice date must be in YYYY-MM-DD format"),
  invoiceAmount: z.string().regex(/^\d+(\.\d+)?$/, "Invalid invoice amount format"),
  vendorName: z.string().min(1, "Vendor name is required"),
  vendorGstin: z.string().optional(),
  proofFileUrl: z.string().url("Proof file URL is required"),
  proofMimeType: z.string().regex(/^image\/(jpeg|jpg|png|webp)$/, "Only image files are allowed"),
  proofSha256: z.string().length(64, "SHA256 hash must be 64 characters"),
});

/**
 * INR withdrawal with payout rail validation
 */
export const INRWithdrawalRequestSchema = BaseWithdrawalRequestSchema.extend({
  currency: z.literal("INR"),
  payoutRail: z.enum(["UPI", "BANK"]),
  vendorGstin: z
    .string()
    .regex(gstinRegex, "Invalid GSTIN format")
    .refine((val) => val.length === 15, "GSTIN must be 15 characters"),
  // UPI fields (required if payoutRail = UPI)
  upiVpa: z
    .string()
    .regex(upiVpaRegex, "Invalid UPI VPA format")
    .optional(),
  // Bank fields (required if payoutRail = BANK)
  bankAccountNumber: z
    .string()
    .regex(bankAccountRegex, "Bank account must be 8-18 digits")
    .optional(),
  bankIfsc: z
    .string()
    .regex(ifscRegex, "Invalid IFSC code format")
    .optional(),
  bankBeneficiaryName: z.string().min(1).optional(),
  // Crypto fields not needed
  cryptoAddress: z.string().optional(),
  chainId: z.number().optional(),
}).refine(
  (data) => {
    // Amount must equal invoice amount
    const amount = parseFloat(data.amount);
    const invoiceAmount = parseFloat(data.invoiceAmount);
    return Math.abs(amount - invoiceAmount) < 0.01;
  },
  {
    message: "Withdrawal amount must exactly match invoice amount",
    path: ["amount"],
  }
).refine(
  (data) => {
    if (data.payoutRail === "UPI") {
      return !!data.upiVpa;
    }
    return true;
  },
  {
    message: "UPI VPA is required when payout rail is UPI",
    path: ["upiVpa"],
  }
).refine(
  (data) => {
    if (data.payoutRail === "BANK") {
      return !!data.bankAccountNumber && !!data.bankIfsc && !!data.bankBeneficiaryName;
    }
    return true;
  },
  {
    message: "Bank account details are required when payout rail is BANK",
    path: ["bankAccountNumber"],
  }
);

/**
 * Crypto withdrawal validation
 */
export const CryptoWithdrawalRequestSchema = BaseWithdrawalRequestSchema.extend({
  currency: z.enum(["USDT", "USDC", "ETH", "MATIC"]),
  payoutRail: z.literal("CRYPTO"),
  cryptoAddress: z
    .string()
    .regex(ethAddressRegex, "Invalid Ethereum address format"),
  chainId: z.number().int().positive("Chain ID must be positive"),
  // GSTIN not required for crypto
  vendorGstin: z.string().optional(),
  // INR payout fields not needed
  upiVpa: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankIfsc: z.string().optional(),
  bankBeneficiaryName: z.string().optional(),
}).refine(
  (data) => {
    const amount = parseFloat(data.amount);
    const invoiceAmount = parseFloat(data.invoiceAmount);
    return Math.abs(amount - invoiceAmount) < 0.01;
  },
  {
    message: "Withdrawal amount must exactly match invoice amount",
    path: ["amount"],
  }
);

/**
 * Union schema for withdrawal request
 * Using regular union instead of discriminatedUnion for better zodResolver compatibility
 */
export const CreateWithdrawalRequestSchema = z.union([
  INRWithdrawalRequestSchema,
  CryptoWithdrawalRequestSchema,
]);

export type CreateWithdrawalRequestInput = z.infer<typeof CreateWithdrawalRequestSchema>;
export type INRWithdrawalRequestInput = z.infer<typeof INRWithdrawalRequestSchema>;
export type CryptoWithdrawalRequestInput = z.infer<typeof CryptoWithdrawalRequestSchema>;

/**
 * File upload schema
 */
export const FileUploadSchema = z.object({
  file: z.instanceof(File),
  maxSize: z.number().default(10 * 1024 * 1024), // 10MB default
  allowedTypes: z.array(z.string()).default(["image/jpeg", "image/jpg", "image/png", "image/webp"]),
});

/**
 * Withdrawal approval schema
 */
export const ApproveWithdrawalSchema = z.object({
  notes: z.string().optional(),
});

/**
 * Reject withdrawal schema
 */
export const RejectWithdrawalSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});

/**
 * Mark paid schema
 */
export const MarkPaidWithdrawalSchema = z.object({
  txHash: z.string().regex(ethAddressRegex).optional(),
});

