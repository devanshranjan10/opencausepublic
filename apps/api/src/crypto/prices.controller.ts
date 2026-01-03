import { Controller, Get, Query } from "@nestjs/common";
import { FxRateService } from "./fx-rate.service";
import { ConfigService } from "@nestjs/config";

interface CachedPrice {
  price: string;
  timestamp: number;
}

/**
 * Prices API endpoint for live crypto prices
 */
@Controller("prices")
export class PricesController {
  // In-memory cache for prices
  private priceCache: Map<string, CachedPrice> = new Map();
  private readonly cacheTtl = 30; // 30 seconds cache to reduce API calls
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // Start with 1 second

  constructor(
    private fxRate: FxRateService,
    private configService: ConfigService
  ) {}

  /**
   * GET /prices?symbols=USDT,ETH,BNB
   * Returns prices in INR for given symbols
   */
  @Get()
  async getPrices(@Query("symbols") symbols: string) {
    if (!symbols) {
      return { prices: {}, timestamp: Date.now() };
    }

    const symbolList = symbols.split(",").map((s) => s.trim().toUpperCase());
    const prices: Record<string, string> = {};

    // Check cache first and separate symbols into cached and uncached
    const symbolsToFetch: string[] = [];
    const coingeckoIdsToFetch: string[] = [];
    
    for (const symbol of symbolList) {
      if (symbol === "INR") {
        prices[symbol] = "1";
        continue;
      }

      const coingeckoId = this.getAssetIdFromSymbol(symbol);
      if (!coingeckoId) {
        prices[symbol] = "0";
        continue;
      }

      // Check cache
      const cacheKey = `${coingeckoId}_INR`;
      const cached = this.priceCache.get(cacheKey);
      if (cached) {
        const age = (Date.now() - cached.timestamp) / 1000;
        if (age < this.cacheTtl) {
          prices[symbol] = cached.price;
          continue;
        }
        // Remove expired entry
        this.priceCache.delete(cacheKey);
      }

      symbolsToFetch.push(symbol);
      coingeckoIdsToFetch.push(coingeckoId);
    }

    // Batch fetch remaining prices (CoinGecko supports multiple IDs in one request)
    if (coingeckoIdsToFetch.length > 0) {
      try {
        // Batch request all coins at once
        const batchPrices = await this.fetchBatchPrices(coingeckoIdsToFetch);
        
        // Map results back to symbols
        for (let i = 0; i < symbolsToFetch.length; i++) {
          const symbol = symbolsToFetch[i];
          const coingeckoId = coingeckoIdsToFetch[i];
          const price = batchPrices[coingeckoId];
          
          if (price) {
            prices[symbol] = price;
            // Cache the result
            this.priceCache.set(`${coingeckoId}_INR`, {
              price,
              timestamp: Date.now(),
            });
          } else {
            // Fallback to USD conversion
            prices[symbol] = await this.getPriceViaUsdConversion(coingeckoId);
          }
        }
      } catch (error: any) {
        console.error(`[Prices] Batch fetch failed, falling back to individual requests:`, error.message);
        // Fallback: fetch individually with retries
        await Promise.all(
          symbolsToFetch.map(async (symbol, index) => {
            const coingeckoId = coingeckoIdsToFetch[index];
            try {
              const price = await this.fetchPriceWithRetry(coingeckoId);
              if (price) {
                prices[symbol] = price;
                this.priceCache.set(`${coingeckoId}_INR`, {
                  price,
                  timestamp: Date.now(),
                });
              } else {
                prices[symbol] = await this.getPriceViaUsdConversion(coingeckoId);
              }
            } catch (err: any) {
              console.error(`[Prices] Failed to fetch price for ${symbol}:`, err.message);
              prices[symbol] = await this.getPriceViaUsdConversion(coingeckoId).catch(() => "0");
            }
          })
        );
      }
    }

    return {
      prices,
      timestamp: Date.now(),
    };
  }

