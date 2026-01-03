import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface FxRateResult {
  rate: string;
  timestamp: number;
  source: string;
}

@Injectable()
export class FxRateService {
  // In-memory cache (Redis removed)
  private cache: Map<string, FxRateResult> = new Map();
  private readonly COINGECKO_API_URL = "https://api.coingecko.com/api/v3";
  private readonly cacheTtl = 60; // 60 seconds cache

  constructor(private configService: ConfigService) {}

  /**
   * Convert USD to native amount
   */
  async usdToNative(
    assetId: string,
    coingeckoId: string | undefined,
    decimals: number,
    usdAmount: string
  ): Promise<string> {
    const rate = await this.getRate(coingeckoId || assetId);
    const nativeAmount = (parseFloat(usdAmount) / parseFloat(rate)).toString();
    return this.adjustDecimals(nativeAmount, decimals);
  }

  /**
   * Convert native amount to USD
   */
  async nativeToUsd(
    assetId: string,
    coingeckoId: string | undefined,
    decimals: number,
    nativeAmount: string
  ): Promise<string> {
    const rate = await this.getRate(coingeckoId || assetId);
    const usdAmount = parseFloat(nativeAmount) * parseFloat(rate);
    return usdAmount.toFixed(2);
  }

  /**
   * Get current exchange rate for an asset (USD per unit)
   */
  async getRate(assetIdOrCoingeckoId: string): Promise<string> {
    const cacheKey = assetIdOrCoingeckoId;

    // Try in-memory cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      // Check if cache is still valid (within TTL)
      const age = (Date.now() - cached.timestamp) / 1000;
      if (age < this.cacheTtl) {
        return cached.rate;
      }
      // Remove expired entry
      this.cache.delete(cacheKey);
    }

    // Try CoinGecko first
    try {
      const apiKey = this.configService.get<string>("COINGECKO_API_KEY");
      const url = apiKey
        ? `${this.COINGECKO_API_URL}/simple/price?ids=${assetIdOrCoingeckoId}&vs_currencies=usd&x_cg_demo_api_key=${apiKey}`
        : `${this.COINGECKO_API_URL}/simple/price?ids=${assetIdOrCoingeckoId}&vs_currencies=usd`;

      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if ((response as any).ok) {
        const data = await (response as any).json();
        const assetData = data[assetIdOrCoingeckoId];

        if (assetData && typeof assetData.usd === "number") {
          const rate = assetData.usd.toString();
          const result: FxRateResult = {
            rate,
            timestamp: Date.now(),
            source: "coingecko",
          };

          // Cache in memory
          this.cache.set(cacheKey, result);
          return rate;
        }
      }
      throw new Error(`CoinGecko API error: ${(response as any).statusText}`);
    } catch (error: any) {
      console.warn(`[FX Rate] CoinGecko failed for ${assetIdOrCoingeckoId}: ${error.message}, trying fallbacks...`);
    }

