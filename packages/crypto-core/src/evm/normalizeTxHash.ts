/**
 * Normalize transaction hash to ensure it's a valid 32-byte (64 hex chars) hash
 * Pads with leading zeros if needed and validates format
 */
export function normalizeTxHash(input: string): `0x${string}` {
  const raw = (input || "").trim().toLowerCase();
  if (!raw.startsWith("0x")) {
    throw new Error("Transaction hash must start with 0x");
  }

  let hex = raw.slice(2).replace(/[^0-9a-f]/g, "");
  if (hex.length > 64) {
    throw new Error("Transaction hash too long (max 64 hex characters)");
  }
  if (hex.length === 0) {
    throw new Error("Transaction hash cannot be empty");
  }

  // Pad leading zeros to 32 bytes (64 hex characters)
  hex = hex.padStart(64, "0");

  if (hex.length !== 64) {
    throw new Error(`Invalid transaction hash length: expected 64 hex chars, got ${hex.length}`);
  }

  return `0x${hex}` as const;
}







