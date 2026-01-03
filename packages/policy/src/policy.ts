import { Milestone, Withdrawal } from "@opencause/types";

export interface PolicyContext {
  milestone: Milestone;
  campaignStatus: string;
  totalReleased: string;
  requestedAmount: string;
  payeeRole?: string;
  payeeVCStatus?: string;
  coolingOffPassed: boolean;
  reviewWindowOpen: boolean;
  duplicateHashDetected: boolean;
  vendorAllowlisted: boolean;
}

export interface PolicyResult {
  allowed: boolean;
  reason?: string;
}

export function evaluateReleasePolicy(context: PolicyContext): PolicyResult {
  // Check milestone cap
  const capBigInt = BigInt(context.milestone.capAmount);
  const releasedBigInt = BigInt(context.milestone.releasedAmount);
  const requestedBigInt = BigInt(context.requestedAmount);
  const newTotal = releasedBigInt + requestedBigInt;

  if (newTotal > capBigInt) {
    return {
      allowed: false,
      reason: `Requested amount exceeds milestone cap. Cap: ${context.milestone.capAmount}, Already released: ${context.milestone.releasedAmount}, Requested: ${context.requestedAmount}`,
    };
  }

  // Check campaign status
  if (context.campaignStatus !== "ACTIVE") {
    return {
      allowed: false,
      reason: `Campaign is not active. Current status: ${context.campaignStatus}`,
    };
  }

  // Check milestone status
  if (context.milestone.status !== "OPEN" && context.milestone.status !== "IN_REVIEW") {
    return {
      allowed: false,
      reason: `Milestone is not open for withdrawals. Current status: ${context.milestone.status}`,
    };
  }

  // Check cooling off period
  if (!context.coolingOffPassed) {
    return {
      allowed: false,
      reason: `Cooling off period not yet passed. Required: ${context.milestone.coolingOffHours} hours`,
    };
  }

  // Check duplicate hash
  if (context.duplicateHashDetected) {
    return {
      allowed: false,
      reason: "Duplicate evidence hash detected. This invoice/receipt has already been used.",
    };
  }

  // Check vendor allowlist (if payee is vendor)
  if (context.payeeRole === "VENDOR" && !context.vendorAllowlisted) {
    return {
      allowed: false,
      reason: "Vendor is not allowlisted",
    };
  }

  // Check vendor VC status
  if (context.payeeRole === "VENDOR" && context.payeeVCStatus !== "VERIFIED") {
    return {
      allowed: false,
      reason: "Vendor KYC/VC status is not verified",
    };
  }

  return { allowed: true };
}

export function calculateAnomalyScore(context: {
  withdrawalAmount: string;
  milestoneCap: string;
  campaignTotalRaised: string;
  timeSinceLastWithdrawal?: number; // hours
  vendorConcentration?: number; // percentage
  withdrawalCount: number;
}): number {
  let score = 0;

  // Large withdrawal relative to cap
  const amountBigInt = BigInt(context.withdrawalAmount);
  const capBigInt = BigInt(context.milestoneCap);
  const percentageOfCap = Number((amountBigInt * 100n) / capBigInt);
  if (percentageOfCap > 80) score += 30;
  else if (percentageOfCap > 50) score += 15;

  // Rapid withdrawals
  if (context.timeSinceLastWithdrawal !== undefined && context.timeSinceLastWithdrawal < 1) {
    score += 25;
  } else if (context.timeSinceLastWithdrawal !== undefined && context.timeSinceLastWithdrawal < 6) {
    score += 10;
  }

  // High vendor concentration
  if (context.vendorConcentration !== undefined && context.vendorConcentration > 70) {
    score += 20;
  }

  // High withdrawal count
  if (context.withdrawalCount > 10) {
    score += 15;
  }

  return Math.min(100, score);
}


