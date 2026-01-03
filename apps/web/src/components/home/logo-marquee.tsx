"use client";

import { motion } from "framer-motion";
import { useState } from "react";

const cryptocurrencies = [
  {
    name: "BTC",
    symbol: "Bitcoin",
    image: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
    color: "#F7931A",
  },
  {
    name: "ETH",
    symbol: "Ethereum",
    image: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    color: "#627EEA",
  },
  {
    name: "USDT",
    symbol: "Tether",
    image: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
    color: "#26A17B",
  },
  {
    name: "LTC",
    symbol: "Litecoin",
    image: "https://assets.coingecko.com/coins/images/2/large/litecoin.png",
    color: "#345D9D",
  },
  {
    name: "USDC",
    symbol: "USD Coin",
    image: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
    color: "#2775CA",
  },
  {
    name: "BNB",
    symbol: "BNB",
    image: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
    color: "#F3BA2F",
  },
  {
    name: "SOL",
    symbol: "Solana",
    image: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    color: "#9945FF",
  },
  {
    name: "POL",
    symbol: "Polygon",
    image: "https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png",
    color: "#8247E5",
  },
  {
    name: "ADA",
    symbol: "Cardano",
    image: "https://assets.coingecko.com/coins/images/975/large/cardano.png",
    color: "#0033AD",
  },
  {
    name: "XRP",
    symbol: "Ripple",
    image: "https://cryptologos.cc/logos/xrp-xrp-logo.png",
    color: "#23292F",
  },
  {
    name: "DOGE",
    symbol: "Dogecoin",
    image: "https://assets.coingecko.com/coins/images/5/large/dogecoin.png",
    color: "#C2A633",
  },
  {
    name: "AVAX",
    symbol: "Avalanche",
    image: "https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png",
    color: "#E84142",
  },
];

export function LogoMarquee() {
  return (
    <section className="relative py-20 border-y border-white/10 overflow-hidden bg-black/50">
      {/* Scrolling cryptocurrencies */}
      <div className="flex gap-20 items-center">
        {/* First set */}
        {[...cryptocurrencies, ...cryptocurrencies].map((crypto, i) => (
          <CryptoLogo key={`first-${i}`} crypto={crypto} index={i} />
        ))}
      </div>

      {/* Static INR overlay in the center - compact and non-obstructing */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
        <div className="relative">
          {/* Very subtle backdrop - compact size */}
          <div className="absolute inset-0 -inset-x-6 -inset-y-4 bg-black/5 backdrop-blur-sm rounded-full border border-white/5" />
          {/* INR content - compact */}
          <div className="relative px-6 py-3">
            <div className="text-2xl font-bold text-white/80 mb-0.5 drop-shadow-lg">₹</div>
            <div className="text-[10px] text-white/50 font-medium tracking-wider uppercase">INR</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CryptoLogo({ crypto, index }: { crypto: typeof cryptocurrencies[0]; index: number }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="flex-shrink-0 flex items-center justify-center group cursor-pointer relative z-0"
      animate={{
        x: [0, -2400],
      }}
      transition={{
        x: {
          repeat: Infinity,
          repeatType: "loop",
          duration: 40,
          ease: "linear",
        },
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="w-20 h-20 flex items-center justify-center relative">
        <img
          src={crypto.image}
          alt={crypto.symbol}
          className="w-14 h-14 object-contain transition-all duration-300 group-hover:scale-125 group-hover:drop-shadow-2xl"
          style={{
            filter: isHovered 
              ? "grayscale(0%) brightness(1) saturate(1.2)" 
              : "grayscale(100%) brightness(0.4)",
            opacity: isHovered ? 1 : 0.4,
          }}
          onError={(e) => {
            // Fallback if image fails - try alternative source
            const target = e.target as HTMLImageElement;
            if (crypto.name === "XRP") {
              target.src = "https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png";
            } else {
              target.style.display = "none";
            }
          }}
        />
        {/* Color glow on hover */}
        {isHovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 blur-2xl rounded-full -z-10"
            style={{ backgroundColor: crypto.color }}
          />
        )}
      </div>
    </motion.div>
  );
}

