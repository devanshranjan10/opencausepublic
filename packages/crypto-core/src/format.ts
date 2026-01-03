/**
 * Format crypto asset display labels
 */

import { CryptoAsset, getNetwork } from "./registry";

/**
 * Get token standard name from asset type
 */
export function getTokenStandard(assetType: string): string {
  const standardMap: Record<string, string> = {
    NATIVE: "Native",
    ERC20: "ERC20",
    BEP20: "BEP20", // Same as ERC20 but on BSC
    UTXO: "Native",
    SOL: "Native",
    SPL: "SPL",
  };
  return standardMap[assetType] || assetType;
}

/**
 * Format crypto asset label for display
 * Examples:
 * - "USDT (ERC20) - Ethereum"
 * - "USDT (BEP20) - Binance"
 * - "ETH (Native) - Ethereum"
 * - "BTC (Native) - Bitcoin"
 */
export function formatCryptoLabel(asset: CryptoAsset): string {
  const network = getNetwork(asset.networkId);
  if (!network) {
    return `${asset.symbol} (${asset.assetType})`;
  }

  // Map network names to user-friendly names
  const networkNameMap: Record<string, string> = {
    ethereum_mainnet: "Ethereum",
    bsc_mainnet: "Binance",
    polygon_mainnet: "Polygon",
    arbitrum_mainnet: "Arbitrum",
    optimism_mainnet: "Optimism",
    avalanche_mainnet: "Avalanche",
    base_mainnet: "Base",
    fantom_mainnet: "Fantom",
    bitcoin_mainnet: "Bitcoin",
    litecoin_mainnet: "Litecoin",
    solana_mainnet: "Solana",
  };

  const networkName = networkNameMap[asset.networkId] || network.name;

  // For BSC, show BEP20 instead of ERC20
  let standard = getTokenStandard(asset.assetType);
  if (asset.networkId === "bsc_mainnet" && asset.assetType === "ERC20") {
    standard = "BEP20";
  }

  // For native tokens, we can optionally hide the standard
  if (asset.assetType === "NATIVE" || asset.assetType === "UTXO" || asset.assetType === "SOL") {
    return `${asset.symbol} - ${networkName}`;
  }

  return `${asset.symbol} (${standard}) - ${networkName}`;
}

/**
 * Get network display name
 */
export function getNetworkDisplayName(networkId: string): string {
  const networkNameMap: Record<string, string> = {
    ethereum_mainnet: "Ethereum",
    bsc_mainnet: "Binance",
    polygon_mainnet: "Polygon",
    arbitrum_mainnet: "Arbitrum",
    optimism_mainnet: "Optimism",
    avalanche_mainnet: "Avalanche",
    base_mainnet: "Base",
    fantom_mainnet: "Fantom",
    bitcoin_mainnet: "Bitcoin",
    litecoin_mainnet: "Litecoin",
    solana_mainnet: "Solana",
  };
  return networkNameMap[networkId] || networkId;
}







