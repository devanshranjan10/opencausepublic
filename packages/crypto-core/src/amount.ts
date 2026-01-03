/**
 * Amount Conversion Utilities
 * 
 * Converts between native amounts (wei, satoshis, lamports) and human-readable decimals.
 */

import { CryptoAsset } from "./registry";

/**
 * Convert native amount (bigint/string) to decimal string
 */
export function fromNative(amountNative: string | bigint, decimals: number): string {
  const amount = typeof amountNative === "string" ? BigInt(amountNative) : amountNative;
  const divisor = BigInt(10 ** decimals);
  const quotient = amount / divisor;
  const remainder = amount % divisor;
  
  if (remainder === BigInt(0)) {
    return quotient.toString();
  }
  
  // Format with proper decimal places
  const remainderStr = remainder.toString().padStart(decimals, "0");
  const trimmed = remainderStr.replace(/0+$/, "");
  return `${quotient}.${trimmed}`;
}

/**
 * Convert decimal string to native amount (bigint)
 */
export function toNative(amountDecimal: string, decimals: number): bigint {
  const parts = amountDecimal.split(".");
  const whole = parts[0] || "0";
  const fractional = parts[1] || "";
  
  // Pad fractional part to required decimals
  const fractionalPadded = fractional.padEnd(decimals, "0").slice(0, decimals);
  
  return BigInt(whole) * BigInt(10 ** decimals) + BigInt(fractionalPadded);
}

/**
 * Format amount for display
 */
export function formatAmount(amountNative: string | bigint, asset: CryptoAsset): string {
  const decimal = fromNative(amountNative, asset.decimals);
  return `${decimal} ${asset.symbol}`;
}

/**
 * Parse amount from user input (handles commas, spaces, etc.)
 */
export function parseAmount(input: string): string {
  return input.replace(/[,\s]/g, "");
}






