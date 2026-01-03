import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

/**
 * Bank account encryption/decryption utilities (server-side)
 * Uses AES-256-GCM for encryption at rest
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 12 bytes for GCM
const TAG_LENGTH = 16; // 16 bytes for authentication tag

/**
 * Get encryption key from environment variable
 */
function getEncryptionKey(): Buffer {
  const key = process.env.BANK_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("BANK_ENCRYPTION_KEY environment variable is required");
  }

  // If key is hex string (64 chars = 32 bytes), convert to buffer
  if (key.length === 64) {
    return Buffer.from(key, "hex");
  }

  // Otherwise, derive key from string (SHA256 hash)
  return createHash("sha256").update(key).digest();
}

/**
 * Encrypt bank account number
 */
export function encryptBankAccount(accountNumber: string): string {
  try {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(accountNumber, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Format: iv:encrypted:authTag (all as hex)
    return `${iv.toString("hex")}:${encrypted.toString("hex")}:${authTag.toString("hex")}`;
  } catch (error) {
    console.error("Error encrypting bank account:", error);
    throw new Error("Failed to encrypt bank account number");
  }
}

/**
 * Decrypt bank account number
 */
export function decryptBankAccount(encryptedData: string): string {
  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format");
    }

    const iv = Buffer.from(parts[0], "hex");
    const encrypted = Buffer.from(parts[1], "hex");
    const authTag = Buffer.from(parts[2], "hex");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString("utf8");
  } catch (error) {
    console.error("Error decrypting bank account:", error);
    throw new Error("Failed to decrypt bank account number");
  }
}

/**
 * Mask bank account number for display (show only last 4 digits)
 */
export function maskBankAccount(accountNumber: string): string {
  if (!accountNumber || accountNumber.length < 4) {
    return "****";
  }
  return `****${accountNumber.slice(-4)}`;
}






