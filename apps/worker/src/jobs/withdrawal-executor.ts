/**
 * Withdrawal Executor Job
 * 
 * Executes approved withdrawals via Safe multisig or direct signing
 */

import { Job } from "bullmq";
import * as admin from "firebase-admin";
import { FirestoreRepository } from "@opencause/firebase";
import { getNetwork, getAsset } from "@opencause/crypto-core";

export async function processWithdrawalExecutorJob(
  job: Job,
  firestore: admin.firestore.Firestore
): Promise<void> {
  const { withdrawalId } = job.data;
  
  const repo = new FirestoreRepository(firestore);
  const withdrawal = await repo.getWithdrawal(withdrawalId);

  if (!withdrawal) {
    throw new Error(`Withdrawal ${withdrawalId} not found`);
  }

  if (withdrawal.status !== "APPROVED") {
    throw new Error(`Withdrawal ${withdrawalId} is ${withdrawal.status}, cannot execute`);
  }

  const network = getNetwork(withdrawal.networkId);
  const asset = getAsset(withdrawal.assetId);

  if (!network || !asset) {
    throw new Error(`Invalid network or asset for withdrawal ${withdrawalId}`);
  }

  // Update status to EXECUTING
  await repo.updateWithdrawal(withdrawalId, {
    status: "EXECUTING",
  });

  try {
    let txHash: string;
    let explorerUrl: string;

    if (network.type === "EVM") {
      // Execute EVM withdrawal via Safe multisig or direct
      const result = await executeEVMWithdrawal(network, asset, withdrawal, repo);
      txHash = result.txHash;
      explorerUrl = `${network.explorerBaseUrl}/tx/${txHash}`;
    } else if (network.type === "UTXO") {
      // Execute UTXO withdrawal (PSBT + broadcast)
      const result = await executeUTXOWithdrawal(network, asset, withdrawal);
      txHash = result.txHash;
      explorerUrl = `${network.explorerBaseUrl}/tx/${txHash}`;
    } else if (network.type === "SOL") {
      // Execute Solana withdrawal
      const result = await executeSolanaWithdrawal(network, asset, withdrawal);
      txHash = result.txHash;
      explorerUrl = `${network.explorerBaseUrl}/tx/${txHash}`;
    } else {
      throw new Error(`Unsupported network type: ${network.type}`);
    }

    // Update withdrawal with tx hash
    await repo.updateWithdrawal(withdrawalId, {
      status: "EXECUTED",
      txHash,
      explorerUrl,
    });

    console.log(`✅ Executed withdrawal ${withdrawalId}: ${txHash}`);
  } catch (error: any) {
    console.error(`❌ Failed to execute withdrawal ${withdrawalId}:`, error);
    await repo.updateWithdrawal(withdrawalId, {
      status: "FAILED",
    });
    throw error;
  }
}

/**
 * Execute EVM withdrawal
 */
async function executeEVMWithdrawal(
  network: any,
  asset: any,
  withdrawal: any,
  repo: FirestoreRepository
): Promise<{ txHash: string }> {
  // Get deposit to find vault address
  const deposits = await repo.getDepositsByCampaign(withdrawal.campaignId);
  const deposit = deposits.find(
    (d) => d.assetId === withdrawal.assetId && d.networkId === withdrawal.networkId
  );

  if (!deposit || !deposit.vaultAddress) {
    throw new Error("Deposit or vault address not found");
  }

  // Get Safe address from key config
  const safeKeyConfig = await repo.getKeyConfig(`safe_${withdrawal.networkId}`);
  if (!safeKeyConfig || !safeKeyConfig.safeAddress) {
    throw new Error("Safe address not configured for this network");
  }

  const safeAddress = safeKeyConfig.safeAddress;
  const safeServiceUrl = process.env.SAFE_RPC_URL || "https://safe-transaction-mainnet.safe.global";
  
  // Import Safe service
  const { SafeMultisigService } = await import("../services/safe-multisig");
  const safeService = new SafeMultisigService(safeServiceUrl);

  // Get Safe nonce
  const safeInfo = await fetch(`${safeServiceUrl}/api/v1/safes/${safeAddress}/`);
  const safeData = await safeInfo.json();
  const nonce = safeData.nonce || 0;

  // Build transaction based on asset type
  let transaction;
  if (asset.assetType === "NATIVE") {
    transaction = safeService.buildNativeTransferTransaction(
      withdrawal.toAddress,
      withdrawal.amountNative,
      nonce
    );
  } else {
    // ERC20 token
    if (!asset.contractAddress) {
      throw new Error("Contract address not found for ERC20 token");
    }
    transaction = safeService.buildERC20TransferTransaction(
      asset.contractAddress,
      withdrawal.toAddress,
      withdrawal.amountNative,
      nonce
    );
  }

  // TODO: Sign transaction with KMS or get signature from authorized signer
  // For now, this requires external signing
  // The signature should be generated offline or via KMS
  
  // This is a placeholder - in production, you need to:
  // 1. Get signature from authorized Safe signer (via KMS/HSM/offline)
  // 2. Propose transaction to Safe service
  // 3. Wait for execution (if threshold is met) or monitor for execution
  
  throw new Error(
    "EVM withdrawal requires Safe transaction signing - implement KMS/signer integration"
  );
  
  // Example (once signature is obtained):
  // const signature = await getSignatureFromKMS(transaction, safeAddress);
  // const safeTxHash = await safeService.proposeTransaction(safeAddress, transaction, signature);
  // return { txHash: safeTxHash };
}

/**
 * Execute UTXO withdrawal
 */
async function executeUTXOWithdrawal(
  network: any,
  asset: any,
  withdrawal: any
): Promise<{ txHash: string }> {
  // TODO: Implement PSBT builder and broadcast
  // 1. Create PSBT
  // 2. Sign with key (from KMS/MPC)
  // 3. Broadcast via RPC or public API
  
  throw new Error("UTXO withdrawal execution not implemented - requires PSBT builder and signing");
}

/**
 * Execute Solana withdrawal
 */
async function executeSolanaWithdrawal(
  network: any,
  asset: any,
  withdrawal: any
): Promise<{ txHash: string }> {
  // TODO: Implement Solana transaction builder and broadcast
  // 1. Build transfer transaction
  // 2. Sign with key (from KMS/MPC)
  // 3. Broadcast via RPC
  
  throw new Error("Solana withdrawal execution not implemented - requires transaction builder and signing");
}
