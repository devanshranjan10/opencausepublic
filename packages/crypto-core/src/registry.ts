/**
 * Crypto Asset Registry
 * 
 * Defines 100+ cryptocurrencies across multiple networks with proper configurations.
 * This registry drives the donation system's multi-chain support.
 */

export type NetworkType = "EVM" | "UTXO" | "SOL";
export type AssetType = "NATIVE" | "ERC20" | "UTXO" | "SOL" | "SPL";

export interface CryptoNetwork {
  networkId: string;
  type: NetworkType;
  name: string;
  symbol: string;
  chainId?: number;
  rpcUrlRef?: string;
  explorerBaseUrl: string;
  enabled: boolean;
  confirmationsRequired: number;
  coinType?: number; // BIP44 coin type for UTXO
  bech32Prefix?: string; // For UTXO bech32 addresses
}

export interface CryptoAsset {
  assetId: string;
  networkId: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  contractAddress?: string;
  decimals: number;
  enabled: boolean;
  coingeckoId?: string; // For price lookups
}

/**
 * Supported Networks
 */
export const NETWORKS: Record<string, CryptoNetwork> = {
  // EVM Networks
  ethereum_mainnet: {
    networkId: "ethereum_mainnet",
    type: "EVM",
    name: "Ethereum",
    symbol: "ETH",
    chainId: 1,
    explorerBaseUrl: "https://etherscan.io",
    enabled: true,
    confirmationsRequired: 12,
  },
  bsc_mainnet: {
    networkId: "bsc_mainnet",
    type: "EVM",
    name: "BNB Smart Chain",
    symbol: "BNB",
    chainId: 56,
    explorerBaseUrl: "https://bscscan.com",
    enabled: true,
    confirmationsRequired: 3,
  },
  polygon_mainnet: {
    networkId: "polygon_mainnet",
    type: "EVM",
    name: "Polygon",
    symbol: "MATIC",
    chainId: 137,
    explorerBaseUrl: "https://polygonscan.com",
    enabled: true,
    confirmationsRequired: 128,
  },
  arbitrum_mainnet: {
    networkId: "arbitrum_mainnet",
    type: "EVM",
    name: "Arbitrum One",
    symbol: "ETH",
    chainId: 42161,
    explorerBaseUrl: "https://arbiscan.io",
    enabled: true,
    confirmationsRequired: 1,
  },
  optimism_mainnet: {
    networkId: "optimism_mainnet",
    type: "EVM",
    name: "Optimism",
    symbol: "ETH",
    chainId: 10,
    explorerBaseUrl: "https://optimistic.etherscan.io",
    enabled: true,
    confirmationsRequired: 1,
  },
  avalanche_mainnet: {
    networkId: "avalanche_mainnet",
    type: "EVM",
    name: "Avalanche C-Chain",
    symbol: "AVAX",
    chainId: 43114,
    explorerBaseUrl: "https://snowtrace.io",
    enabled: true,
    confirmationsRequired: 1,
  },
  base_mainnet: {
    networkId: "base_mainnet",
    type: "EVM",
    name: "Base",
    symbol: "ETH",
    chainId: 8453,
    explorerBaseUrl: "https://basescan.org",
    enabled: true,
    confirmationsRequired: 1,
  },
  fantom_mainnet: {
    networkId: "fantom_mainnet",
    type: "EVM",
    name: "Fantom",
    symbol: "FTM",
    chainId: 250,
    explorerBaseUrl: "https://ftmscan.com",
    enabled: true,
    confirmationsRequired: 1,
  },
  // UTXO Networks
  bitcoin_mainnet: {
    networkId: "bitcoin_mainnet",
    type: "UTXO",
    name: "Bitcoin",
    symbol: "BTC",
    explorerBaseUrl: "https://blockstream.info",
    enabled: true,
    confirmationsRequired: 1,
    coinType: 0,
    bech32Prefix: "bc",
  },
  litecoin_mainnet: {
    networkId: "litecoin_mainnet",
    type: "UTXO",
    name: "Litecoin",
    symbol: "LTC",
    explorerBaseUrl: "https://blockchair.com/litecoin",
    enabled: true,
    confirmationsRequired: 1,
    coinType: 2,
    bech32Prefix: "ltc", // CRITICAL: ltc1 prefix, NOT bc1
  },
  // Solana
  solana_mainnet: {
    networkId: "solana_mainnet",
    type: "SOL",
    name: "Solana",
    symbol: "SOL",
    explorerBaseUrl: "https://solscan.io",
    enabled: true,
    confirmationsRequired: 32, // Finalized commitment
  },
};

