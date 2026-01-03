/**
 * AWS KMS Signer for EVM (Ethereum/Safe)
 * 
 * Uses AWS KMS with ECC_SECG_P256K1 keys for signing Ethereum transactions
 * Compatible with Safe protocol typed data signing
 */

import { KMSClient, GetPublicKeyCommand, SignCommand } from "@aws-sdk/client-kms";
import { hexToBytes } from "viem";

export interface Signature {
  r: `0x${string}`;
  s: `0x${string}`;
  v: 27 | 28;
}

export class Kmsecp256k1Signer {
  constructor(
    private kms: KMSClient,
    private keyId: string
  ) {}

  /**
   * Get Ethereum address from KMS public key
   * Note: Cache this in key_configs after first computation
   */
  async getEthereumAddress(): Promise<`0x${string}`> {
    const pub = await this.kms.send(new GetPublicKeyCommand({ KeyId: this.keyId }));
    if (!pub.PublicKey) throw new Error("KMS missing public key");

    // PublicKey is DER-encoded SubjectPublicKeyInfo
    // Extract uncompressed secp256k1 point and derive address
    // For production: implement proper DER parsing or use a library
    // For now: this should be computed once during setup and cached
    
    throw new Error("Implement DER parsing once + cache address in key_configs");
  }

  /**
   * Sign a 32-byte digest (for Ethereum message signing)
   */
  async signDigest32(digestHex: `0x${string}`): Promise<Signature> {
    const digest = hexToBytes(digestHex);
    if (digest.length !== 32) throw new Error("digest must be 32 bytes");

    const out = await this.kms.send(
      new SignCommand({
        KeyId: this.keyId,
        Message: Buffer.from(digest),
        MessageType: "DIGEST",
        SigningAlgorithm: "ECDSA_SHA_256",
      })
    );

    if (!out.Signature) throw new Error("KMS missing signature");

    // KMS returns DER signature; convert DER -> (r,s)
    const { r, s } = derToRS(out.Signature);

    // Normalize low-s (Ethereum requirement)
    const secpN = BigInt(
      "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141"
    );
    let sBig = BigInt(`0x${Buffer.from(s).toString("hex")}`);
    const rHex = `0x${Buffer.from(r).toString("hex")}` as const;

    if (sBig > secpN / 2n) sBig = secpN - sBig;
    const sHex = `0x${sBig.toString(16).padStart(64, "0")}` as `0x${string}`;

    // v will be determined by recovery in higher layer
    // For now, return v=27 (will be adjusted by recovery)
    return { r: rHex, s: sHex, v: 27 };
  }

  /**
   * Sign typed data (EIP-712) for Safe transactions
   */
  async signTypedData(typedData: any): Promise<Signature> {
    // Hash typed data to get digest (use your EIP-712 hasher)
    // const digest = hashTypedData(typedData);
    // return this.signDigest32(digest);
    
    throw new Error("Implement EIP-712 hashing + call signDigest32");
  }
}

/**
 * Convert DER-encoded ECDSA signature to (r, s) tuple
 */
function derToRS(derSig: Uint8Array): { r: Uint8Array; s: Uint8Array } {
  // Minimal DER ECDSA parser
  // Format: 0x30 len 0x02 rlen r 0x02 slen s
  const b = derSig;
  if (b[0] !== 0x30) throw new Error("bad DER: missing 0x30");
  
  let i = 2; // Skip 0x30 and length byte
  
  if (b[i] !== 0x02) throw new Error("bad DER: missing 0x02 for r");
  const rlen = b[i + 1];
  i += 2;
  const r = b.slice(i, i + rlen);
  i += rlen;
  
  if (b[i] !== 0x02) throw new Error("bad DER: missing 0x02 for s");
  const slen = b[i + 1];
  i += 2;
  const s = b.slice(i, i + slen);
  
  return { r: leftPad32(r), s: leftPad32(s) };
}

function leftPad32(x: Uint8Array): Uint8Array {
  const out = new Uint8Array(32);
  const offset = 32 - Math.min(32, x.length);
  out.set(x.slice(Math.max(0, x.length - 32)), offset);
  return out;
}