  /**
   * Fetch prices for multiple coins in a single batch request
   * Tries multiple APIs as fallback
   */
  private async fetchBatchPrices(coingeckoIds: string[]): Promise<Record<string, string>> {
    // Try CoinGecko first
    try {
      return await this.fetchBatchPricesCoinGecko(coingeckoIds);
    } catch (error: any) {
      console.warn(`[Prices] CoinGecko batch failed: ${error.message}, trying fallback APIs...`);
    }

    // Fallback 1: Binance API (public, no key needed)
    try {
      return await this.fetchBatchPricesBinance(coingeckoIds);
    } catch (error: any) {
      console.warn(`[Prices] Binance batch failed: ${error.message}, trying next fallback...`);
    }

    // Fallback 2: CryptoCompare API
    try {
      return await this.fetchBatchPricesCryptoCompare(coingeckoIds);
    } catch (error: any) {
      console.warn(`[Prices] CryptoCompare batch failed: ${error.message}, trying next fallback...`);
    }

    // Fallback 3: CoinMarketCap API (if key available)
    try {
      const cmcKey = this.configService.get<string>("COINMARKETCAP_API_KEY");
      if (cmcKey) {
        return await this.fetchBatchPricesCoinMarketCap(coingeckoIds, cmcKey);
      }
    } catch (error: any) {
      console.warn(`[Prices] CoinMarketCap batch failed: ${error.message}`);
    }

    // Final fallback: Individual fetches with hardcoded prices
    return this.getHardcodedPrices(coingeckoIds);
  }

  /**
   * Fetch prices from CoinGecko
   */
  private async fetchBatchPricesCoinGecko(coingeckoIds: string[]): Promise<Record<string, string>> {
    const apiKey = this.configService.get<string>("COINGECKO_API_KEY");
    const idsParam = coingeckoIds.join(",");
    const url = apiKey
      ? `https://api.coingecko.com/api/v3/simple/price?ids=${idsParam}&vs_currencies=inr&x_cg_demo_api_key=${apiKey}`
      : `https://api.coingecko.com/api/v3/simple/price?ids=${idsParam}&vs_currencies=inr`;

    const response = await this.fetchWithRetry(url);
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const result: Record<string, string> = {};

    for (const coingeckoId of coingeckoIds) {
      const assetData = data[coingeckoId];
      if (assetData && typeof assetData.inr === "number") {
        result[coingeckoId] = assetData.inr.toFixed(2);
      }
    }

    return result;
  }

  /**
   * Fetch prices from Binance API (public, no key needed)
   */
  private async fetchBatchPricesBinance(coingeckoIds: string[]): Promise<Record<string, string>> {
    // Map coingecko IDs to Binance symbols
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
    };

    const result: Record<string, string> = {};
    const usdToInr = 83; // Approximate USD to INR rate