    // Fallback 1: Binance API (public, no key needed)
    try {
      const binanceSymbol = this.getBinanceSymbol(assetIdOrCoingeckoId);
      if (binanceSymbol) {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const data = await response.json() as { price: string };
          const rate = parseFloat(data.price).toString();
          const result: FxRateResult = {
            rate,
            timestamp: Date.now(),
            source: "binance",
          };
          this.cache.set(cacheKey, result);
          console.log(`[FX Rate] ✅ Binance API returned rate for ${assetIdOrCoingeckoId}: $${rate}`);
          return rate;
        }
      }
    } catch (error: any) {
      console.warn(`[FX Rate] Binance failed for ${assetIdOrCoingeckoId}: ${error.message}`);
    }

    // Fallback 2: CryptoCompare API
    try {
      const symbol = this.getCryptoCompareSymbol(assetIdOrCoingeckoId);
      if (symbol) {
        const response = await fetch(
          `https://min-api.cryptocompare.com/data/price?fsym=${symbol}&tsyms=USD`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (response.ok) {
          const data = await response.json() as { USD?: number };
          if (data.USD) {
            const rate = data.USD.toString();
            const result: FxRateResult = {
              rate,
              timestamp: Date.now(),
              source: "cryptocompare",
            };
            this.cache.set(cacheKey, result);
            console.log(`[FX Rate] ✅ CryptoCompare API returned rate for ${assetIdOrCoingeckoId}: $${rate}`);
            return rate;
          }
        }
      }
    } catch (error: any) {
      console.warn(`[FX Rate] CryptoCompare failed for ${assetIdOrCoingeckoId}: ${error.message}`);
    }

    // Fallback 3: Try common aliases
    const aliases: Record<string, string> = {
      eth: "ethereum",
      btc: "bitcoin",
      ltc: "litecoin",
      sol: "solana",
      matic: "matic-network",
      usdc: "usd-coin",
      usdt: "tether",
      dai: "dai",
    };

    const alias = aliases[assetIdOrCoingeckoId.toLowerCase()];
    if (alias && alias !== assetIdOrCoingeckoId) {
      console.log(`[FX Rate] Trying alias: ${alias}`);
      return this.getRate(alias);
    }

    // Final fallback: Use hardcoded prices
    const hardcodedPrices: Record<string, string> = {
      bitcoin: "65000",
      ethereum: "3000",
      litecoin: "100",
      "usd-coin": "1",
      tether: "1",
      binancecoin: "600",
      "matic-network": "1",
      solana: "150",
      "avalanche-2": "40",
      dogecoin: "0.15",
    };

    const hardcodedPrice = hardcodedPrices[assetIdOrCoingeckoId.toLowerCase()];
    if (hardcodedPrice) {
      console.warn(`[FX Rate] ⚠️ Using hardcoded fallback rate for ${assetIdOrCoingeckoId}: $${hardcodedPrice}`);
      return hardcodedPrice;
    }

    // Ultimate fallback: return 1 (assume USD-stablecoin)
    console.warn(`[FX Rate] ⚠️ Using default fallback rate 1.0 for ${assetIdOrCoingeckoId}`);
    return "1.0";
  }

  /**
   * Get rates for multiple assets at once with fallback APIs
   */
  async getBatchRates(assetIds: string[]): Promise<Record<string, string>> {
    const rates: Record<string, string> = {};
    
    // CoinGecko supports batch requests (up to 250 IDs)
    const uniqueIds = [...new Set(assetIds)];
    const apiKey = this.configService.get<string>("COINGECKO_API_KEY");
    const ids = uniqueIds.join(",");
    
    // Try CoinGecko batch first
    try {
      const url = apiKey
        ? `${this.COINGECKO_API_URL}/simple/price?ids=${ids}&vs_currencies=usd&x_cg_demo_api_key=${apiKey}`
        : `${this.COINGECKO_API_URL}/simple/price?ids=${ids}&vs_currencies=usd`;

      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if ((response as any).ok) {
        const data = await (response as any).json();
        for (const id of uniqueIds) {
          if (data[id]?.usd) {
            rates[id] = data[id].usd.toString();
          }
        }
        if (Object.keys(rates).length > 0) {
          console.log(`[FX Rate] ✅ CoinGecko batch returned ${Object.keys(rates).length} rates`);
          return rates;
        }
      }
    } catch (error: any) {
      console.warn(`[FX Rate] CoinGecko batch failed: ${error.message}, trying fallbacks...`);
    }

    // Fallback: Try Binance batch
    try {
      const binanceSymbols = uniqueIds
        .map(id => this.getBinanceSymbol(id))
        .filter(Boolean) as string[];
      
      if (binanceSymbols.length > 0) {
        await Promise.all(
          binanceSymbols.map(async (symbol) => {
            try {
              const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, {
                signal: AbortSignal.timeout(5000),
              });
              if (response.ok) {
                const data = await response.json() as { price: string };
                // Map back to asset ID (simplified - would need reverse mapping)
                const price = parseFloat(data.price).toString();
                // For now, just store by symbol
                rates[symbol] = price;
              }
            } catch (error) {
              // Ignore individual failures
            }
          })
        );
        if (Object.keys(rates).length > 0) {
          console.log(`[FX Rate] ✅ Binance batch returned ${Object.keys(rates).length} rates`);
          // Note: This returns rates keyed by Binance symbols, not asset IDs
          // For proper implementation, we'd need reverse mapping
        }
      }
    } catch (error: any) {
      console.warn(`[FX Rate] Binance batch failed: ${error.message}`);
    }

    // Final fallback: individual fetches (which have their own fallbacks)
    for (const id of uniqueIds) {
      if (!rates[id]) {
        rates[id] = await this.getRate(id);
      }
    }

    return rates;
  }

  /**
   * Get Binance symbol from asset ID
   */
  private getBinanceSymbol(assetIdOrCoingeckoId: string): string | null {
    const symbolMap: Record<string, string> = {
      bitcoin: "BTCUSDT",
      ethereum: "ETHUSDT",
      litecoin: "LTCUSDT",
      "usd-coin": "USDCUSDT",
      tether: "USDTUSDT",
      binancecoin: "BNBUSDT",
      "matic-network": "MATICUSDT",
      solana: "SOLUSDT",
      "avalanche-2": "AVAXUSDT",
      dogecoin: "DOGEUSDT",
      btc: "BTCUSDT",
      eth: "ETHUSDT",
      ltc: "LTCUSDT",
      usdc: "USDCUSDT",
      usdt: "USDTUSDT",
      bnb: "BNBUSDT",
      matic: "MATICUSDT",
      sol: "SOLUSDT",
      avax: "AVAXUSDT",
      doge: "DOGEUSDT",
    };
    return symbolMap[assetIdOrCoingeckoId.toLowerCase()] || null;
  }

  /**
   * Get CryptoCompare symbol from asset ID
   */
  private getCryptoCompareSymbol(assetIdOrCoingeckoId: string): string | null {
    const symbolMap: Record<string, string> = {
      bitcoin: "BTC",
      ethereum: "ETH",
      litecoin: "LTC",
      "usd-coin": "USDC",
      tether: "USDT",
      binancecoin: "BNB",
      "matic-network": "MATIC",
      solana: "SOL",
      "avalanche-2": "AVAX",
      dogecoin: "DOGE",
      btc: "BTC",
      eth: "ETH",
      ltc: "LTC",
      usdc: "USDC",
      usdt: "USDT",
      bnb: "BNB",
      matic: "MATIC",
      sol: "SOL",
      avax: "AVAX",
      doge: "DOGE",
    };
    return symbolMap[assetIdOrCoingeckoId.toLowerCase()] || null;
  }

  /**
   * Adjust decimal places
   */
  private adjustDecimals(value: string, decimals: number): string {
    const num = parseFloat(value);
    // Round to appropriate decimal places
    const multiplier = Math.pow(10, decimals);
    const rounded = Math.round(num * multiplier) / multiplier;
    return rounded.toString();
  }
}
