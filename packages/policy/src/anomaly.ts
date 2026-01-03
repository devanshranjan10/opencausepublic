import { calculateAnomalyScore } from "./policy";

export interface AnomalyCheckResult {
  score: number;
  shouldPause: boolean;
  flags: string[];
}

export function checkAnomalies(context: {
  withdrawalAmount: string;
  milestoneCap: string;
  campaignTotalRaised: string;
  timeSinceLastWithdrawal?: number;
  vendorConcentration?: number;
  withdrawalCount: number;
}): AnomalyCheckResult {
  const score = calculateAnomalyScore(context);
  const flags: string[] = [];

  if (score >= 70) {
    flags.push("CRITICAL: High anomaly score detected");
  } else if (score >= 50) {
    flags.push("WARNING: Elevated anomaly score");
  }

  if (context.timeSinceLastWithdrawal !== undefined && context.timeSinceLastWithdrawal < 1) {
    flags.push("Rapid withdrawal detected");
  }

  if (context.vendorConcentration !== undefined && context.vendorConcentration > 70) {
    flags.push("High vendor concentration");
  }

  return {
    score,
    shouldPause: score >= 70,
    flags,
  };
}


