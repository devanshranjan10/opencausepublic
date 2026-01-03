import { Injectable } from "@nestjs/common";
import { createPublicClient, http } from "viem";
import { getNetwork, getAsset } from "@opencause/crypto-core";

@Injectable()
export class CryptoVerificationService {
  /**
   * Verify transaction on different blockchains with confirmation checking
   */
  async verifyTransaction(
    txHash: string,
    networkId: string,
    assetId: string,
    expectedAmount?: string,
    expectedAddress?: string,
    minConfirmations: number = 2
  ): Promise<{
    verified: boolean;
    confirmations: number;
    amount?: string;
    from?: string;
    to?: string;
    blockNumber?: string;
    error?: string;
  }> {
    const network = getNetwork(networkId);
    const asset = getAsset(assetId);
    
    if (!network || !asset) {
      return { verified: false, confirmations: 0, error: `Invalid network or asset: ${networkId}/${assetId}` };
    }

    try {
      switch (network.type) {
        case "EVM":
          return await this.verifyEthereumTransaction(
            txHash,
            networkId,
            asset,
            expectedAmount,
            expectedAddress,
            minConfirmations
          );
        case "UTXO":
          return await this.verifyBitcoinTransaction(
            txHash,
            networkId,
            asset,
            expectedAmount,
            expectedAddress,
            minConfirmations
          );
        case "SOL":
          return await this.verifySolanaTransaction(
            txHash,
            networkId,
            asset,
            expectedAmount,
            expectedAddress,
            minConfirmations
          );
        default:
          return { verified: false, confirmations: 0, error: `Verification not implemented for ${network.type}` };
      }
    } catch (error: any) {
      return { verified: false, confirmations: 0, error: error.message || "Verification failed" };
    }
  }

  /**
   * Verify Ethereum-based transaction with confirmation checking
   */
  private async verifyEthereumTransaction(
    txHash: string,
    networkId: string,
    asset: any,
    expectedAmount?: string,
    expectedAddress?: string,
    minConfirmations: number = 2
  ) {
    try {
      const network = getNetwork(networkId);
      if (!network || network.type !== "EVM") {
        return { verified: false, confirmations: 0, error: "Invalid EVM network" };
      }

      // Get RPC URL based on network
      const rpcUrl = this.getRpcUrl(networkId);
      if (!rpcUrl) {
        return { verified: false, confirmations: 0, error: "RPC URL not configured" };
      }

      const publicClient = createPublicClient({
        transport: http(rpcUrl),
      });

      const receipt = await publicClient.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      });

      if (receipt.status !== "success") {
        return { verified: false, confirmations: 0, error: "Transaction failed" };
      }

      // Get current block number to calculate confirmations
      const currentBlock = await publicClient.getBlockNumber();
      const confirmations = Number(currentBlock - receipt.blockNumber);

      // Check if we have minimum confirmations
      if (confirmations < minConfirmations) {
        return {
          verified: false,
          confirmations,
          error: `Transaction needs at least ${minConfirmations} confirmations. Current: ${confirmations}`,
        };
      }

      // Get transaction details
      const tx = await publicClient.getTransaction({
        hash: txHash as `0x${string}`,
      });

      let amount: string;
      let to: string | undefined;
      let from: string | undefined;

      // Handle ERC20 token transfers
      if (asset.assetType === "ERC20" && asset.contractAddress) {
        // Parse Transfer event from logs
        const transferEventSignature = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"; // Transfer(address,address,uint256)
        const tokenAddress = asset.contractAddress.toLowerCase();

        console.log(`Looking for ERC20 Transfer event for token: ${tokenAddress}`);
        console.log(`Transaction has ${receipt.logs.length} logs`);

        // Find the Transfer event log
        const transferLog = receipt.logs.find(
          (log) =>
            log.address.toLowerCase() === tokenAddress &&
            log.topics[0] === transferEventSignature
        );

        if (!transferLog || transferLog.topics.length < 3) {
          // Log all log addresses for debugging
          const logAddresses = receipt.logs.map(log => log.address.toLowerCase());
          console.error(`ERC20 Transfer event not found. Token address: ${tokenAddress}, Log addresses: ${logAddresses.join(", ")}`);
          return {
            verified: false,
            confirmations,
            error: `ERC20 Transfer event not found in transaction. Expected token: ${tokenAddress}`,
          };
        }

        // Extract from, to, and value from Transfer event
        // topics[0] = event signature
        // topics[1] = from address (indexed, padded to 32 bytes)
        // topics[2] = to address (indexed, padded to 32 bytes)
        // data = value (uint256)
        from = "0x" + transferLog.topics[1].slice(-40); // Get last 40 chars (20 bytes = address)
        to = "0x" + transferLog.topics[2].slice(-40); // Get last 40 chars
        amount = BigInt(transferLog.data).toString();
        
        console.log(`ERC20 Transfer found: from=${from}, to=${to}, amount=${amount}`);
      } else {
        // Native token transfer
        amount = tx.value.toString();
        to = receipt.to || tx.to || undefined;
        from = receipt.from || tx.from || undefined;
        console.log(`Native token transfer: amount=${amount}, to=${to}`);
      }

