import { decodeEventLog, parseAbiItem, PublicClient } from "viem";

const ERC20_TRANSFER = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

/**
 * Scan for ERC20 Transfer events with exact value match
 */
export async function scanErc20Exact({
  client,
  tokenAddress,
  toAddress,
  fromBlock,
  toBlock,
  expectedValue,
}: {
  client: PublicClient;
  tokenAddress: `0x${string}`;
  toAddress: `0x${string}`;
  fromBlock: bigint;
  toBlock: bigint;
  expectedValue: bigint;
}) {
  try {
    const logs = await client.getLogs({
      address: tokenAddress,
      event: ERC20_TRANSFER,
      fromBlock,
      toBlock,
      args: { to: toAddress },
    });

    for (const log of logs) {
      try {
        const decoded = decodeEventLog({
          abi: [ERC20_TRANSFER],
          data: log.data,
          topics: log.topics,
        });
        const value = (decoded.args as any).value as bigint;
        if (value === expectedValue) {
          return {
            txHash: log.transactionHash as `0x${string}`,
            value,
            blockNumber: log.blockNumber?.toString(),
          };
        }
      } catch (decodeError) {
        // Skip logs that can't be decoded
        continue;
      }
    }
  } catch (error: any) {
    // Log error but don't throw (network issues are expected)
    if (!error.message?.includes("rate limit") && !error.message?.includes("timeout")) {
      console.warn(`Error scanning ERC20 logs:`, error.message);
    }
  }

  return null;
}






