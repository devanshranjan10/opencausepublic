/**
 * Utility to mask transaction hash for public display
 * Returns first 6 chars + "…" + last 4 chars
 * Example: 0x1234...5678
 */
export function maskTxHash(txHash: string): string {
  if (!txHash || txHash.length < 10) {
    return txHash; // Too short to mask
  }
  
  // Remove 0x prefix if present for processing
  const hash = txHash.startsWith("0x") ? txHash.slice(2) : txHash;
  const prefix = txHash.startsWith("0x") ? "0x" : "";
  
  if (hash.length < 10) {
    return txHash; // Still too short
  }
  
  return `${prefix}${hash.slice(0, 6)}…${hash.slice(-4)}`;
}