      // Verify address if provided
      if (expectedAddress) {
        const expectedAddrLower = expectedAddress.toLowerCase();
        const toAddrLower = to?.toLowerCase();
        
        if (!toAddrLower || toAddrLower !== expectedAddrLower) {
          return {
            verified: false,
            confirmations,
            error: `Address mismatch. Expected: ${expectedAddress}, Got: ${to || "unknown"}`,
          };
        }
      }

      // Verify amount if provided (allow for slight variance due to decimals)
      // Note: Amounts should be in the smallest unit (wei for ETH, smallest unit for tokens)
      if (expectedAmount) {
        // Handle decimal strings by converting to integer first
        // If expectedAmount contains a decimal, it's likely a human-readable format
        // We need to convert it to the smallest unit for comparison
        let expectedBigInt: bigint;
        try {
          // Try direct BigInt conversion first (for integer strings)
          if (expectedAmount.includes(".")) {
            // If it's a decimal, parse as float and round to integer
            const parsedFloat = parseFloat(expectedAmount);
            if (isNaN(parsedFloat)) {
              throw new Error(`Invalid amount format: ${expectedAmount}`);
            }
            expectedBigInt = BigInt(Math.round(parsedFloat));
          } else {
            // It's already an integer string
            expectedBigInt = BigInt(expectedAmount);
          }
        } catch (error: any) {
          return {
            verified: false,
            confirmations,
            error: `Invalid expected amount format: ${expectedAmount}. ${error.message}`,
          };
        }

        const actual = BigInt(amount);
        
        // Log for debugging
        console.log(`Amount verification: Expected=${expectedAmount} (${expectedBigInt}), Actual=${amount} (${actual}), Asset=${asset.symbol}, Type=${asset.assetType}`);
        
        // For ERC20 tokens, allow exact match or very close (within 1%)
        // For native tokens, require exact match or higher
        if (asset.assetType === "ERC20") {
          // Allow 1% tolerance for ERC20 (sometimes there are rounding issues)
          const tolerance = expectedBigInt / BigInt(100);
          if (actual < expectedBigInt - tolerance) {
            return {
              verified: false,
              confirmations,
              error: `Amount mismatch for ${asset.symbol}. Expected: ${expectedAmount}, Got: ${amount}`,
            };
          }
        } else {
          // Native tokens: require exact match or higher
          if (actual < expectedBigInt) {
            return {
              verified: false,
              confirmations,
              error: `Amount mismatch. Expected: ${expectedAmount}, Got: ${amount}`,
            };
          }
        }
      }

      return {
        verified: true,
        confirmations,
        amount,
        from,
        to,
        blockNumber: receipt.blockNumber.toString(),
      };
    } catch (error: any) {
      return { verified: false, confirmations: 0, error: error.message || "Transaction not found" };
    }
  }

  /**
   * Verify Bitcoin transaction (placeholder - requires Bitcoin RPC or block explorer API)
   */
  private async verifyBitcoinTransaction(
    txHash: string,
    networkId: string,
    asset: any,
    expectedAmount?: string,
    expectedAddress?: string,
    minConfirmations: number = 2
  ) {
    // In production, use Bitcoin RPC or block explorer API (e.g., Blockstream, Blockchair)
    // For now, return a placeholder
    return {
      verified: false,
      confirmations: 0,
      error: "Bitcoin verification requires Bitcoin RPC or block explorer API",
    };
  }

  /**
   * Verify Solana transaction (placeholder - requires Solana RPC)
   */
  private async verifySolanaTransaction(
    txHash: string,
    networkId: string,
    asset: any,
    expectedAmount?: string,
    expectedAddress?: string,
    minConfirmations: number = 2
  ) {
    // In production, use Solana RPC
    // For now, return a placeholder
    return {
      verified: false,
      confirmations: 0,
      error: "Solana verification requires Solana RPC",
    };
  }

  /**
   * Get RPC URL for network
   */
  private getRpcUrl(networkId: string): string | null {
    const rpcUrls: Record<string, string> = {
      ethereum_mainnet: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
      polygon_mainnet: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      bsc_mainnet: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org",
      avalanche_mainnet: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
      arbitrum_mainnet: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
      optimism_mainnet: process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
      base_mainnet: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      fantom_mainnet: process.env.FANTOM_RPC_URL || "https://rpc.ftm.tools",
    };

    return rpcUrls[networkId] || null;
  }
}

