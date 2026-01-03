import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export interface PricesResponse {
  prices: Record<string, string>; // symbol => price in INR
  timestamp: number;
}

/**
 * Hook to fetch live crypto prices in INR
 */
export function usePrices(symbols: string[]) {
  return useQuery<PricesResponse>({
    queryKey: ["prices", symbols.sort().join(",")],
    queryFn: async () => {
      if (symbols.length === 0) {
        return { prices: {}, timestamp: Date.now() };
      }
      const symbolsParam = symbols.join(",");
      return apiRequest<PricesResponse>(`/prices?symbols=${encodeURIComponent(symbolsParam)}`);
    },
    refetchInterval: 10000, // Refetch every 10 seconds for live prices
    staleTime: 5000, // Consider stale after 5 seconds
  });
}

/**
 * Compute INR value from amount and symbol
 */
export function computeInrValue(amountNative: string, symbol: string, prices: Record<string, string>): number {
  const amount = parseFloat(amountNative);
  if (isNaN(amount) || amount <= 0) return 0;

  // INR donations are already in INR
  if (symbol === "INR") {
    return amount;
  }

  const priceInr = parseFloat(prices[symbol] || "0");
  if (priceInr <= 0) {
    console.warn(`[computeInrValue] Invalid price for ${symbol}: ${priceInr}, prices:`, prices);
    return 0;
  }
  
  const result = amount * priceInr;
  
  // Debug logging for LTC
  if (symbol === "LTC") {
    console.log(`[computeInrValue] ${amount} ${symbol} × ₹${priceInr} = ₹${result.toFixed(2)}`);
  }
  
  return result;
}






