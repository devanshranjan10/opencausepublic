/**
 * QR Code URI Builders
 * 
 * Generates proper payment URIs for different blockchain networks.
 * Critical: LTC must use litecoin: prefix with ltc1 addresses, NOT bc1.
 */

import { CryptoNetwork, CryptoAsset } from "./registry";

/**
 * Build QR code URI string for a payment
 */
export function buildQRUri(
  network: CryptoNetwork,
  asset: CryptoAsset,
  address: string,
  amountNative?: string
): string {
  switch (network.type) {
    case "UTXO":
      return buildUTXOQR(network, address, amountNative);
    case "EVM":
      return buildEVMQR(network, asset, address, amountNative);
    case "SOL":
      return buildSolanaQR(address, amountNative);
    default:
      return address; // Fallback
  }
}

/**
 * Build UTXO QR URI (Bitcoin, Litecoin)
 * CRITICAL: LTC uses litecoin: prefix, BTC uses bitcoin: prefix
 */
function buildUTXOQR(
  network: CryptoNetwork,
  address: string,
  amountNative?: string
): string {
  const prefix = network.networkId === "litecoin_mainnet" ? "litecoin" : "bitcoin";
  
  if (amountNative) {
    // Include amount in QR: bitcoin:address?amount=0.001
    return `${prefix}:${address}?amount=${amountNative}`;
  }
  
  // Address only
  return `${prefix}:${address}`;
}

/**
 * Build EVM QR URI
 * For maximum wallet compatibility, we use plain addresses.
 * Many wallets don't fully support EIP-681, so we prioritize compatibility.
 */
function buildEVMQR(
  network: CryptoNetwork,
  asset: CryptoAsset,
  address: string,
  amountNative?: string
): string {
  // Always return plain address for maximum wallet compatibility
  // Most wallets (MetaMask, Trust Wallet, Coinbase Wallet, etc.) prefer plain addresses
  // Users can select the token and enter amount manually in their wallet
  return address;
  
  // Note: EIP-681 format support is limited in many wallets, especially mobile
  // For future enhancement, we could detect wallet capability and use EIP-681 for supported wallets
  /*
  if (asset.assetType === "ERC20" && asset.contractAddress && amountNative) {
    // EIP-681 format: ethereum:0xTokenAddress@chainId/transfer?address=0xTo&uint256=amount
    const chainId = network.chainId || 1;
    return `ethereum:${asset.contractAddress}@${chainId}/transfer?address=${address}&uint256=${amountNative}`;
  }
  
  if (amountNative) {
    // Native token with amount: ethereum:address?value=amount
    return `ethereum:${address}?value=${amountNative}`;
  }
  */
}

/**
 * Build Solana QR URI
 */
function buildSolanaQR(address: string, amountNative?: string): string {
  if (amountNative) {
    return `solana:${address}?amount=${amountNative}`;
  }
  return `solana:${address}`;
}

/**
 * Get explorer URL for transaction
 */
export function getExplorerTxUrl(network: CryptoNetwork, txHash: string): string {
  return `${network.explorerBaseUrl}/tx/${txHash}`;
}

/**
 * Get explorer URL for address
 */
export function getExplorerAddressUrl(network: CryptoNetwork, address: string): string {
  const baseUrl = network.explorerBaseUrl.replace(/\/$/, "");
  
  // Different explorers use different paths
  if (network.explorerBaseUrl.includes("etherscan.io") || 
      network.explorerBaseUrl.includes("polygonscan.com") ||
      network.explorerBaseUrl.includes("bscscan.com") ||
      network.explorerBaseUrl.includes("arbiscan.io") ||
      network.explorerBaseUrl.includes("optimistic.etherscan.io") ||
      network.explorerBaseUrl.includes("basescan.org") ||
      network.explorerBaseUrl.includes("ftmscan.com") ||
      network.explorerBaseUrl.includes("snowtrace.io")) {
    return `${baseUrl}/address/${address}`;
  }
  
  if (network.explorerBaseUrl.includes("blockstream.info")) {
    return `${baseUrl}/address/${address}`;
  }
  
  if (network.explorerBaseUrl.includes("blockchair.com")) {
    // blockchair.com URLs already include the chain (e.g., https://blockchair.com/litecoin)
    // So we just append /address/address
    return `${baseUrl}/address/${address}`;
  }
  
  if (network.explorerBaseUrl.includes("solscan.io")) {
    return `${baseUrl}/account/${address}`;
  }
  
  // Default fallback
  return `${baseUrl}/address/${address}`;
}
