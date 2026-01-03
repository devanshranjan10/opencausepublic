/**
 * UTXO Watcher Job
 * 
 * Watches Bitcoin and Litecoin addresses for deposits
 * Uses public APIs (Blockstream, Blockchair) or RPC
 */

import { Job } from "bullmq";
import * as admin from "firebase-admin";
import { FirestoreRepository } from "@opencause/firebase";
import { getNetwork, getAsset } from "@opencause/crypto-core";

interface UTXOTx {
  txid: string;
  vout: Array<{
    value: number;
    scriptpubkey_address: string;
  }>;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

export async function processUTXOWatcherJob(
  job: Job,
  firestore: admin.firestore.Firestore
): Promise<void> {
  const { networkId, addresses } = job.data; // Array of addresses to watch
  
  const repo = new FirestoreRepository(firestore);
  const network = getNetwork(networkId);
  
  if (!network || network.type !== "UTXO") {
    throw new Error(`Invalid UTXO network: ${networkId}`);
  }

  // Get deposits for these addresses
  const deposits = await Promise.all(
    addresses.map(async (address: string) => {
      const deposit = await repo.getDeposit(address); // Assuming address can be used as lookup
      return deposit;
    })
  );

  for (const deposit of deposits.filter(Boolean)) {
    if (!deposit) continue;

    const asset = await repo.getAsset(deposit.assetId);
    if (!asset) continue;

    try {
      // Fetch transactions for address
      const txs = await fetchAddressTransactions(network, deposit.address);
      
      for (const tx of txs) {
        // Find outputs to our address
        const relevantOutputs = tx.vout.filter(
          (vout) => vout.scriptpubkey_address === deposit.address
        );

        if (relevantOutputs.length === 0) continue;

        // Calculate total amount received
        const amountSatoshis = relevantOutputs.reduce(
          (sum, vout) => sum + Math.floor(vout.value * 1e8),
          0
        );

        const txDocId = `${networkId}_${tx.txid}`;
        const existingTx = await repo.getChainTx(txDocId);

        if (existingTx) continue; // Already processed

        // Get current block height for confirmations
        const currentHeight = await getCurrentBlockHeight(network);
        const confirmations = tx.status.confirmed && tx.status.block_height
          ? currentHeight - tx.status.block_height + 1
          : 0;

        // Create chain transaction record
        await repo.createOrUpdateChainTx(txDocId, {
          networkId,
          assetId: deposit.assetId,
          depositRef: deposit.id,
          txHash: tx.txid,
          to: deposit.address,
          amountNative: amountSatoshis.toString(),
          block: tx.status.block_height?.toString() || "pending",
          confirmations,
          status: confirmations >= network.confirmationsRequired ? "CONFIRMED" : "CONFIRMING",
          explorerUrl: `${network.explorerBaseUrl}/tx/${tx.txid}`,
        });

        // Try to match with payment intent
        // This is simplified - in production, match by amount and timing
        const recentIntents = await firestore
          .collection("payment_intents")
          .where("depositRef", "==", deposit.id)
          .where("status", "in", ["CREATED", "SEEN", "CONFIRMING"])
          .where("amountNative", ">=", (amountSatoshis * 0.99).toString()) // Allow 1% variance
          .where("amountNative", "<=", (amountSatoshis * 1.01).toString())
          .limit(1)
          .get();

        if (!recentIntents.empty) {
          const intent = recentIntents.docs[0];
          await repo.updatePaymentIntent(intent.id, {
            status: confirmations >= network.confirmationsRequired ? "CONFIRMED" : "CONFIRMING",
            txHash: tx.txid,
          });
        }

        console.log(`✅ Detected UTXO transaction ${tx.txid} for ${deposit.address}: ${amountSatoshis} sats`);
      }
    } catch (error) {
      console.error(`Error watching UTXO address ${deposit.address}:`, error);
    }
  }
}

/**
 * Fetch transactions for a UTXO address
 */
async function fetchAddressTransactions(
  network: any,
  address: string
): Promise<UTXOTx[]> {
  const explorerBaseUrl = network.explorerBaseUrl;

  try {
    // Try Blockstream API (Bitcoin)
    if (network.networkId === "bitcoin_mainnet" && explorerBaseUrl.includes("blockstream.info")) {
      const response = await fetch(`${explorerBaseUrl}/api/address/${address}/txs`);
      if (response.ok) {
        return await response.json();
      }
    }

    // Try Blockchair API (Bitcoin, Litecoin)
    if (explorerBaseUrl.includes("blockchair.com")) {
      const chain = network.networkId.includes("litecoin") ? "litecoin" : "bitcoin";
      const response = await fetch(
        `https://api.blockchair.com/${chain}/dashboards/address/${address}`
      );
      if (response.ok) {
        const data = await response.json();
        return data.data?.[address]?.transactions || [];
      }
    }

    // Fallback: return empty array if API unavailable
    console.warn(`Could not fetch transactions for ${address} from ${explorerBaseUrl}`);
    return [];
  } catch (error) {
    console.error(`Error fetching transactions for ${address}:`, error);
    return [];
  }
}

/**
 * Get current block height
 */
async function getCurrentBlockHeight(network: any): Promise<number> {
  try {
    if (network.explorerBaseUrl.includes("blockstream.info")) {
      const response = await fetch(`${network.explorerBaseUrl}/api/blocks/tip/height`);
      if (response.ok) {
        return parseInt(await response.text());
      }
    }

    if (network.explorerBaseUrl.includes("blockchair.com")) {
      const chain = network.networkId.includes("litecoin") ? "litecoin" : "bitcoin";
      const response = await fetch(`https://api.blockchair.com/${chain}/stats`);
      if (response.ok) {
        const data = await response.json();
        return data.data?.blocks || 0;
      }
    }

    return 0;
  } catch (error) {
    console.error(`Error fetching block height for ${network.networkId}:`, error);
    return 0;
  }
}






