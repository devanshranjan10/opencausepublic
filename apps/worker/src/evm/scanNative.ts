import { PublicClient } from "viem";

/**
 * Scan for native token transfers with exact value match
 * 
 * Note: This scans blocks sequentially which can be slow for large ranges.
 * In production, consider using WebSocket subscriptions for real-time detection.
 */
export async function scanNativeExact({
  client,
  toAddress,
  fromBlock,
  toBlock,
  expectedValue,
}: {
  client: PublicClient;
  toAddress: string;
  fromBlock: bigint;
  toBlock: bigint;
  expectedValue: bigint;
}) {
  const lowerAddress = toAddress.toLowerCase();
  
  // Limit scan range per call to avoid RPC abuse
  const maxBlocksPerScan = 50n;
  const scanTo = toBlock > fromBlock + maxBlocksPerScan ? fromBlock + maxBlocksPerScan : toBlock;

  try {
    // Get block with transactions
    for (let blockNum = fromBlock; blockNum <= scanTo; blockNum++) {
      try {
        const block = await client.getBlock({ blockNumber: blockNum, includeTransactions: true });
        
        if (!block.transactions || !Array.isArray(block.transactions)) {
          continue;
        }

        for (const tx of block.transactions) {
          if (typeof tx === "string") continue; // Skip hash-only transactions
          
          if (!tx.to) continue;
          if (tx.to.toLowerCase() !== lowerAddress) continue;
          if (tx.value !== expectedValue) continue;

          return {
            txHash: tx.hash as `0x${string}`,
            value: tx.value,
            blockNumber: blockNum.toString(),
          };
        }
      } catch (blockError: any) {
        // Skip blocks that fail to fetch
        if (!blockError.message?.includes("rate limit") && !blockError.message?.includes("timeout")) {
          console.warn(`Error fetching block ${blockNum}:`, blockError.message);
        }
        continue;
      }
    }
  } catch (error: any) {
    if (!error.message?.includes("rate limit") && !error.message?.includes("timeout")) {
      console.warn(`Error scanning native transfers:`, error.message);
    }
  }

  return null;
}






