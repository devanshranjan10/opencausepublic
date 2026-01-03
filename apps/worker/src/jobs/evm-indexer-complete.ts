/**
 * EVM Indexer Job - Complete Implementation
 * 
 * Indexes EVM chain events (DonationReceived, WithdrawalExecuted)
 * Updates chain_txs and payment_intents collections
 */

import { Job } from "bullmq";
import * as admin from "firebase-admin";
import { FirestoreRepository } from "@opencause/firebase";
import { getNetwork, getAsset } from "@opencause/crypto-core";
import { createPublicClient, http, getLogs, decodeEventLog, Address } from "viem";
import { mainnet, polygon, arbitrum, optimism, base, bsc, avalanche, fantom } from "viem/chains";

// Contract ABIs
const NATIVE_VAULT_ABI = [
  {
    type: "event",
    name: "DonationReceived",
    inputs: [
      { name: "campaignId", type: "bytes32", indexed: true },
      { name: "intentId", type: "bytes32", indexed: true },
      { name: "donor", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "WithdrawalExecuted",
    inputs: [
      { name: "campaignId", type: "bytes32", indexed: true },
      { name: "to", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "withdrawalId", type: "bytes32", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

const TOKEN_VAULT_ABI = [
  {
    type: "event",
    name: "DonationReceived",
    inputs: [
      { name: "campaignId", type: "bytes32", indexed: true },
      { name: "intentId", type: "bytes32", indexed: true },
      { name: "donor", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "WithdrawalExecuted",
    inputs: [
      { name: "campaignId", type: "bytes32", indexed: true },
      { name: "to", type: "address", indexed: false },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "withdrawalId", type: "bytes32", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

// Chain mapping
const CHAIN_MAP: Record<number, any> = {
  1: mainnet,
  137: polygon,
  42161: arbitrum,
  10: optimism,
  8453: base,
  56: bsc,
  43114: avalanche,
  250: fantom,
};

export async function processEVMIndexerJobComplete(
  job: Job,
  firestore: admin.firestore.Firestore
): Promise<void> {
  const { networkId, fromBlock, toBlock } = job.data;

  const repo = new FirestoreRepository(firestore);
  const network = getNetwork(networkId);

  if (!network || network.type !== "EVM" || !network.chainId) {
    throw new Error(`Invalid EVM network: ${networkId}`);
  }

  // Get last processed block
  const indexStateKey = `index_state_${networkId}`;
  const keyConfig = await repo.getKeyConfig(indexStateKey);
  const lastProcessed = keyConfig?.lastProcessedBlock
    ? BigInt(keyConfig.lastProcessedBlock as string)
    : (fromBlock ? BigInt(fromBlock) : BigInt(0));

  const endBlock = toBlock ? BigInt(toBlock) : await getLatestBlock(network);

  // Get RPC URL
  const rpcUrl = process.env[`${networkId.toUpperCase().replace(/-/g, "_")}_RPC_URL`] || "";
  if (!rpcUrl) {
    throw new Error(`RPC URL not configured for ${networkId}`);
  }

  // Create viem client
  const chain = CHAIN_MAP[network.chainId] || mainnet;
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  // Get all campaign deposits for this network
  const deposits = await firestore
    .collection("campaign_deposits")
    .where("networkId", "==", networkId)
    .where("vaultAddress", "!=", null)
    .get();

  const vaultAddresses = new Set<string>();
  const vaultToDeposit = new Map<string, any>();

  for (const doc of deposits.docs) {
    const deposit = doc.data();
    if (deposit.vaultAddress) {
      vaultAddresses.add(deposit.vaultAddress);
      vaultToDeposit.set(deposit.vaultAddress, { id: doc.id, ...deposit });
    }
  }

  if (vaultAddresses.size === 0) {
    console.log(`No vaults found for network ${networkId}`);
    return;
  }

  // Process each vault
  for (const vaultAddress of vaultAddresses) {
    const deposit = vaultToDeposit.get(vaultAddress);
    if (!deposit) continue;

    try {
      // Determine if this is a native or token vault
      // For now, try native vault first
      const isNative = deposit.assetType === "NATIVE" || !deposit.contractAddress;
      const abi = isNative ? NATIVE_VAULT_ABI : TOKEN_VAULT_ABI;

      // Get DonationReceived events
      const donationLogs = await getLogs(client, {
        address: vaultAddress as Address,
        event: abi.find((e) => e.name === "DonationReceived") as any,
        fromBlock: lastProcessed,
        toBlock: endBlock,
      });

      // Get WithdrawalExecuted events
      const withdrawalLogs = await getLogs(client, {
        address: vaultAddress as Address,
        event: abi.find((e) => e.name === "WithdrawalExecuted") as any,
        fromBlock: lastProcessed,
        toBlock: endBlock,
      });

      // Process donation logs
      for (const log of donationLogs) {
        const decoded = decodeEventLog({
          abi: abi as any,
          data: log.data,
          topics: log.topics,
        });

        if (decoded.eventName === "DonationReceived") {
          const args = decoded.args as any;
          const intentId = args.intentId as string;
          const txHash = log.transactionHash;
          const txDocId = `${networkId}_${txHash}`;

          // Check if already processed
          const existing = await repo.getChainTx(txDocId);
          if (existing) continue;

          // Get transaction receipt for confirmations
          const receipt = await client.getTransactionReceipt({ hash: txHash });
          const currentBlock = await client.getBlockNumber();
          const confirmations = Number(currentBlock - receipt.blockNumber);

          // Create chain transaction
          await repo.createOrUpdateChainTx(txDocId, {
            networkId,
            assetId: deposit.assetId,
            depositRef: deposit.id,
            intentId,
            txHash,
            from: args.donor,
            to: vaultAddress,
            amountNative: args.amount.toString(),
            block: receipt.blockNumber.toString(),
            confirmations,
            status: confirmations >= network.confirmationsRequired ? "CONFIRMED" : "CONFIRMING",
            explorerUrl: `${network.explorerBaseUrl}/tx/${txHash}`,
          });

          // Update payment intent status
          if (intentId) {
            const intent = await repo.getPaymentIntent(intentId);
            if (intent) {
              await repo.updatePaymentIntent(intentId, {
                status: confirmations >= network.confirmationsRequired ? "CONFIRMED" : "CONFIRMING",
                txHash,
              });
            }
          }

          console.log(`✅ Indexed donation: ${txHash} (${args.amount} wei)`);
        }
      }

      // Process withdrawal logs
      for (const log of withdrawalLogs) {
        const decoded = decodeEventLog({
          abi: abi as any,
          data: log.data,
          topics: log.topics,
        });

        if (decoded.eventName === "WithdrawalExecuted") {
          const args = decoded.args as any;
          const withdrawalId = args.withdrawalId as string;
          const txHash = log.transactionHash;

          // Update withdrawal record
          const withdrawal = await repo.getWithdrawal(withdrawalId);
          if (withdrawal) {
            await repo.updateWithdrawal(withdrawalId, {
              status: "EXECUTED",
              txHash,
              explorerUrl: `${network.explorerBaseUrl}/tx/${txHash}`,
            });
          }

          console.log(`✅ Indexed withdrawal: ${txHash} (${withdrawalId})`);
        }
      }
    } catch (error: any) {
      console.error(`Error indexing vault ${vaultAddress}:`, error.message);
      // Continue with next vault
    }
  }

  // Update last processed block
  await repo.updateKeyConfig(indexStateKey, {
    type: "INDEX_STATE",
    networkId,
    lastProcessedBlock: endBlock.toString(),
  });

  console.log(`✅ Indexed EVM network ${networkId} from block ${lastProcessed} to ${endBlock}`);
}

async function getLatestBlock(network: any): Promise<bigint> {
  const rpcUrl = process.env[`${network.networkId.toUpperCase().replace(/-/g, "_")}_RPC_URL`] || "";
  if (!rpcUrl) return BigInt(0);

  try {
    const chain = CHAIN_MAP[network.chainId] || mainnet;
    const client = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });
    return await client.getBlockNumber();
  } catch (error) {
    console.error(`Error getting latest block for ${network.networkId}:`, error);
    return BigInt(0);
  }
}






