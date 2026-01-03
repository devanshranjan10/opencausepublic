/**
 * EVM Indexer Job
 * 
 * Indexes EVM chain events (DonationReceived, WithdrawalExecuted)
 * Updates chain_txs and payment_intents collections
 */

import { Job } from "bullmq";
import * as admin from "firebase-admin";
import { processEVMIndexerJobComplete } from "./evm-indexer-complete";

export async function processEVMIndexerJob(
  job: Job,
  firestore: admin.firestore.Firestore
): Promise<void> {
  // Use the complete implementation
  return processEVMIndexerJobComplete(job, firestore);
}
