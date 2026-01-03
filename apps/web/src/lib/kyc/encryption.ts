import CryptoJS from "crypto-js";

/**
 * Generate a random encryption key
 */
export function generateEncryptionKey(): string {
  return CryptoJS.lib.WordArray.random(256 / 8).toString();
}

/**
 * Derive encryption key from password using PBKDF2
 */
export function deriveKey(password: string, salt: string): string {
  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: 100000,
  });
  return key.toString();
}

/**
 * Encrypt data using AES-256
 */
export function encrypt(data: string, key: string): string {
  try {
    const encrypted = CryptoJS.AES.encrypt(data, key).toString();
    return encrypted;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt data using AES-256
 */
export function decrypt(encryptedData: string, key: string): string {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedString) {
      throw new Error("Failed to decrypt: Invalid key or corrupted data");
    }
    
    return decryptedString;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Generate a secure key for storing in localStorage
 * In production, consider using more secure storage mechanisms
 */
export function getOrCreateUserKey(userId: string): string {
  const keyName = `kyc_key_${userId}`;
  let key = localStorage.getItem(keyName);
  
  if (!key) {
    key = generateEncryptionKey();
    localStorage.setItem(keyName, key);
  }
  
  return key;
}

/**
 * Hash data for blockchain storage
 */
export function hashData(data: string): string {
  return CryptoJS.SHA256(data).toString();
}