    // Fetch USD prices from Binance
    await Promise.all(
      coingeckoIds.map(async (coingeckoId) => {
        const symbol = symbolMap[coingeckoId];
        if (!symbol) return;

        try {
          const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, {
            signal: AbortSignal.timeout(5000),
          });
          if (response.ok) {
            const data = await response.json() as { price: string };
            const priceUsd = parseFloat(data.price);
            if (priceUsd > 0) {
              result[coingeckoId] = (priceUsd * usdToInr).toFixed(2);
            }
          }
        } catch (error) {
          // Ignore individual failures
        }
      })
    );

    if (Object.keys(result).length > 0) {
      console.log(`[Prices] ✅ Binance API returned ${Object.keys(result).length} prices`);
      return result;
    }

    throw new Error("Binance API returned no prices");
  }

  /**
   * Fetch prices from CryptoCompare API
   */
  private async fetchBatchPricesCryptoCompare(coingeckoIds: string[]): Promise<Record<string, string>> {
    // Map coingecko IDs to CryptoCompare symbols
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
    };

    const symbols = coingeckoIds
      .map((id) => symbolMap[id])
      .filter(Boolean)
      .join(",");

    if (!symbols) {
      throw new Error("No valid symbols for CryptoCompare");
    }

    const response = await fetch(
      `https://min-api.cryptocompare.com/data/pricemulti?fsyms=${symbols}&tsyms=USD,INR`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) {
      throw new Error(`CryptoCompare API error: ${response.status}`);
    }

    const data = await response.json();
    const result: Record<string, string> = {};

    // Map back to coingecko IDs
    for (const [coingeckoId, symbol] of Object.entries(symbolMap)) {
      if (coingeckoIds.includes(coingeckoId) && data[symbol]) {
        if (data[symbol].INR) {
          result[coingeckoId] = data[symbol].INR.toFixed(2);
        } else if (data[symbol].USD) {
          // Convert USD to INR
          result[coingeckoId] = (data[symbol].USD * 83).toFixed(2);
        }
      }
    }

    if (Object.keys(result).length > 0) {
      console.log(`[Prices] ✅ CryptoCompare API returned ${Object.keys(result).length} prices`);
      return result;
    }

    throw new Error("CryptoCompare API returned no prices");
  }

  /**
   * Fetch prices from CoinMarketCap API (requires API key)
   */
  private async fetchBatchPricesCoinMarketCap(coingeckoIds: string[], apiKey: string): Promise<Record<string, string>> {
    // Map coingecko IDs to CoinMarketCap IDs (simplified - would need full mapping)
    const cmcIdMap: Record<string, string> = {
      bitcoin: "1",
      ethereum: "1027",
      litecoin: "2",
      "usd-coin": "3408",
      tether: "825",
      binancecoin: "1839",
      "matic-network": "3890",
      solana: "4128",
      "avalanche-2": "5805",
      dogecoin: "5",
    };

    const cmcIds = coingeckoIds
      .map((id) => cmcIdMap[id])
      .filter(Boolean)
      .join(",");

    if (!cmcIds) {
      throw new Error("No valid CoinMarketCap IDs");
    }

    const response = await fetch(
      `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?id=${cmcIds}&convert=INR`,
      {
        headers: {
          "X-CMC_PRO_API_KEY": apiKey,
        },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      throw new Error(`CoinMarketCap API error: ${response.status}`);
    }

    const data = await response.json() as {
      data?: Record<string, {
        quote?: {
          INR?: {
            price?: number;
          };
        };
      }>;
    };
    const result: Record<string, string> = {};

    // Map back to coingecko IDs
    for (const [coingeckoId, cmcId] of Object.entries(cmcIdMap)) {
      if (coingeckoIds.includes(coingeckoId) && data.data?.[cmcId]?.quote?.INR?.price) {
        result[coingeckoId] = data.data[cmcId].quote.INR.price.toFixed(2);
      }
    }

    if (Object.keys(result).length > 0) {
      console.log(`[Prices] ✅ CoinMarketCap API returned ${Object.keys(result).length} prices`);
      return result;
    }

    throw new Error("CoinMarketCap API returned no prices");
  }

  /**
   * Hardcoded fallback prices (last resort)
   */
  private getHardcodedPrices(coingeckoIds: string[]): Record<string, string> {
    const hardcodedPrices: Record<string, string> = {
      bitcoin: "5500000", // ₹55L
      ethereum: "250000", // ₹2.5L
      litecoin: "8300",
      "usd-coin": "83.50",
      tether: "83.50",
      binancecoin: "50000",
      "matic-network": "80",
      solana: "12000",
      "avalanche-2": "3500",
      dogecoin: "12",
    };

    const result: Record<string, string> = {};
    for (const coingeckoId of coingeckoIds) {
      if (hardcodedPrices[coingeckoId]) {
        result[coingeckoId] = hardcodedPrices[coingeckoId];
      }
    }

    if (Object.keys(result).length > 0) {
      console.warn(`[Prices] ⚠️ Using hardcoded fallback prices for ${Object.keys(result).length} assets`);
      return result;
    }

    throw new Error("No prices available from any source");
  }

  /**
   * Fetch price for a single coin with retry logic and fallback APIs
   */
  private async fetchPriceWithRetry(coingeckoId: string, retryCount = 0): Promise<string | null> {
    // Try CoinGecko first
    try {
      const apiKey = this.configService.get<string>("COINGECKO_API_KEY");
      const url = apiKey
        ? `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=inr&x_cg_demo_api_key=${apiKey}`
        : `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=inr`;

      const response = await this.fetchWithRetry(url, retryCount);
      if (!response.ok) {
        if (response.status === 429 && retryCount < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, retryCount);
          console.log(`[Prices] Rate limited for ${coingeckoId}, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.fetchPriceWithRetry(coingeckoId, retryCount + 1);
        }
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const assetData = data[coingeckoId];
      if (assetData && typeof assetData.inr === "number") {
        return assetData.inr.toFixed(2);
      }
    } catch (error: any) {
      if (error.message?.includes("429") && retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        console.log(`[Prices] Rate limited for ${coingeckoId}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchPriceWithRetry(coingeckoId, retryCount + 1);
      }
      // Fall through to fallback APIs
    }

    // Fallback: Try other APIs
    try {
      const fallbackResult = await this.fetchBatchPrices([coingeckoId]);
      return fallbackResult[coingeckoId] || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Fetch with retry logic for rate limiting
   */
  private async fetchWithRetry(url: string, retryCount = 0): Promise<Response> {
    const response = await fetch(url);
    
    if (response.status === 429 && retryCount < this.maxRetries) {
      const delay = this.retryDelay * Math.pow(2, retryCount); // Exponential backoff
      console.log(`[Prices] Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.fetchWithRetry(url, retryCount + 1);
    }
    
    return response;
  }

  /**
   * Fallback: Get price via USD conversion
   */
  private async getPriceViaUsdConversion(coingeckoId: string): Promise<string> {
    try {
      console.log(`[Prices] Using USD conversion fallback for ${coingeckoId}`);
      const rateUsd = await this.fxRate.getRate(coingeckoId);
      
      // Get USD to INR rate (cached in FxRateService)
      let usdToInrRate = 90; // Default fallback
      try {
        const usdInrCached = this.priceCache.get("usd-coin_INR");
        if (usdInrCached) {
          const age = (Date.now() - usdInrCached.timestamp) / 1000;
          if (age < this.cacheTtl) {
            usdToInrRate = parseFloat(usdInrCached.price);
          }
        } else {
          // Fetch USD to INR rate
          const usdInrResponse = await this.fetchWithRetry("https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=inr");
          if (usdInrResponse.ok) {
            const usdInrData = await usdInrResponse.json();
            if (usdInrData["usd-coin"]?.inr) {
              usdToInrRate = usdInrData["usd-coin"].inr;
              this.priceCache.set("usd-coin_INR", {
                price: usdToInrRate.toString(),
                timestamp: Date.now(),
              });
            }
          }
        }
      } catch (e) {
        console.warn(`[Prices] Failed to fetch USD/INR rate, using default:`, e);
      }
      
      const rateInr = (parseFloat(rateUsd) * usdToInrRate).toFixed(2);
      console.log(`[Prices] Set ${coingeckoId} price to ₹${rateInr} (USD conversion: $${rateUsd} × ${usdToInrRate})`);
      return rateInr;
    } catch (error: any) {
      console.error(`[Prices] USD conversion fallback failed for ${coingeckoId}:`, error.message);
      return "0";
    }
  }

  private getAssetIdFromSymbol(symbol: string): string | null {
    // Map common symbols to coingeckoIds for price lookup
    // Note: We use coingeckoId for price fetching, not assetId
    const coingeckoMap: Record<string, string> = {
      USDT: "tether",
      USDC: "usd-coin",
      ETH: "ethereum",
      BNB: "binancecoin",
      MATIC: "matic-network",
      BTC: "bitcoin",
      LTC: "litecoin",
      SOL: "solana",
      AVAX: "avalanche-2",
      FTM: "fantom",
      ARB: "arbitrum",
      OP: "optimism",
      POL: "matic-network",
      BASE: "base",
      DOGE: "dogecoin",
    };
    return coingeckoMap[symbol] || null;
  }
}

