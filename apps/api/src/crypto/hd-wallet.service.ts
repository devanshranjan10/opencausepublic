import { Injectable, OnModuleInit } from "@nestjs/common";
import { createHash, randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { privateKeyToAccount } from "viem/accounts";
import { FirebaseService } from "../firebase/firebase.service";
import { generateBech32Address } from "./utxo-address-fixed";

// Import HD wallet libraries (these come with viem as dependencies)
// @ts-ignore - @scure packages may not have type definitions
const { HDKey } = require("@scure/bip32");
// @ts-ignore
const { mnemonicToSeedSync, generateMnemonic } = require("@scure/bip39");
// @ts-ignore
const { wordlist } = require("@scure/bip39/wordlists/english");

// BIP44 derivation paths for different blockchains
const DERIVATION_PATHS: Record<string, string> = {
  // Ethereum-based chains use m/44'/60'/0'/0/index
  ethereum: "m/44'/60'/0'/0",
  polygon: "m/44'/60'/0'/0",
  bsc: "m/44'/60'/0'/0",
  avalanche: "m/44'/60'/0'/0",
  arbitrum: "m/44'/60'/0'/0",
  optimism: "m/44'/60'/0'/0",
  base: "m/44'/60'/0'/0",
  // Bitcoin uses m/44'/0'/0'/0/index
  bitcoin: "m/44'/0'/0'/0",
  litecoin: "m/44'/2'/0'/0",
  // Solana uses m/44'/501'/0'/0' (different format)
  solana: "m/44'/501'/0'/0'",
};

@Injectable()
export class HDWalletService implements OnModuleInit {
  private masterSeed: Buffer | null = null;
  private readonly ENCRYPTION_KEY: string;
  private readonly ENCRYPTION_IV: string;

  constructor(private firebase: FirebaseService) {
    // Get encryption key from environment or generate one
    this.ENCRYPTION_KEY = process.env.HD_WALLET_ENCRYPTION_KEY || this.generateEncryptionKey();
    // IV must be 16 bytes (32 hex characters), not 16 hex characters
    this.ENCRYPTION_IV = process.env.HD_WALLET_ENCRYPTION_IV || this.generateEncryptionIV();
  }

  async onModuleInit() {
    await this.initializeMasterSeed();
  }

  /**
   * Initialize or load master seed phrase
   */
  private async initializeMasterSeed() {
    try {
      // Try to load existing seed from secure storage
      const seedData = await this.firebase.getById("system_config", "hd_wallet_seed");
      
      if (seedData && (seedData as any).encryptedSeed) {
        // Decrypt and load existing seed
        this.masterSeed = this.decryptSeed((seedData as any).encryptedSeed);
        console.log("✅ Loaded existing HD wallet seed");
      } else {
        // Generate new seed phrase
        const mnemonic = this.generateMnemonic();
        const seed = mnemonicToSeedSync(mnemonic);
        
        // Encrypt and store
        const encryptedSeed = this.encryptSeed(seed);
        await this.firebase.create("system_config", {
          id: "hd_wallet_seed",
          encryptedSeed,
          mnemonic: this.encryptSeed(Buffer.from(mnemonic)), // Also encrypt mnemonic
          createdAt: new Date().toISOString(),
        });

        this.masterSeed = seed;
        console.log("✅ Generated new HD wallet seed");
        console.log("⚠️  IMPORTANT: Backup the seed phrase securely!");
      }
    } catch (error) {
      console.error("Failed to initialize HD wallet:", error);
      // Fallback: generate temporary seed (not persisted)
      const mnemonic = this.generateMnemonic();
      this.masterSeed = mnemonicToSeedSync(mnemonic);
      console.warn("⚠️  Using temporary seed - not persisted!");
    }
  }

  /**
   * Generate a BIP39 mnemonic (12 words)
   */
  private generateMnemonic(): string {
    try {
      return generateMnemonic(wordlist, 128); // 12 words
    } catch (error) {
      // Fallback: generate random hex string
      console.warn("Failed to generate BIP39 mnemonic, using fallback");
      return randomBytes(16).toString("hex");
    }
  }

  /**
   * Generate deterministic address for campaign + crypto + chain
   */
  async generateAddress(
    campaignId: string,
    crypto: string,
    blockchain: string,
    index: number = 0
  ): Promise<{
    address: string;
    privateKey: string;
    derivationPath: string;
  }> {
    // Ensure master seed is initialized
    if (!this.masterSeed) {
      await this.initializeMasterSeed();
      if (!this.masterSeed) {
        throw new Error("HD wallet failed to initialize - master seed is not available");
      }
    }

    // Get derivation path for blockchain
    const basePath = DERIVATION_PATHS[blockchain] || DERIVATION_PATHS.ethereum;
    
    // Create unique index based on campaign + crypto
    const uniqueIndex = this.getUniqueIndex(campaignId, crypto, index);
    const derivationPath = `${basePath}/${uniqueIndex}`;

    // Derive HD key
    const hdKey = HDKey.fromMasterSeed(this.masterSeed);
    const derivedKey = hdKey.derive(derivationPath);

    // Get address based on blockchain
    let address: string;
    let privateKey: string;

    if (!derivedKey.privateKey) {
      throw new Error("Failed to derive private key");
    }

    privateKey = Buffer.from(derivedKey.privateKey).toString("hex");

    if (blockchain === "bitcoin" || blockchain === "litecoin") {
      // Bitcoin/Litecoin address generation with proper bech32 encoding
      // CRITICAL FIX: LTC must use ltc1 prefix, NOT bc1
      const publicKey = derivedKey.publicKey;
      
      if (!publicKey || publicKey.length < 33) {
        throw new Error("Invalid public key for UTXO address generation");
      }
      
      // Ensure compressed public key (33 bytes)
      const compressedKey = publicKey.length === 33 
        ? publicKey 
        : Buffer.concat([Buffer.from([0x02 + (publicKey[64] & 1)]), publicKey.slice(1, 33)]);
      
      // Generate proper bech32 address
      address = generateBech32Address(
        compressedKey,
        blockchain === "litecoin" ? "litecoin" : "bitcoin"
      );
    } else if (blockchain === "solana") {
      // Solana address generation using @solana/web3.js
      try {
        // Solana uses Ed25519, so we need to derive the keypair properly
        // The private key from BIP32 derivation needs to be converted to a Solana keypair
        let Keypair: any;
        try {
          Keypair = require("@solana/web3.js").Keypair;
        } catch (requireError) {
          throw new Error("@solana/web3.js is not installed. Please run: npm install @solana/web3.js bs58");
        }
        
        // For Solana, we use the private key bytes directly (first 32 bytes as seed)
        // derivedKey.privateKey is a Buffer from BIP32 derivation
        // We take the first 32 bytes as the seed for Solana's Ed25519 keypair
        const privateKeyBuffer = Buffer.isBuffer(derivedKey.privateKey) 
          ? derivedKey.privateKey 
          : Buffer.from(derivedKey.privateKey);
        
        // Ensure we have at least 32 bytes
        if (privateKeyBuffer.length < 32) {
          throw new Error(`Private key buffer too short: ${privateKeyBuffer.length} bytes, need 32`);
        }
        
        // Use first 32 bytes as seed for Solana keypair
        const seed = privateKeyBuffer.slice(0, 32);
        
        // Generate Solana keypair from the seed
        // Solana Keypair.fromSeed expects exactly 32 bytes
        const keypair = Keypair.fromSeed(seed);
        
        // Get the public key and encode it as base58 (this is the Solana address)
        address = keypair.publicKey.toBase58();
        
        // Validate the address (Solana addresses are base58, typically 32-44 characters)
        if (!address || address.length < 32 || address.length > 44) {
          throw new Error(`Invalid Solana address generated: ${address}`);
        }
      } catch (error: any) {
        console.error("Solana address generation error:", error);
        throw new Error(`Failed to generate Solana address: ${error.message}`);
      }
    } else {
      // Ethereum-based (EVM chains) - use viem's privateKeyToAccount
      try {
        const account = privateKeyToAccount(`0x${privateKey}` as `0x${string}`);
        address = account.address; // account.address is already a valid checksummed address
        
        // Validate address
        if (!address || !address.startsWith("0x") || address.length !== 42) {
          throw new Error(`Invalid address generated: ${address}`);
        }
      } catch (error: any) {
        console.error("Address generation error:", error);
        throw new Error(`Failed to generate Ethereum address: ${error.message}`);
      }
    }

    // Store derivation info for later access
    await this.storeDerivationInfo(campaignId, crypto, blockchain, derivationPath, address, privateKey);

    // Encrypt private key (or return as-is if encryption fails)
    let encryptedPrivateKey: string;
    try {
      encryptedPrivateKey = this.encryptSeed(Buffer.from(privateKey, "hex"));
    } catch (error) {
      console.warn("Failed to encrypt private key, using unencrypted (development only):", error);
      encryptedPrivateKey = privateKey; // Fallback: return unencrypted (only for dev)
    }
    
    return {
      address,
      privateKey: encryptedPrivateKey,
      derivationPath,
    };
  }

  /**
   * Get unique index from campaign + crypto
   */
  private getUniqueIndex(campaignId: string, crypto: string, index: number): number {
    const hash = createHash("sha256")
      .update(`${campaignId}-${crypto}-${index}`)
      .digest();
    // Use first 4 bytes as index (0 to 2^32-1)
    return hash.readUInt32BE(0) % 2147483647; // Max safe integer for BIP32
  }


  /**
   * Store derivation info for later access
   */
  private async storeDerivationInfo(
    campaignId: string,
    crypto: string,
    blockchain: string,
    derivationPath: string,
    address: string,
    privateKey: string
  ) {
    try {
      const id = createHash("sha256")
        .update(`${campaignId}-${crypto}-${blockchain}`)
        .digest("hex")
        .substring(0, 32);

      await this.firebase.create("wallet_derivations", {
        id,
        campaignId,
        crypto,
        blockchain,
        derivationPath,
        address,
        encryptedPrivateKey: this.encryptSeed(Buffer.from(privateKey, "hex")),
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      // Fail gracefully - derivation info storage is optional
      console.warn("Failed to store derivation info (non-critical):", error);
    }
  }

  /**
   * Get stored derivation info
   */
  async getDerivationInfo(campaignId: string, crypto: string, blockchain: string) {
    const id = createHash("sha256")
      .update(`${campaignId}-${crypto}-${blockchain}`)
      .digest("hex")
      .substring(0, 32);

    return this.firebase.getById("wallet_derivations", id);
  }

  /**
   * Encrypt seed/private key
   */
  private encryptSeed(data: Buffer): string {
    const cipher = createCipheriv("aes-256-cbc", Buffer.from(this.ENCRYPTION_KEY, "hex"), Buffer.from(this.ENCRYPTION_IV, "hex"));
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString("hex");
  }

  /**
   * Decrypt seed/private key
   */
  private decryptSeed(encrypted: string): Buffer {
    const decipher = createDecipheriv("aes-256-cbc", Buffer.from(this.ENCRYPTION_KEY, "hex"), Buffer.from(this.ENCRYPTION_IV, "hex"));
    const encryptedBuffer = Buffer.from(encrypted, "hex");
    let decrypted = decipher.update(encryptedBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted;
  }

  /**
   * Generate encryption key (32 bytes = 64 hex characters)
   */
  private generateEncryptionKey(): string {
    return randomBytes(32).toString("hex");
  }

  /**
   * Generate encryption IV (16 bytes = 32 hex characters)
   */
  private generateEncryptionIV(): string {
    return randomBytes(16).toString("hex");
  }

  /**
   * Get master seed phrase (for backup - should be called securely)
   */
  async getMasterSeedPhrase(): Promise<string | null> {
    try {
      const seedData = await this.firebase.getById("system_config", "hd_wallet_seed");
      if (seedData && (seedData as any).mnemonic) {
        const decrypted = this.decryptSeed((seedData as any).mnemonic);
        return decrypted.toString("utf8");
      }
      return null;
    } catch (error) {
      console.error("Failed to get master seed phrase:", error);
      return null;
    }
  }
}

