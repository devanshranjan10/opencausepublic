"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface CryptoIconProps {
  symbol: string;
  size?: number;
  coingeckoId?: string;
  className?: string;
}

/**
 * Get icon URL for a cryptocurrency symbol
 * Uses multiple fallback sources for reliability
 */
function getCryptoIconUrl(symbol: string, size: number): string {
  const symbolLower = symbol.toLowerCase();
  
  // Map of common cryptocurrencies to their CoinGecko image paths
  const iconMap: Record<string, string> = {
    btc: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
    eth: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    usdt: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
    usdc: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
    sol: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
    ltc: "https://assets.coingecko.com/coins/images/2/small/litecoin.png",
    bnb: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
    matic: "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png",
    avax: "https://assets.coingecko.com/coins/images/12559/small/avalanche-avax-logo.png",
    dai: "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png",
    link: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
    uni: "https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png",
  };

  // Return mapped icon or fallback to generic crypto icon service
  return iconMap[symbolLower] || `https://cryptologos.cc/logos/${symbolLower}-${symbolLower}-logo.png`;
}

/**
 * CryptoIcon component - displays cryptocurrency icons
 * Uses CoinGecko CDN with fallback to symbol badge
 */
export function CryptoIcon({ symbol, size = 24, coingeckoId, className }: CryptoIconProps) {
  const [imageError, setImageError] = React.useState(false);
  const iconSize = size || 24;
  const iconUrl = getCryptoIconUrl(symbol, iconSize);

  // Fallback component - shows symbol as text in a styled badge
  const FallbackIcon = () => (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10",
        className
      )}
      style={{ width: iconSize, height: iconSize, minWidth: iconSize, minHeight: iconSize }}
    >
      <span 
        className="text-xs font-bold text-white" 
        style={{ fontSize: Math.max(iconSize * 0.35, 10) }}
      >
        {symbol.substring(0, 2).toUpperCase()}
      </span>
    </div>
  );

  // Show fallback if image already failed
  if (imageError) {
    return <FallbackIcon />;
  }

  return (
    <img
      src={iconUrl}
      alt={symbol}
      width={iconSize}
      height={iconSize}
      className={cn("rounded-full flex-shrink-0", className)}
      style={{ width: iconSize, height: iconSize, minWidth: iconSize, minHeight: iconSize }}
      onError={() => setImageError(true)}
      loading="lazy"
    />
  );
}
