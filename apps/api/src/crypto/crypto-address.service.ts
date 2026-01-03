import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { FirebaseService } from "../firebase/firebase.service";
import { HDWalletService } from "./hd-wallet.service";

export interface CryptoConfig {
  symbol: string;
  name: string;
  blockchain: string;
  decimals: number;
  addressFormat: "ethereum" | "bitcoin" | "solana" | "cosmos" | "other";
  rpcUrl?: string;
  explorerUrl?: string;
}

// Supported cryptocurrencies configuration with multi-chain support
export const SUPPORTED_CRYPTOS: Record<string, CryptoConfig> = {
  // Ethereum-based
  ETH: {
    symbol: "ETH",
    name: "Ethereum",
    blockchain: "ethereum",
    decimals: 18,
    addressFormat: "ethereum",
    explorerUrl: "https://etherscan.io/address/",
  },
  // USDC - Multi-chain
  "USDC-ETH": {
    symbol: "USDC",
    name: "USD Coin (Ethereum)",
    blockchain: "ethereum",
    decimals: 6,
    addressFormat: "ethereum",
    explorerUrl: "https://etherscan.io/token/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  "USDC-POLYGON": {
    symbol: "USDC",
    name: "USD Coin (Polygon)",
    blockchain: "polygon",
    decimals: 6,
    addressFormat: "ethereum",
    explorerUrl: "https://polygonscan.com/token/0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  },
  "USDC-BSC": {
    symbol: "USDC",
    name: "USD Coin (BSC)",
    blockchain: "bsc",
    decimals: 18,
    addressFormat: "ethereum",
    explorerUrl: "https://bscscan.com/token/0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  },
  "USDC-AVALANCHE": {
    symbol: "USDC",
    name: "USD Coin (Avalanche)",
    blockchain: "avalanche",
    decimals: 6,
    addressFormat: "ethereum",
    explorerUrl: "https://snowtrace.io/token/0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
  },
  "USDC-ARBITRUM": {
    symbol: "USDC",
    name: "USD Coin (Arbitrum)",
    blockchain: "arbitrum",
    decimals: 6,
    addressFormat: "ethereum",
    explorerUrl: "https://arbiscan.io/token/0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  },
  "USDC-OPTIMISM": {
    symbol: "USDC",
    name: "USD Coin (Optimism)",
    blockchain: "optimism",
    decimals: 6,
    addressFormat: "ethereum",
    explorerUrl: "https://optimistic.etherscan.io/token/0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
  },
  "USDC-BASE": {
    symbol: "USDC",
    name: "USD Coin (Base)",
    blockchain: "base",
    decimals: 6,
    addressFormat: "ethereum",
    explorerUrl: "https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  // USDT - Multi-chain
  "USDT-ETH": {
    symbol: "USDT",
    name: "Tether USD (Ethereum)",
    blockchain: "ethereum",
    decimals: 6,
    addressFormat: "ethereum",
    explorerUrl: "https://etherscan.io/token/0xdAC17F958D2ee523a2206206994597C13D831ec7",
  },
  "USDT-POLYGON": {
    symbol: "USDT",
    name: "Tether USD (Polygon)",
    blockchain: "polygon",
    decimals: 6,
    addressFormat: "ethereum",
    explorerUrl: "https://polygonscan.com/token/0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  },
  "USDT-BSC": {
    symbol: "USDT",
    name: "Tether USD (BSC)",
    blockchain: "bsc",
    decimals: 18,
    addressFormat: "ethereum",
    explorerUrl: "https://bscscan.com/token/0x55d398326f99059fF775485246999027B3197955",
  },
  "USDT-AVALANCHE": {
    symbol: "USDT",
    name: "Tether USD (Avalanche)",
    blockchain: "avalanche",
    decimals: 6,
    addressFormat: "ethereum",
    explorerUrl: "https://snowtrace.io/token/0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
  },
  "USDT-ARBITRUM": {
    symbol: "USDT",
    name: "Tether USD (Arbitrum)",
    blockchain: "arbitrum",
    decimals: 6,
    addressFormat: "ethereum",
    explorerUrl: "https://arbiscan.io/token/0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  },
  "USDT-OPTIMISM": {
    symbol: "USDT",
    name: "Tether USD (Optimism)",
    blockchain: "optimism",
    decimals: 6,
    addressFormat: "ethereum",
    explorerUrl: "https://optimistic.etherscan.io/token/0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
  },
  "USDT-BASE": {
    symbol: "USDT",
    name: "Tether USD (Base)",
    blockchain: "base",
    decimals: 6,
    addressFormat: "ethereum",
    explorerUrl: "https://basescan.org/token/0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
  },
  MATIC: {
    symbol: "MATIC",
    name: "Polygon",
    blockchain: "polygon",
    decimals: 18,
    addressFormat: "ethereum",
    explorerUrl: "https://polygonscan.com/address/",
  },
  // Bitcoin
  BTC: {
    symbol: "BTC",
    name: "Bitcoin",
    blockchain: "bitcoin",
    decimals: 8,
    addressFormat: "bitcoin",
    explorerUrl: "https://blockstream.info/address/",
  },
  // Solana
  SOL: {
    symbol: "SOL",
    name: "Solana",
    blockchain: "solana",
    decimals: 9,
    addressFormat: "solana",
    explorerUrl: "https://solscan.io/account/",
  },
  // BNB Chain
  BNB: {
    symbol: "BNB",
    name: "Binance Coin",
    blockchain: "bsc",
    decimals: 18,
    addressFormat: "ethereum",
    explorerUrl: "https://bscscan.com/address/",
  },
  // Litecoin
  LTC: {
    symbol: "LTC",
    name: "Litecoin",
    blockchain: "litecoin",
    decimals: 8,
    addressFormat: "bitcoin",
    explorerUrl: "https://blockchair.com/litecoin/address/",
  },
  // Avalanche
  AVAX: {
    symbol: "AVAX",
    name: "Avalanche",
    blockchain: "avalanche",
    decimals: 18,
    addressFormat: "ethereum",
    explorerUrl: "https://snowtrace.io/address/",
  },
  // Arbitrum
  ARB: {
    symbol: "ARB",
    name: "Arbitrum",
    blockchain: "arbitrum",
    decimals: 18,
    addressFormat: "ethereum",
    explorerUrl: "https://arbiscan.io/address/",
  },
  // Optimism
  OP: {
    symbol: "OP",
    name: "Optimism",
    blockchain: "optimism",
    decimals: 18,
    addressFormat: "ethereum",
    explorerUrl: "https://optimistic.etherscan.io/address/",
  },
  // Base
  BASE: {
    symbol: "BASE",
    name: "Base",
    blockchain: "base",
    decimals: 18,
    addressFormat: "ethereum",
    explorerUrl: "https://basescan.org/address/",
  },
};

@Injectable()
export class CryptoAddressService {
  constructor(
    private firebase: FirebaseService,
    private hdWallet: HDWalletService
  ) {}

  /**
   * Generate a unique donation address for a campaign and crypto
   * For Ethereum-based chains, we use the campaign vault address
   * For other chains, we generate deterministic addresses based on campaign + crypto
   */
  async generateDonationAddress(
    campaignId: string,
    crypto: string,
    blockchain?: string,
    amount?: string
  ): Promise<{
    address: string;
    crypto: string;
    blockchain: string;
    campaignId: string;
    qrCode: string;
    amount?: string;
    expiresAt?: string;
  }> {
    // Handle crypto with blockchain (e.g., "USDC-ETH", "USDT-POLYGON")
    const cryptoKey = blockchain 
      ? `${crypto.toUpperCase()}-${blockchain.toUpperCase()}`
      : crypto.toUpperCase();
    
    let cryptoConfig = SUPPORTED_CRYPTOS[cryptoKey];
    
    // If not found with blockchain, try without
    if (!cryptoConfig) {
      cryptoConfig = SUPPORTED_CRYPTOS[crypto.toUpperCase()];
    }
    
    // If still not found, default to Ethereum for common tokens
    if (!cryptoConfig) {
      if (["USDC", "USDT"].includes(crypto.toUpperCase())) {
        cryptoConfig = SUPPORTED_CRYPTOS[`${crypto.toUpperCase()}-ETH`];
      }
    }
    
    if (!cryptoConfig) {
      throw new Error(`Unsupported cryptocurrency: ${crypto}${blockchain ? ` on ${blockchain}` : ""}`);
    }

    // Check if campaign exists
    const campaign = await this.firebase.getCampaignById(campaignId) as any;
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    let address: string;
    let derivationPath: string | undefined;

    // For Ethereum-based chains, prefer using campaign vault address if available and valid
    // This ensures funds go directly to the vault contract
    if (cryptoConfig.addressFormat === "ethereum" && campaign.vaultAddress) {
      // Validate vault address format
      if (campaign.vaultAddress.startsWith("0x") && campaign.vaultAddress.length === 42) {
        // Use the campaign vault address for Ethereum-based chains
        // This is the address where funds are collected for the campaign
        address = campaign.vaultAddress;
        console.log(`Using campaign vault address: ${address}`);
      } else {
        // Invalid vault address, generate new one via HD wallet
        console.warn(`Invalid vault address format: ${campaign.vaultAddress}, generating new address`);
        const walletInfo = await this.hdWallet.generateAddress(
          campaignId,
          cryptoKey,
          cryptoConfig.blockchain,
          0
        );
        address = walletInfo.address;
        derivationPath = walletInfo.derivationPath;
      }
    } else {
      // For other blockchains or when vault doesn't exist, use HD wallet
      // This ensures we can access the private key later for fund release
      try {
        const walletInfo = await this.hdWallet.generateAddress(
          campaignId,
          cryptoKey,
          cryptoConfig.blockchain,
          0
        );
        
        address = walletInfo.address;
        derivationPath = walletInfo.derivationPath;
        
        // Validate generated address
        if (cryptoConfig.addressFormat === "ethereum") {
          if (!address || !address.startsWith("0x") || address.length !== 42) {
            throw new Error(`Invalid Ethereum address generated: ${address} (length: ${address?.length})`);
          }
        }
        
        console.log(`Generated HD wallet address: ${address} for ${cryptoKey} on ${cryptoConfig.blockchain}`);
      } catch (error: any) {
        console.error("HD wallet address generation failed:", error);
        throw new Error(`Failed to generate donation address: ${error.message}`);
      }
    }
    
    // Final validation
    if (!address || (cryptoConfig.addressFormat === "ethereum" && (!address.startsWith("0x") || address.length !== 42))) {
      throw new Error(`Invalid address generated: ${address}`);
    }

    // Create donation address record
    const donationAddressId = createHash("sha256")
      .update(`${campaignId}-${cryptoKey}-${Date.now()}`)
      .digest("hex")
      .substring(0, 32);

    await this.firebase.create("donation_addresses", {
      id: donationAddressId,
      campaignId,
      crypto: cryptoConfig.symbol,
      blockchain: cryptoConfig.blockchain,
      address,
      derivationPath: derivationPath || null,
      amount: amount || null,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    const qrData = this.generateQRData(address, cryptoConfig, amount);

    return {
      address,
      crypto: cryptoConfig.symbol,
      blockchain: cryptoConfig.blockchain,
      campaignId,
      qrCode: qrData,
      amount: amount || undefined,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Generate QR code data string
   */
  private generateQRData(address: string, config: CryptoConfig, amount?: string): string {
    if (amount) {
      // Include amount in QR code for easier payment
      return `${config.symbol}:${address}?amount=${amount}`;
    }
    return address;
  }


  /**
   * Get donation address by ID
   */
  async getDonationAddress(addressId: string) {
    return this.firebase.getById("donation_addresses", addressId);
  }

  /**
   * Update donation address status
   */
  async updateDonationAddressStatus(
    addressId: string,
    status: "PENDING" | "CONFIRMED" | "EXPIRED",
    txHash?: string
  ) {
    const update: any = { status };
    if (txHash) {
      update.txHash = txHash;
      update.confirmedAt = new Date().toISOString();
    }
    return this.firebase.update("donation_addresses", addressId, update);
  }

  /**
   * Get all supported cryptocurrencies (grouped by symbol for multi-chain)
   */
  getSupportedCryptos(): (CryptoConfig & { key: string })[] {
    return Object.entries(SUPPORTED_CRYPTOS).map(([key, config]) => ({
      ...config,
      key,
    }));
  }
  
  /**
   * Get cryptocurrencies grouped by symbol (for multi-chain tokens)
   */
  getCryptosGrouped(): Record<string, (CryptoConfig & { key: string })[]> {
    const grouped: Record<string, (CryptoConfig & { key: string })[]> = {};
    
    Object.entries(SUPPORTED_CRYPTOS).forEach(([key, config]) => {
      const symbol = config.symbol;
      if (!grouped[symbol]) {
        grouped[symbol] = [];
      }
      grouped[symbol].push({ ...config, key });
    });
    
    return grouped;
  }

  /**
   * Get crypto config by symbol
   */
  getCryptoConfig(symbol: string): CryptoConfig | undefined {
    return SUPPORTED_CRYPTOS[symbol.toUpperCase()];
  }
}