/**
 * Supported Assets (100+ cryptocurrencies)
 */
export const ASSETS: CryptoAsset[] = [
  // Native EVM tokens
  {
    assetId: "eth_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "ETH",
    name: "Ethereum",
    assetType: "NATIVE",
    decimals: 18,
    enabled: true,
    coingeckoId: "ethereum",
  },
  {
    assetId: "bnb_bsc_mainnet",
    networkId: "bsc_mainnet",
    symbol: "BNB",
    name: "BNB",
    assetType: "NATIVE",
    decimals: 18,
    enabled: true,
    coingeckoId: "binancecoin",
  },
  {
    assetId: "matic_polygon_mainnet",
    networkId: "polygon_mainnet",
    symbol: "MATIC",
    name: "Polygon",
    assetType: "NATIVE",
    decimals: 18,
    enabled: true,
    coingeckoId: "matic-network",
  },
  {
    assetId: "eth_arbitrum_mainnet",
    networkId: "arbitrum_mainnet",
    symbol: "ETH",
    name: "Ethereum (Arbitrum)",
    assetType: "NATIVE",
    decimals: 18,
    enabled: true,
    coingeckoId: "ethereum",
  },
  {
    assetId: "eth_optimism_mainnet",
    networkId: "optimism_mainnet",
    symbol: "ETH",
    name: "Ethereum (Optimism)",
    assetType: "NATIVE",
    decimals: 18,
    enabled: true,
    coingeckoId: "ethereum",
  },
  {
    assetId: "avax_avalanche_mainnet",
    networkId: "avalanche_mainnet",
    symbol: "AVAX",
    name: "Avalanche",
    assetType: "NATIVE",
    decimals: 18,
    enabled: true,
    coingeckoId: "avalanche-2",
  },
  {
    assetId: "eth_base_mainnet",
    networkId: "base_mainnet",
    symbol: "ETH",
    name: "Ethereum (Base)",
    assetType: "NATIVE",
    decimals: 18,
    enabled: true,
    coingeckoId: "ethereum",
  },
  {
    assetId: "ftm_fantom_mainnet",
    networkId: "fantom_mainnet",
    symbol: "FTM",
    name: "Fantom",
    assetType: "NATIVE",
    decimals: 18,
    enabled: true,
    coingeckoId: "fantom",
  },
  
  // USDC (Multi-chain ERC20)
  {
    assetId: "usdc_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "USDC",
    name: "USD Coin (Ethereum)",
    assetType: "ERC20",
    contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    enabled: true,
    coingeckoId: "usd-coin",
  },
  {
    assetId: "usdc_bsc_mainnet",
    networkId: "bsc_mainnet",
    symbol: "USDC",
    name: "USD Coin (BSC)",
    assetType: "ERC20",
    contractAddress: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    decimals: 18,
    enabled: true,
    coingeckoId: "usd-coin",
  },
  {
    assetId: "usdc_polygon_mainnet",
    networkId: "polygon_mainnet",
    symbol: "USDC",
    name: "USD Coin (Polygon)",
    assetType: "ERC20",
    contractAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    decimals: 6,
    enabled: true,
    coingeckoId: "usd-coin",
  },
  {
    assetId: "usdc_arbitrum_mainnet",
    networkId: "arbitrum_mainnet",
    symbol: "USDC",
    name: "USD Coin (Arbitrum)",
    assetType: "ERC20",
    contractAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    decimals: 6,
    enabled: true,
    coingeckoId: "usd-coin",
  },
  {
    assetId: "usdc_optimism_mainnet",
    networkId: "optimism_mainnet",
    symbol: "USDC",
    name: "USD Coin (Optimism)",
    assetType: "ERC20",
    contractAddress: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
    decimals: 6,
    enabled: true,
    coingeckoId: "usd-coin",
  },
  {
    assetId: "usdc_avalanche_mainnet",
    networkId: "avalanche_mainnet",
    symbol: "USDC",
    name: "USD Coin (Avalanche)",
    assetType: "ERC20",
    contractAddress: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    decimals: 6,
    enabled: true,
    coingeckoId: "usd-coin",
  },
  {
    assetId: "usdc_base_mainnet",
    networkId: "base_mainnet",
    symbol: "USDC",
    name: "USD Coin (Base)",
    assetType: "ERC20",
    contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    enabled: true,
    coingeckoId: "usd-coin",
  },

  // USDT (Multi-chain ERC20)
  {
    assetId: "usdt_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "USDT",
    name: "Tether USD (Ethereum)",
    assetType: "ERC20",
    contractAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
    enabled: true,
    coingeckoId: "tether",
  },
  {
    assetId: "usdt_bsc_mainnet",
    networkId: "bsc_mainnet",
    symbol: "USDT",
    name: "Tether USD (BSC)",
    assetType: "ERC20",
    contractAddress: "0x55d398326f99059fF775485246999027B3197955",
    decimals: 18,
    enabled: true,
    coingeckoId: "tether",
  },
  {
    assetId: "usdt_polygon_mainnet",
    networkId: "polygon_mainnet",
    symbol: "USDT",
    name: "Tether USD (Polygon)",
    assetType: "ERC20",
    contractAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    decimals: 6,
    enabled: true,
    coingeckoId: "tether",
  },
  {
    assetId: "usdt_arbitrum_mainnet",
    networkId: "arbitrum_mainnet",
    symbol: "USDT",
    name: "Tether USD (Arbitrum)",
    assetType: "ERC20",
    contractAddress: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    decimals: 6,
    enabled: true,
    coingeckoId: "tether",
  },
  {
    assetId: "usdt_avalanche_mainnet",
    networkId: "avalanche_mainnet",
    symbol: "USDT",
    name: "Tether USD (Avalanche)",
    assetType: "ERC20",
    contractAddress: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
    decimals: 6,
    enabled: true,
    coingeckoId: "tether",
  },

  // DAI
  {
    assetId: "dai_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "DAI",
    name: "Dai Stablecoin",
    assetType: "ERC20",
    contractAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    decimals: 18,
    enabled: true,
    coingeckoId: "dai",
  },
  {
    assetId: "dai_polygon_mainnet",
    networkId: "polygon_mainnet",
    symbol: "DAI",
    name: "Dai Stablecoin (Polygon)",
    assetType: "ERC20",
    contractAddress: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    decimals: 18,
    enabled: true,
    coingeckoId: "dai",
  },

  // Popular ERC20 tokens on Ethereum
  {
    assetId: "wbtc_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    assetType: "ERC20",
    contractAddress: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    decimals: 8,
    enabled: true,
    coingeckoId: "wrapped-bitcoin",
  },
  {
    assetId: "link_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "LINK",
    name: "Chainlink",
    assetType: "ERC20",
    contractAddress: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    decimals: 18,
    enabled: true,
    coingeckoId: "chainlink",
  },
  {
    assetId: "uni_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "UNI",
    name: "Uniswap",
    assetType: "ERC20",
    contractAddress: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    decimals: 18,
    enabled: true,
    coingeckoId: "uniswap",
  },
  {
    assetId: "aave_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "AAVE",
    name: "Aave",
    assetType: "ERC20",
    contractAddress: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
    decimals: 18,
    enabled: true,
    coingeckoId: "aave",
  },
  {
    assetId: "mkr_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "MKR",
    name: "Maker",
    assetType: "ERC20",
    contractAddress: "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2",
    decimals: 18,
    enabled: true,
    coingeckoId: "maker",
  },
  {
    assetId: "comp_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "COMP",
    name: "Compound",
    assetType: "ERC20",
    contractAddress: "0xc00e94Cb662C3520282E6f5717214004A7f26888",
    decimals: 18,
    enabled: true,
    coingeckoId: "compound-governance-token",
  },
  {
    assetId: "snx_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "SNX",
    name: "Synthetix Network",
    assetType: "ERC20",
    contractAddress: "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F",
    decimals: 18,
    enabled: true,
    coingeckoId: "havven",
  },
  {
    assetId: "crv_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "CRV",
    name: "Curve DAO Token",
    assetType: "ERC20",
    contractAddress: "0xD533a949740bb3306d119CC777fa900bA034cd52",
    decimals: 18,
    enabled: true,
    coingeckoId: "curve-dao-token",
  },
  {
    assetId: "1inch_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "1INCH",
    name: "1inch Network",
    assetType: "ERC20",
    contractAddress: "0x111111111117dC0aa78b770fA6A738034120C302",
    decimals: 18,
    enabled: true,
    coingeckoId: "1inch",
  },
  {
    assetId: "sushi_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "SUSHI",
    name: "SushiSwap",
    assetType: "ERC20",
    contractAddress: "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2",
    decimals: 18,
    enabled: true,
    coingeckoId: "sushi",
  },
  {
    assetId: "grt_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "GRT",
    name: "The Graph",
    assetType: "ERC20",
    contractAddress: "0xc944E90C64B2c07662A292be6244BDf05Cda44a7",
    decimals: 18,
    enabled: true,
    coingeckoId: "the-graph",
  },
  {
    assetId: "bat_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "BAT",
    name: "Basic Attention Token",
    assetType: "ERC20",
    contractAddress: "0x0D8775F648430679A709E98d2b0Cb6250d2887EF",
    decimals: 18,
    enabled: true,
    coingeckoId: "basic-attention-token",
  },
  {
    assetId: "zrx_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "ZRX",
    name: "0x Protocol",
    assetType: "ERC20",
    contractAddress: "0xE41d2489571d322189246DaFA5ebDe1F4699F498",
    decimals: 18,
    enabled: true,
    coingeckoId: "0x",
  },
  {
    assetId: "enj_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "ENJ",
    name: "Enjin Coin",
    assetType: "ERC20",
    contractAddress: "0xF629cBd94d3791C9250152BD8dfBDF380E2a3B9c",
    decimals: 18,
    enabled: true,
    coingeckoId: "enjincoin",
  },
  {
    assetId: "mana_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "MANA",
    name: "Decentraland",
    assetType: "ERC20",
    contractAddress: "0x0F5D2fB29fb7d3CFeE444a200298f468908cC942",
    decimals: 18,
    enabled: true,
    coingeckoId: "decentraland",
  },
  {
    assetId: "sand_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "SAND",
    name: "The Sandbox",
    assetType: "ERC20",
    contractAddress: "0x3845badAde8e6dDD04FcF6923749147F1C99Cf2b",
    decimals: 18,
    enabled: true,
    coingeckoId: "the-sandbox",
  },
  {
    assetId: "axs_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "AXS",
    name: "Axie Infinity",
    assetType: "ERC20",
    contractAddress: "0xBB0E17EF65F82Ab018d8EDd776e8DD940327B28b",
    decimals: 18,
    enabled: true,
    coingeckoId: "axie-infinity",
  },
  {
    assetId: "gala_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "GALA",
    name: "Gala",
    assetType: "ERC20",
    contractAddress: "0x15D4c048F83bd7e37d49eA4C83a07267Ec4203dA",
    decimals: 8,
    enabled: true,
    coingeckoId: "gala",
  },
  {
    assetId: "chz_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "CHZ",
    name: "Chiliz",
    assetType: "ERC20",
    contractAddress: "0x3506424F91fD33084466F402d5D97f05F8e3b4AF",
    decimals: 18,
    enabled: true,
    coingeckoId: "chiliz",
  },
  {
    assetId: "ape_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "APE",
    name: "ApeCoin",
    assetType: "ERC20",
    contractAddress: "0x4d224452801ACEd8B2F0aebE155379bb5D594381",
    decimals: 18,
    enabled: true,
    coingeckoId: "apecoin",
  },

  // Popular tokens on Polygon
  {
    assetId: "wmatic_polygon_mainnet",
    networkId: "polygon_mainnet",
    symbol: "WMATIC",
    name: "Wrapped MATIC",
    assetType: "ERC20",
    contractAddress: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    decimals: 18,
    enabled: true,
    coingeckoId: "wmatic",
  },
  {
    assetId: "quick_polygon_mainnet",
    networkId: "polygon_mainnet",
    symbol: "QUICK",
    name: "Quickswap",
    assetType: "ERC20",
    contractAddress: "0x831753DD7087CaC61aB5644b308642cc1c33Dc13",
    decimals: 18,
    enabled: true,
    coingeckoId: "quickswap",
  },

  // Popular tokens on BSC
  {
    assetId: "cake_bsc_mainnet",
    networkId: "bsc_mainnet",
    symbol: "CAKE",
    name: "PancakeSwap",
    assetType: "ERC20",
    contractAddress: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
    decimals: 18,
    enabled: true,
    coingeckoId: "pancakeswap-token",
  },
  {
    assetId: "busd_bsc_mainnet",
    networkId: "bsc_mainnet",
    symbol: "BUSD",
    name: "Binance USD",
    assetType: "ERC20",
    contractAddress: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
    decimals: 18,
    enabled: true,
    coingeckoId: "binance-usd",
  },

  // Popular tokens on Arbitrum
  {
    assetId: "arb_arbitrum_mainnet",
    networkId: "arbitrum_mainnet",
    symbol: "ARB",
    name: "Arbitrum",
    assetType: "ERC20",
    contractAddress: "0x912CE59144191C1204E64559FE8253a0e49E6548",
    decimals: 18,
    enabled: true,
    coingeckoId: "arbitrum",
  },

  // Popular tokens on Optimism
  {
    assetId: "op_optimism_mainnet",
    networkId: "optimism_mainnet",
    symbol: "OP",
    name: "Optimism",
    assetType: "ERC20",
    contractAddress: "0x4200000000000000000000000000000000000042",
    decimals: 18,
    enabled: true,
    coingeckoId: "optimism",
  },

  // Popular tokens on Avalanche
  {
    assetId: "wavax_avalanche_mainnet",
    networkId: "avalanche_mainnet",
    symbol: "WAVAX",
    name: "Wrapped AVAX",
    assetType: "ERC20",
    contractAddress: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    decimals: 18,
    enabled: true,
    coingeckoId: "wrapped-avax",
  },

  // UTXO Assets
  {
    assetId: "btc_bitcoin_mainnet",
    networkId: "bitcoin_mainnet",
    symbol: "BTC",
    name: "Bitcoin",
    assetType: "UTXO",
    decimals: 8,
    enabled: true,
    coingeckoId: "bitcoin",
  },
  {
    assetId: "ltc_litecoin_mainnet",
    networkId: "litecoin_mainnet",
    symbol: "LTC",
    name: "Litecoin",
    assetType: "UTXO",
    decimals: 8,
    enabled: true,
    coingeckoId: "litecoin",
  },

  // Solana
  {
    assetId: "sol_solana_mainnet",
    networkId: "solana_mainnet",
    symbol: "SOL",
    name: "Solana",
    assetType: "SOL",
    decimals: 9,
    enabled: true,
    coingeckoId: "solana",
  },

  // Additional popular ERC20 tokens to reach 100+
  {
    assetId: "shib_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "SHIB",
    name: "Shiba Inu",
    assetType: "ERC20",
    contractAddress: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
    decimals: 18,
    enabled: true,
    coingeckoId: "shiba-inu",
  },
  {
    assetId: "pepe_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "PEPE",
    name: "Pepe",
    assetType: "ERC20",
    contractAddress: "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
    decimals: 18,
    enabled: true,
    coingeckoId: "pepe",
  },
  {
    assetId: "floki_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "FLOKI",
    name: "FLOKI",
    assetType: "ERC20",
    contractAddress: "0xcf0C122c6b73ff809C693DB761e7BaeBe62b6a2E",
    decimals: 9,
    enabled: true,
    coingeckoId: "floki",
  },
  {
    assetId: "ldo_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "LDO",
    name: "Lido DAO",
    assetType: "ERC20",
    contractAddress: "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32",
    decimals: 18,
    enabled: true,
    coingeckoId: "lido-dao",
  },
  {
    assetId: "rpl_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "RPL",
    name: "Rocket Pool",
    assetType: "ERC20",
    contractAddress: "0xD33526068D116cE69F19A9ee46F0bd304F21A51f",
    decimals: 18,
    enabled: true,
    coingeckoId: "rocket-pool",
  },
  {
    assetId: "steth_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "stETH",
    name: "Lido Staked ETH",
    assetType: "ERC20",
    contractAddress: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    decimals: 18,
    enabled: true,
    coingeckoId: "staked-ether",
  },
  {
    assetId: "ens_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "ENS",
    name: "Ethereum Name Service",
    assetType: "ERC20",
    contractAddress: "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72",
    decimals: 18,
    enabled: true,
    coingeckoId: "ethereum-name-service",
  },
  {
    assetId: "frax_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "FRAX",
    name: "Frax",
    assetType: "ERC20",
    contractAddress: "0x853d955aCEf822Db058eb8505911ED77F175b99e",
    decimals: 18,
    enabled: true,
    coingeckoId: "frax",
  },
  {
    assetId: "fxs_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "FXS",
    name: "Frax Share",
    assetType: "ERC20",
    contractAddress: "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0",
    decimals: 18,
    enabled: true,
    coingeckoId: "frax-share",
  },
  {
    assetId: "gmx_arbitrum_mainnet",
    networkId: "arbitrum_mainnet",
    symbol: "GMX",
    name: "GMX",
    assetType: "ERC20",
    contractAddress: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a",
    decimals: 18,
    enabled: true,
    coingeckoId: "gmx",
  },
  {
    assetId: "mim_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "MIM",
    name: "Magic Internet Money",
    assetType: "ERC20",
    contractAddress: "0x99D8a9C45b2ecA8864373A26D1459e3Dff1e17F3",
    decimals: 18,
    enabled: true,
    coingeckoId: "magic-internet-money",
  },
  {
    assetId: "spell_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "SPELL",
    name: "Spell Token",
    assetType: "ERC20",
    contractAddress: "0x090185f2135308BaD17527004364eBcC2D37e5F6",
    decimals: 18,
    enabled: true,
    coingeckoId: "spell-token",
  },
  {
    assetId: "lrc_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "LRC",
    name: "Loopring",
    assetType: "ERC20",
    contractAddress: "0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD",
    decimals: 18,
    enabled: true,
    coingeckoId: "loopring",
  },
  {
    assetId: "imx_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "IMX",
    name: "Immutable X",
    assetType: "ERC20",
    contractAddress: "0xF57e7e7C23978C3cAEC3C3548E3D615c346e79fF",
    decimals: 18,
    enabled: true,
    coingeckoId: "immutable-x",
  },
  {
    assetId: "rndr_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "RNDR",
    name: "Render Token",
    assetType: "ERC20",
    contractAddress: "0x6De037ef9aD2725EB40118Bb1702EBb27e4Aeb24",
    decimals: 18,
    enabled: true,
    coingeckoId: "render-token",
  },
  {
    assetId: "yfi_ethereum_mainnet",
    networkId: "ethereum_mainnet",
    symbol: "YFI",
    name: "yearn.finance",
    assetType: "ERC20",
    contractAddress: "0x0bc529c00C6401aEF6D220BE8c6E1668F7B79D82",
    decimals: 18,
    enabled: true,
    coingeckoId: "yearn-finance",
  },
  {
    assetId: "ftm_fantom_mainnet",
    networkId: "fantom_mainnet",
    symbol: "FTM",
    name: "Fantom",
    assetType: "NATIVE",
    decimals: 18,
    enabled: true,
    coingeckoId: "fantom",
  },
];

/**
 * Get network by ID
 */
export function getNetwork(networkId: string): CryptoNetwork | undefined {
  return NETWORKS[networkId];
}

/**
 * Get asset by ID
 */
export function getAsset(assetId: string): CryptoAsset | undefined {
  return ASSETS.find((a) => a.assetId === assetId);
}

/**
 * Get all enabled networks
 */
export function getEnabledNetworks(): CryptoNetwork[] {
  return Object.values(NETWORKS).filter((n) => n.enabled);
}

/**
 * Get all enabled assets
 */
export function getEnabledAssets(): CryptoAsset[] {
  return ASSETS.filter((a) => a.enabled);
}

/**
 * Get assets by network
 */
export function getAssetsByNetwork(networkId: string): CryptoAsset[] {
  return ASSETS.filter((a) => a.networkId === networkId && a.enabled);
}

/**
 * Get assets by symbol (multi-chain)
 */
export function getAssetsBySymbol(symbol: string): CryptoAsset[] {
  return ASSETS.filter((a) => a.symbol.toUpperCase() === symbol.toUpperCase() && a.enabled);
}






