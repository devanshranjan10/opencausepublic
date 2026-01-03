/**
 * Solana Watcher Job
 * 
 * Watches Solana addresses for deposits
 * Uses @solana/web3.js to monitor signatures
 */

import { Job } from "bullmq";
import * as admin from "firebase-admin";
import { FirestoreRepository } from "@opencause/firebase";
import { getNetwork, getAsset } from "@opencause/crypto-core";

export async function processSolWatcherJob(
  job: Job,
  firestore: admin.firestore.Firestore
): Promise<void> {
  const { networkId, addresses } = job.data;
  
  const repo = new FirestoreRepository(firestore);
  const network = getNetwork(networkId);
  
  if (!network || network.type !== "SOL") {
    throw new Error(`Invalid Solana network: ${networkId}`);
  }

  // Dynamically import @solana/web3.js (may not be installed)
  let Connection: any;
  let PublicKey: any;
  let LAMPORTS_PER_SOL: number;

  try {
    const solanaWeb3 = await import("@solana/web3.js");
    Connection = solanaWeb3.Connection;
    PublicKey = solanaWeb3.PublicKey;
    LAMPORTS_PER_SOL = solanaWeb3.LAMPORTS_PER_SOL;
  } catch (error) {
    console.error("@solana/web3.js not installed. Install it for Solana support.");
    throw new Error("Solana web3 library not available");
  }

  // Get RPC URL
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  for (const address of addresses) {
    try {
      const deposit = await repo.getDeposit(address); // Assuming address lookup
      if (!deposit) continue;

      const asset = await repo.getAsset(deposit.assetId);
      if (!asset) continue;

      // Get account info (balance)
      const pubkey = new PublicKey(deposit.address);
      const accountInfo = await connection.getAccountInfo(pubkey);

      if (!accountInfo) continue;

      // Get recent signatures
      const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 100 });

      for (const sigInfo of signatures) {
        const txDocId = `${networkId}_${sigInfo.signature}`;
        const existingTx = await repo.getChainTx(txDocId);

        if (existingTx) continue; // Already processed

        // Get transaction details
        const tx = await connection.getTransaction(sigInfo.signature, {
          commitment: "confirmed",
        });

        if (!tx || !tx.meta) continue;

        // Find transfers to our address
        const postBalances = tx.meta.postBalances;
        const preBalances = tx.meta.preBalances;
        const accountKeys = tx.transaction.message.accountKeys;

        let amountLamports = BigInt(0);
        for (let i = 0; i < accountKeys.length; i++) {
          if (accountKeys[i].toBase58() === deposit.address) {
            const change = BigInt(postBalances[i]) - BigInt(preBalances[i]);
            if (change > 0) {
              amountLamports += change;
            }
          }
        }

        if (amountLamports === BigInt(0)) continue;

        // Check confirmations (finalized commitment)
        const confirmations = sigInfo.confirmationStatus === "finalized" 
          ? network.confirmationsRequired 
          : 0;

        // Create chain transaction record
        await repo.createOrUpdateChainTx(txDocId, {
          networkId,
          assetId: deposit.assetId,
          depositRef: deposit.id,
          txHash: sigInfo.signature,
          to: deposit.address,
          amountNative: amountLamports.toString(),
          block: sigInfo.slot?.toString() || "pending",
          confirmations,
          status: confirmations >= network.confirmationsRequired ? "CONFIRMED" : "CONFIRMING",
          explorerUrl: `${network.explorerBaseUrl}/tx/${sigInfo.signature}`,
        });

        // Try to match with payment intent
        const recentIntents = await firestore
          .collection("payment_intents")
          .where("depositRef", "==", deposit.id)
          .where("status", "in", ["CREATED", "SEEN", "CONFIRMING"])
          .where("amountNative", ">=", (amountLamports * BigInt(99) / BigInt(100)).toString())
          .where("amountNative", "<=", (amountLamports * BigInt(101) / BigInt(100)).toString())
          .limit(1)
          .get();

        if (!recentIntents.empty) {
          const intent = recentIntents.docs[0];
          await repo.updatePaymentIntent(intent.id, {
            status: confirmations >= network.confirmationsRequired ? "CONFIRMED" : "CONFIRMING",
            txHash: sigInfo.signature,
          });
        }

        console.log(`✅ Detected Solana transaction ${sigInfo.signature} for ${deposit.address}: ${amountLamports} lamports`);
      }
    } catch (error) {
      console.error(`Error watching Solana address ${address}:`, error);
    }
  }
}






