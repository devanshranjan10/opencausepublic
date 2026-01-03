/**
 * UTXO Address Generation - Proper Bech32 Implementation
 * 
 * Uses proper bech32 encoding for Bitcoin and Litecoin addresses
 * CRITICAL: LTC must use ltc1 prefix, BTC uses bc1 prefix
 */

import { createHash } from "crypto";
import { HDKey } from "@scure/bip32";

// Bech32 encoding implementation (simplified but correct)
const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const value of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) {
      if ((top >>> i) & 1) {
        chk ^= GEN[i];
      }
    }
  }
  return chk;
}

function hrpExpand(hrp: string): number[] {
  const result: number[] = [];
  for (let i = 0; i < hrp.length; i++) {
    result.push(hrp.charCodeAt(i) >>> 5);
  }
  result.push(0);
  for (let i = 0; i < hrp.length; i++) {
    result.push(hrp.charCodeAt(i) & 31);
  }
  return result;
}

function createChecksum(hrp: string, data: number[]): number[] {
  const values = hrpExpand(hrp).concat(data);
  const polymodValue = polymod(values.concat([0, 0, 0, 0, 0, 0])) ^ 1;
  const result: number[] = [];
  for (let i = 0; i < 6; i++) {
    result.push((polymodValue >>> (5 * (5 - i))) & 31);
  }
  return result;
}

function encodeBech32(hrp: string, data: number[]): string {
  const checksum = createChecksum(hrp, data);
  const combined = data.concat(checksum);
  let result = hrp + "1";
  for (const value of combined) {
    result += CHARSET[value];
  }
  return result;
}

/**
 * Generate proper bech32 address from public key
 * 
 * @param publicKey - 33-byte compressed public key
 * @param network - "bitcoin" or "litecoin"
 * @returns bech32 address (bc1... for Bitcoin, ltc1... for Litecoin)
 */
export function generateBech32Address(publicKey: Buffer, network: "bitcoin" | "litecoin"): string {
  // Generate witness program (20 bytes for P2WPKH)
  const sha256 = createHash("sha256").update(publicKey).digest();
  const hash160 = createHash("ripemd160").update(sha256).digest();
  
  // Convert to 5-bit groups
  const data: number[] = [0]; // Witness version 0
  let bits = 0;
  let value = 0;
  
  for (const byte of hash160) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      data.push((value >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }
  if (bits > 0) {
    data.push((value << (5 - bits)) & 31);
  }
  
  // Use correct HRP based on network
  const hrp = network === "litecoin" ? "ltc" : "bc";
  
  return encodeBech32(hrp, data);
}

/**
 * Validate bech32 address
 */
export function validateBech32Address(address: string, network: "bitcoin" | "litecoin"): boolean {
  const expectedPrefix = network === "litecoin" ? "ltc1" : "bc1";
  if (!address.startsWith(expectedPrefix)) {
    return false;
  }
  
  if (address.length < 14 || address.length > 74) {
    return false;
  }
  
  // Basic format check
  const parts = address.split("1");
  if (parts.length !== 2) return false;
  
  const hrp = parts[0];
  const data = parts[1];
  
  if (hrp !== expectedPrefix.slice(0, -1)) return false;
  
  // Check charset
  for (const char of data) {
    if (!CHARSET.includes(char)) return false;
  }
  
  return true;
}






