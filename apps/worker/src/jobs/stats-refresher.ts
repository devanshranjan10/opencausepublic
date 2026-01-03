/**
 * Stats Refresher Job
 * 
 * Refreshes campaign stats: totals donated, current balances
 */

import { Job } from "bullmq";
import * as admin from "firebase-admin";
import { FirestoreRepository } from "@opencause/firebase";

export async function processStatsRefresherJob(
  job: Job,
  firestore: admin.firestore.Firestore
): Promise<void> {
  const { campaignId } = job.data;
  
  const repo = new FirestoreRepository(firestore);

  // Get all confirmed transactions for this campaign
  const deposits = await repo.getDepositsByCampaign(campaignId);
  
  const totalsByAsset: Record<string, string> = {};
  const balanceByAsset: Record<string, string> = {};
  let totalUsd = 0;

  for (const deposit of deposits) {
    const assetKey = `${deposit.assetId}_${deposit.networkId}`;
    
    // Get confirmed transactions
    const txs = await repo.getChainTxsByDeposit(deposit.id);
    const confirmed = txs.filter((tx) => tx.status === "CONFIRMED");
    
    // Sum totals
    let total = BigInt(0);
    for (const tx of confirmed) {
      total += BigInt(tx.amountNative);
    }
    
    totalsByAsset[assetKey] = total.toString();
    
    // TODO: Get current on-chain balance
    // For EVM: read vault balance
    // For UTXO: sum UTXOs
    // For SOL: read account balance
    balanceByAsset[assetKey] = total.toString(); // Placeholder
    
    // TODO: Convert to USD using FX rates
    // totalUsd += convertedUsd;
  }

  // Update campaign stats
  await repo.updateCampaignStats(campaignId, {
    totalsUsd: totalUsd.toString(),
    totalsByAsset,
    balanceByAsset,
  });

  console.log(`✅ Refreshed stats for campaign ${campaignId}`);
}






