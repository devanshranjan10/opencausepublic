import { z } from "zod";
import {
  SignupSchema,
  LoginSchema,
  UserProfileSchema,
  KYCSchema,
  VCSchema,
  CreateCampaignSchema,
  CampaignSchema,
  MilestoneSchema,
  CreateDonationSchema,
  DonationSchema,
  CreateWithdrawalSchema,
  WithdrawalSchema,
  EvidenceBundleSchema,
  AnchorEvidenceSchema,
} from "./schemas";

export type SignupDto = z.infer<typeof SignupSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type KYCDto = z.infer<typeof KYCSchema>;
export type VC = z.infer<typeof VCSchema>;
export type CreateCampaignDto = z.infer<typeof CreateCampaignSchema>;
export type Campaign = z.infer<typeof CampaignSchema>;
export type Milestone = z.infer<typeof MilestoneSchema>;
export type CreateDonationDto = z.infer<typeof CreateDonationSchema>;
export type Donation = z.infer<typeof DonationSchema>;
export type CreateWithdrawalDto = z.infer<typeof CreateWithdrawalSchema>;
export type Withdrawal = z.infer<typeof WithdrawalSchema>;
export type EvidenceBundle = z.infer<typeof EvidenceBundleSchema>;
export type AnchorEvidenceDto = z.infer<typeof AnchorEvidenceSchema>;


