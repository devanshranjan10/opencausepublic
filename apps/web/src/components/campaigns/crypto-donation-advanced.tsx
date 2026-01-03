"use client";

import { useState, useEffect } from "react";
import { doc, onSnapshot, Unsubscribe, Firestore } from "firebase/firestore";
import { getFirestoreInstance } from "@/lib/firebase";
// QR Code component
import { QRCodeSVG } from "qrcode.react";
import { apiRequest } from "@/lib/api";
import { Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import { CryptoSelect } from "@/components/ui/crypto-select";
import { formatCryptoLabel } from "@opencause/crypto-core";
import { CryptoIcon } from "@/components/ui/crypto-icon";
import { useToast } from "@/components/ui/use-toast";

// Local network display name function (fallback if package export fails)
const getNetworkDisplayName = (networkId: string): string => {
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
};

interface CryptoDonationAdvancedProps {
  campaign: any;
  onSuccess: (txHash: string) => void;
  onError: (error: string) => void;
  guestName?: string;
  guestEmail?: string;
}

interface SupportedCrypto {
  assetId: string;
  symbol: string;
  name: string;
  networkId: string;
  blockchain: string;
  decimals: number;
  addressFormat: string;
  explorerUrl?: string;
  coingeckoId?: string;
  formattedLabel?: string;
}

// Helper function to parse API error messages and return user-friendly messages
function parseErrorMessage(error: any): { title: string; description: string; variant: "destructive" | "warning" | "info" } {
  const errorMessage = error?.message || error?.error || String(error);
  const lowerError = errorMessage.toLowerCase();

  // Transaction not found or not yet confirmed
  if (lowerError.includes("transaction not found") || lowerError.includes("not found yet")) {
    return {
      title: "Transaction Not Found",
      description: "The transaction hasn't been confirmed on the blockchain yet. Please wait a few moments and try again.",
      variant: "warning",
    };
  }

  // Transaction failed on chain
  if (lowerError.includes("transaction failed") || lowerError.includes("failed on chain")) {
    return {
      title: "Transaction Failed",
      description: "This transaction failed on the blockchain and cannot be verified as a donation.",
      variant: "destructive",
    };
  }

  // Wrong address (not sent to campaign address)
  if (lowerError.includes("not sent to") || lowerError.includes("was not sent to this campaign")) {
    return {
      title: "Wrong Recipient Address",
      description: "This transaction was not sent to the campaign's donation address. Please verify you're using the correct address.",
      variant: "destructive",
    };
  }

  // Replay attack (old transaction)
  if (lowerError.includes("older than") || lowerError.includes("replay") || lowerError.includes("start block")) {
    return {
      title: "Invalid Transaction",
      description: "This transaction is older than the payment request. Only transactions made after the address was generated are accepted.",
      variant: "warning",
    };
  }

  // No ERC20 transfer found
  if (lowerError.includes("no erc20") || lowerError.includes("no transfer") || lowerError.includes("transfer event")) {
    return {
      title: "No Transfer Found",
      description: "No token transfer to the campaign address was found in this transaction. Make sure you sent the correct token type.",
      variant: "destructive",
    };
  }

  // Already recorded (idempotency)
  if (lowerError.includes("already") || lowerError.includes("already recorded")) {
    return {
      title: "Already Processed",
      description: "This transaction has already been verified and recorded. Your donation is already counted.",
      variant: "info",
    };
  }

  // Invalid transaction hash format
  if (lowerError.includes("invalid") && (lowerError.includes("hash") || lowerError.includes("format"))) {
    return {
      title: "Invalid Transaction Hash",
      description: "Please check the transaction hash format. Format varies by cryptocurrency (Ethereum: 0x..., Bitcoin/Litecoin: 64 hex characters, Solana: Base58).",
      variant: "destructive",
    };
  }

  // Network/RPC errors
  if (lowerError.includes("rpc") || lowerError.includes("network") || lowerError.includes("connection")) {
    return {
      title: "Network Error",
      description: "Unable to connect to the blockchain network. Please check your internet connection and try again.",
      variant: "warning",
    };
  }

  // Payment intent not found
  if (lowerError.includes("payment intent not found") || lowerError.includes("intent not found")) {
    return {
      title: "Payment Request Not Found",
      description: "The payment request has expired or doesn't exist. Please generate a new donation address.",
      variant: "warning",
    };
  }

  // Unsupported asset type
  if (lowerError.includes("unsupported") || lowerError.includes("asset type")) {
    return {
      title: "Unsupported Cryptocurrency",
      description: "This cryptocurrency type is not supported for verification. Please contact support if you believe this is an error.",
      variant: "warning",
    };
  }

  // Generic error
  return {
    title: "Verification Failed",
    description: errorMessage.length > 100 ? errorMessage.substring(0, 100) + "..." : errorMessage,
    variant: "destructive",
  };
}

export function CryptoDonationAdvanced({
  campaign,
  onSuccess,
  onError,
  guestName,
  guestEmail,
}: CryptoDonationAdvancedProps) {
  const { toast } = useToast();
  // Only manual mode is supported (wallet connect mode removed)
  const donationMode = "manual";
  const [selectedCryptoAssetId, setSelectedCryptoAssetId] = useState<string>("");
  const [selectedCrypto, setSelectedCrypto] = useState<SupportedCrypto | null>(null);
  const [amount, setAmount] = useState("");
  const [amountType, setAmountType] = useState<"crypto" | "usd">("crypto");
  const [usdAmount, setUsdAmount] = useState("");
  const [supportedCryptos, setSupportedCryptos] = useState<SupportedCrypto[]>([]);
  const [donationAddress, setDonationAddress] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manualTxHash, setManualTxHash] = useState("");
  const [cryptoPrice, setCryptoPrice] = useState<Record<string, number>>({});
  const [detectedTxHash, setDetectedTxHash] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [selectedPopularCrypto, setSelectedPopularCrypto] = useState<string | null>(null);
  const [selectedChainForMultiChain, setSelectedChainForMultiChain] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [donationReceived, setDonationReceived] = useState(false);

  // Map network type to blockchain name
  const mapNetworkToBlockchain = (networkId: string): string => {
    const parts = networkId.split("_");
    return parts[0]; // e.g., "ethereum_mainnet" -> "ethereum"
  };

  // Map asset type to address format
  const mapAddressFormat = (asset: any): string => {
    if (asset.assetType === "NATIVE") {
      // Check network type
      const networkId = asset.networkId || "";
      if (networkId.includes("bitcoin") || networkId.includes("litecoin") || networkId.includes("doge")) {
        return "bitcoin";
      } else if (networkId.includes("solana")) {
        return "solana";
      }
      return "ethereum"; // Default for EVM chains
    }
    return "ethereum"; // ERC20 tokens
  };

  // Fetch supported cryptocurrencies from API
  useEffect(() => {
    const fetchCryptos = async () => {
      try {
        const assets = await apiRequest<any[]>("/crypto/assets");
        
        // Deduplicate assets by assetId to prevent duplicate key errors
        const uniqueAssets = Array.from(
          new Map(assets.map((asset) => [asset.assetId, asset])).values()
        );
        
        // Transform assets to component format with formatted labels
        const mappedCryptos: SupportedCrypto[] = uniqueAssets.map((asset) => ({
          assetId: asset.assetId,
          symbol: asset.symbol,
          name: asset.name || asset.symbol,
          networkId: asset.networkId,
          blockchain: mapNetworkToBlockchain(asset.networkId),
          decimals: asset.decimals || 18,
          addressFormat: mapAddressFormat(asset),
          explorerUrl: asset.explorerUrl,
          coingeckoId: asset.coingeckoId,
          // Add formatted label using crypto-core utility (with error handling)
          formattedLabel: (() => {
            try {
              return formatCryptoLabel(asset);
            } catch (error) {
              // Fallback to simple format if formatting fails
              return `${asset.symbol} - ${mapNetworkToBlockchain(asset.networkId)}`;
            }
          })(),
        }));
        
        setSupportedCryptos(mappedCryptos);
        
        // Set default selection (ETH on Ethereum mainnet)
        if (mappedCryptos.length > 0 && !selectedCrypto) {
          const defaultCrypto = mappedCryptos.find((c) => c.assetId === "eth_ethereum_mainnet") || mappedCryptos[0];
          setSelectedCryptoAssetId(defaultCrypto.assetId);
          setSelectedCrypto(defaultCrypto);
        }
        
        // Fetch crypto prices using API FX rate endpoint
        fetchCryptoPrices(mappedCryptos);
      } catch (error: any) {
        console.error("Failed to load cryptocurrencies:", error);
        onError(`Failed to load cryptocurrencies: ${error.message}`);
      }
    };
    fetchCryptos();
  }, []);

  // Fetch crypto prices using API FX rate service
  const fetchCryptoPrices = async (cryptos: SupportedCrypto[]) => {
    try {
      // Get unique asset IDs, filter out any invalid ones
      const assetIds = cryptos
        .filter(c => c.assetId && typeof c.assetId === "string" && c.assetId.length > 0)
        .map(c => c.assetId)
        .filter((id, index, self) => self.indexOf(id) === index); // Deduplicate
      
      if (assetIds.length === 0) {
        console.warn("No valid asset IDs found for FX rate fetching");
        return;
      }

      // Use API FX rate endpoint (URL encode assetIds to handle special characters)
      const assetIdsParam = encodeURIComponent(assetIds.join(","));
      const ratesData = await apiRequest<{ rates: Record<string, string> }>(
        `/crypto/fx-rates?assetIds=${assetIdsParam}`
      );
      
      // Map rates by asset ID, then by symbol for backward compatibility
      const prices: Record<string, number> = {};
      cryptos.forEach((crypto) => {
        const rate = ratesData.rates[crypto.assetId];
        if (rate) {
          prices[crypto.assetId] = parseFloat(rate);
          prices[crypto.symbol] = parseFloat(rate); // Also map by symbol for compatibility
        }
      });
      
      setCryptoPrice(prices);
    } catch (error) {
      console.error("Failed to fetch crypto prices:", error);
    }
  };

  // Poll FX rates every 60 seconds
  useEffect(() => {
    if (supportedCryptos.length === 0) return;
    
    const interval = setInterval(() => {
      fetchCryptoPrices(supportedCryptos);
    }, 60000); // Poll every 60 seconds
    
    return () => clearInterval(interval);
  }, [supportedCryptos]);

  // Convert USD to crypto
  useEffect(() => {
    if (amountType === "usd" && usdAmount && selectedCrypto) {
      const price = cryptoPrice[selectedCrypto.assetId] || cryptoPrice[selectedCrypto.symbol];
      if (price) {
        const cryptoAmount = parseFloat(usdAmount) / price;
        setAmount(cryptoAmount.toFixed(selectedCrypto.decimals || 8));
      }
    }
  }, [usdAmount, amountType, selectedCrypto, cryptoPrice]);

  // Convert crypto to USD
  useEffect(() => {
    if (amountType === "crypto" && amount && selectedCrypto) {
      const price = cryptoPrice[selectedCrypto.assetId] || cryptoPrice[selectedCrypto.symbol];
      if (price) {
        const usd = parseFloat(amount) * price;
        setUsdAmount(usd.toFixed(2));
      }
    }
  }, [amount, amountType, selectedCrypto, cryptoPrice]);

  // Generate donation address for manual mode
  const generateDonationAddress = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        variant: "warning",
        title: "Invalid Amount",
        description: "Please enter a valid donation amount greater than 0.",
      });
      onError("Please enter a valid amount");
      return;
    }

    if (!selectedCrypto) {
      toast({
        variant: "warning",
        title: "No Cryptocurrency Selected",
        description: "Please select a cryptocurrency to donate.",
      });
      onError("Please select a cryptocurrency");
      return;
    }

    setLoading(true);
    try {
      // Use payment intents API instead of donation-address
      const intentData = await apiRequest<{
        intentId: string;
        depositAddress: string;
        qrString: string;
        amountNative: string;
        amountUsd: string;
        networkId: string;
        assetId: string;
        explorerAddressUrl: string;
        explorerBaseUrl: string;
      }>("/crypto/payment-intents", {
        method: "POST",
        body: JSON.stringify({
          campaignId: campaign.id,
          networkId: selectedCrypto.networkId,
          assetId: selectedCrypto.assetId,
          amountUsd: amountType === "usd" ? usdAmount : undefined,
          amountNative: amountType === "crypto" ? amount : undefined,
        }),
      });

      // Validate address is present
      if (!intentData.depositAddress) {
        throw new Error("Invalid address received from server");
      }

      // Use qrString if available (has proper URI format), otherwise use depositAddress
      // For EVM chains, qrString might be just the address, which is fine
      const qrValue = intentData.qrString || intentData.depositAddress;
      
      // Final validation - ensure we have a valid address string
      if (!qrValue || qrValue.trim().length === 0) {
        throw new Error("Invalid QR code data received from server");
      }

      // Store USD amount from intent for later use in donation recording
      if (intentData.amountUsd) {
        setUsdAmount(intentData.amountUsd);
      }

      const addressData = {
        id: intentData.intentId,
        address: intentData.depositAddress,
        crypto: selectedCrypto.symbol,
        blockchain: selectedCrypto.blockchain,
        campaignId: campaign.id,
        qrCode: qrValue, // QR string with proper format (e.g., "ethereum:0x...", "bitcoin:bc1...", or plain address)
        amount: intentData.amountNative,
        amountUsd: intentData.amountUsd, // Store USD amount for donation recording
        explorerUrl: intentData.explorerAddressUrl, // Use the correct explorer URL from API
      };

      setDonationAddress(addressData);
      
      // Show success toast
      toast({
        variant: "success",
        title: "Donation Address Generated",
        description: `Please send ${intentData.amountNative} ${selectedCrypto.symbol} to the address below.`,
      });
    } catch (error: any) {
      const errorInfo = parseErrorMessage(error);
      toast({
        variant: errorInfo.variant,
        title: "Failed to Generate Address",
        description: errorInfo.description || error.message,
      });
      onError(`Failed to generate donation address: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle transaction verification using new intent-based endpoint (chain-truth)
  const verifyTransaction = async (txHash: string) => {
    if (!txHash || !donationAddress || !selectedCrypto) {
      toast({
        variant: "warning",
        title: "Missing Information",
        description: "Please ensure you have generated a donation address and selected a cryptocurrency.",
      });
      onError("Missing required information for verification");
      return;
    }

    const intentId = donationAddress.id;
    if (!intentId) {
      onError("Payment intent ID not found");
      return;
    }

    setLoading(true);
    setPollingError(null);
    try {
      // Normalize tx hash based on blockchain type
      let normalizedTxHash = txHash.trim();
      const blockchain = selectedCrypto?.blockchain || selectedCrypto?.networkId?.split("_")[0] || "";
      const chainLower = blockchain.toLowerCase();
      
      // Only add 0x prefix for Ethereum-based chains
      const isEthereumChain = chainLower === "ethereum" || chainLower.includes("bsc") || 
                             chainLower.includes("polygon") || chainLower.includes("arbitrum") || 
                             chainLower.includes("optimism") || chainLower.includes("avalanche") ||
                             chainLower.includes("base") || chainLower.includes("fantom");
      
      if (isEthereumChain) {
        // Ethereum chains: ensure 0x prefix and pad to 66 chars (0x + 64 hex)
        if (!normalizedTxHash.startsWith("0x")) {
          normalizedTxHash = `0x${normalizedTxHash}`;
        }
        // Pad to 64 hex chars if needed
        if (normalizedTxHash.length < 66) {
          const hex = normalizedTxHash.slice(2).padStart(64, "0");
          normalizedTxHash = `0x${hex}`;
        }
      }
      // For Bitcoin, Litecoin, Solana, etc., keep as-is (no 0x prefix)

      // Use new intent-based verification endpoint (chain-truth only)
      // This endpoint automatically:
      // 1. Verifies transaction on-chain
      // 2. Checks startBlock guard (prevents replay)
      // 3. Checks idempotency (prevents double-counting)
      // 4. Stores actual chain amounts (not form input)
      // 5. Creates donation record automatically
      // 6. Updates campaign totals
      const result = await apiRequest<{
        intentId: string;
        txHash: string;
        amountNative: string;
        amountRaw: string;
        usdLive: string;
        explorerUrl: string;
        confirmations: number;
        status: string;
        alreadyRecorded?: boolean;
      }>("/crypto/verify-intent", {
        method: "POST",
        body: JSON.stringify({
          intentId,
          txHash: normalizedTxHash,
        }),
      });

      // Log verification result for debugging
      console.log("Intent verification result:", result);

      // If already recorded, that's fine - just show success
      if (result.alreadyRecorded) {
        console.log("Transaction already recorded, showing success");
      }

      // Show success message
      setDonationReceived(true);
      setLoading(false);
      onSuccess(normalizedTxHash);
      
      // Show success toast
      toast({
        variant: "success",
        title: "Donation Verified!",
        description: `Successfully verified ${result.amountNative} ${selectedCrypto?.symbol || ""} donation. Thank you!`,
      });

      // Reload page after a short delay to show success message and update campaign totals
      setTimeout(() => {
        window.location.reload();
      }, 2500);
    } catch (error: any) {
      setLoading(false);
      
      // Parse and show user-friendly error message
      const errorInfo = parseErrorMessage(error);
      toast({
        variant: errorInfo.variant,
        title: errorInfo.title,
        description: errorInfo.description,
      });
      
      // Also call onError for backwards compatibility
      onError(errorInfo.description);
    } finally {
      setLoading(false);
    }
  };

  // Validate transaction hash based on blockchain type
  const validateTransactionHash = (hash: string, blockchain?: string): { valid: boolean; error?: string; normalized?: string } => {
    const trimmedHash = hash.trim();
    
    if (!trimmedHash || trimmedHash.length === 0) {
      return { valid: false, error: "Transaction hash cannot be empty" };
    }

    // Determine blockchain from selectedCrypto or parameter
    const chain = blockchain || selectedCrypto?.blockchain || selectedCrypto?.networkId?.split("_")[0] || "";
    const chainLower = chain.toLowerCase();
    
    // Also check symbol for better detection (LTC, BTC, etc.)
    const symbol = selectedCrypto?.symbol?.toUpperCase() || "";
    const isLitecoin = symbol === "LTC" || chainLower === "litecoin" || chainLower.includes("litecoin");
    const isBitcoin = symbol === "BTC" || chainLower === "bitcoin" || chainLower.includes("bitcoin");
    const isDogecoin = symbol === "DOGE" || chainLower === "dogecoin" || chainLower.includes("dogecoin");

    // Bitcoin, Litecoin, Dogecoin (UTXO-based chains) - check FIRST
    if (isLitecoin || isBitcoin || isDogecoin) {
      // These chains: Accept with or without 0x prefix, strip 0x for normalization
      // LTC/BTC hashes are typically 64 hex characters
      let hashToCheck = trimmedHash;
      if (hashToCheck.startsWith("0x") || hashToCheck.startsWith("0X")) {
        hashToCheck = hashToCheck.slice(2); // Remove 0x prefix
      }
      
      const hexPattern = /^[0-9a-fA-F]+$/;
      if (hexPattern.test(hashToCheck)) {
        // Accept 32-128 chars (most BTC/LTC txns are 64 chars)
        if (hashToCheck.length >= 32 && hashToCheck.length <= 128) {
          return { valid: true, normalized: hashToCheck }; // Return without 0x
        } else if (hashToCheck.length < 32) {
          return { valid: false, error: "Transaction hash is too short (minimum 32 characters)" };
        } else {
          return { valid: false, error: "Transaction hash is too long (maximum 128 characters)" };
        }
      } else {
        return { valid: false, error: "Transaction hash must be a valid hexadecimal string" };
      }
    }

    // Ethereum-based chains (ETH, BSC, Polygon, Arbitrum, Optimism, Avalanche, Base, Fantom, etc.)
    if (chainLower === "ethereum" || chainLower.includes("bsc") || chainLower.includes("polygon") || 
        chainLower.includes("arbitrum") || chainLower.includes("optimism") || chainLower.includes("avalanche") ||
        chainLower.includes("base") || chainLower.includes("fantom")) {
      // Ethereum chains: should start with 0x, or we can add it
      let normalized = trimmedHash;
      if (!normalized.startsWith("0x")) {
        normalized = `0x${normalized}`;
      }
      
      // Validate hexadecimal format
      const hexPattern = /^0x[0-9a-fA-F]+$/;
      if (!hexPattern.test(normalized)) {
        return { valid: false, error: "Transaction hash must be a valid hexadecimal string (can start with or without 0x)" };
      }
      
      // Minimum length check (at least 10 chars including 0x)
      if (normalized.length < 10) {
        return { valid: false, error: "Transaction hash is too short" };
      }
      
      return { valid: true, normalized };
    }
    
    // Solana
    if (chainLower === "solana" || symbol === "SOL") {
      // Solana uses Base58 encoding (alphanumeric, no 0, O, I, l)
      const base58Pattern = /^[1-9A-HJ-NP-Za-km-z]+$/;
      if (!base58Pattern.test(trimmedHash)) {
        return { valid: false, error: "Transaction hash must be a valid Base58 encoded string" };
      }
      
      // Solana transaction signatures are typically 88 characters
      if (trimmedHash.length < 32) {
        return { valid: false, error: "Transaction hash is too short" };
      }
      
      return { valid: true, normalized: trimmedHash };
    }
    
    // Auto-detect format based on hash characteristics
    // Priority: Check if it's a valid hex string
    const hexPattern = /^[0-9a-fA-F]+$/;
    let hashWithoutPrefix = trimmedHash;
    let hasPrefix = false;
    
    if (trimmedHash.startsWith("0x") || trimmedHash.startsWith("0X")) {
      hashWithoutPrefix = trimmedHash.slice(2);
      hasPrefix = true;
    }
    
    if (hexPattern.test(hashWithoutPrefix)) {
      // 64 hex characters (with or without 0x) is almost certainly Bitcoin/Litecoin
      if (hashWithoutPrefix.length === 64) {
        return { valid: true, normalized: hashWithoutPrefix }; // Always return without 0x for BTC/LTC
      }
      // 32-128 hex chars without prefix or with prefix but not 64 chars = likely BTC/LTC variant
      else if (hashWithoutPrefix.length >= 32 && hashWithoutPrefix.length <= 128) {
        return { valid: true, normalized: hashWithoutPrefix }; // Return without 0x for BTC/LTC
      }
      // If it has 0x prefix and is valid hex but not 64 chars, might be Ethereum
      else if (hasPrefix && hashWithoutPrefix.length >= 10) {
        return { valid: true, normalized: trimmedHash }; // Keep 0x for Ethereum
      }
      // Short hex without 0x - might be Ethereum, add 0x
      else if (!hasPrefix && hashWithoutPrefix.length >= 10 && hashWithoutPrefix.length < 64) {
        return { valid: true, normalized: `0x${hashWithoutPrefix}` };
      }
    }
    
    // Try Base58 (Solana style) as last resort
    const base58Pattern = /^[1-9A-HJ-NP-Za-km-z]+$/;
    if (base58Pattern.test(trimmedHash) && trimmedHash.length >= 32) {
      return { valid: true, normalized: trimmedHash };
    }
    
    return { valid: false, error: "Invalid transaction hash format. Please check the format for your selected cryptocurrency." };
  };

  // Handle manual transaction verification
  const verifyManualTransaction = async () => {
    const txHashToVerify = manualTxHash.trim();
    if (!txHashToVerify || txHashToVerify.length === 0) {
      toast({
        variant: "warning",
        title: "Missing Transaction Hash",
        description: "Please enter a transaction hash to verify.",
      });
      onError("Please enter transaction hash");
      return;
    }
    
    // Validate transaction hash format based on selected cryptocurrency
    const validation = validateTransactionHash(txHashToVerify);
    if (!validation.valid) {
      toast({
        variant: "destructive",
        title: "Invalid Transaction Hash",
        description: validation.error || "Please check the transaction hash format for your selected cryptocurrency.",
      });
      onError(validation.error || "Invalid transaction hash format");
      return;
    }
    
    // Use normalized hash if available
    await verifyTransaction(validation.normalized || txHashToVerify);
  };

  // Auto-detect transaction using API polling (fallback if Firestore not accessible)
  useEffect(() => {
    if (!donationAddress || !selectedCrypto) {
      return;
    }

    const intentId = donationAddress.id;
    if (!intentId) return;

    setIsPolling(true);
    setPollingError(null);
    setDetectedTxHash(null);
    setShowManualEntry(false);

    let unsubscribe: Unsubscribe | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let timeout: NodeJS.Timeout;
    let finalTimeout: NodeJS.Timeout;
    let useFirestore = true; // Try Firestore first, fallback to API if it fails

    // Try to set up Firestore realtime listener (with fallback to API polling)
    const setupFirestoreListener = () => {
      try {
        // Try to get Firestore instance (may throw if not configured)
        let firestoreInstance: Firestore;
        try {
          firestoreInstance = getFirestoreInstance();
        } catch (firebaseError) {
          // Firestore not configured, skip and use API polling
          console.warn("[Firestore] Not configured, using API polling:", firebaseError);
          useFirestore = false;
          startApiPolling();
          return;
        }
        
        const intentRef = doc(firestoreInstance, "payment_intents", intentId);
        
        unsubscribe = onSnapshot(
          intentRef,
          (snapshot) => {
            if (!snapshot.exists()) {
              console.warn(`[Firestore] Payment intent ${intentId} not found`);
              return;
            }

            const intent = snapshot.data();
            const status = intent?.status;
            const txHash = intent?.confirmedTxHash || intent?.txHash;

            console.log(`[Firestore] Intent ${intentId} status: ${status}, txHash: ${txHash}`);

            // Handle different statuses
            if (status === "DETECTING") {
              setIsPolling(true);
            } else if (status === "CONFIRMING" && txHash) {
              setDetectedTxHash(txHash);
              setIsPolling(false);
              verifyTransaction(txHash).catch((err) => {
                console.error("Auto-verification failed:", err);
                const errorInfo = parseErrorMessage(err);
                toast({
                  variant: errorInfo.variant,
                  title: "Auto-Verification Failed",
                  description: "Transaction was detected but verification failed. Please try manually verifying the transaction hash.",
                });
              });
            } else if (status === "CONFIRMED" && txHash) {
              setDetectedTxHash(txHash);
              setIsPolling(false);
              setDonationReceived(true);
              if (timeout) clearTimeout(timeout);
              if (finalTimeout) clearTimeout(finalTimeout);
              
              toast({
                variant: "success",
                title: "Donation Received!",
                description: "Your crypto donation has been confirmed and recorded.",
              });

              setTimeout(() => {
                window.location.reload();
              }, 2500);
            } else if (status === "EXPIRED" || status === "FAILED") {
              setIsPolling(false);
              setShowManualEntry(true);
              if (timeout) clearTimeout(timeout);
              if (finalTimeout) clearTimeout(finalTimeout);
            }
          },
          (error) => {
            // Firestore permission error - fallback to API polling
            console.warn("[Firestore] Error listening to intent, falling back to API polling:", error);
            useFirestore = false;
            if (unsubscribe) {
              unsubscribe();
              unsubscribe = null;
            }
            startApiPolling();
          }
        );
      } catch (error: any) {
        console.warn("[Firestore] Failed to set up listener, falling back to API polling:", error);
        useFirestore = false;
        startApiPolling();
      }
    };

    // Fallback: API polling (used if Firestore fails)
    const startApiPolling = () => {
      if (pollInterval) return; // Already polling

      pollInterval = setInterval(async () => {
        try {
          const intent: any = await apiRequest(`/crypto/payment-intents/${intentId}`);
          const txHash = intent?.txHash || intent?.confirmedTxHash;
          
          if ((intent?.status === "CONFIRMED" || intent?.status === "CONFIRMING") && txHash) {
            setDetectedTxHash(txHash);
            setIsPolling(false);
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
            if (timeout) clearTimeout(timeout);
            if (finalTimeout) clearTimeout(finalTimeout);
            
            if (intent?.status === "CONFIRMING") {
              verifyTransaction(txHash).catch((err) => {
                console.error("Auto-verification failed:", err);
              });
            } else if (intent.status === "CONFIRMED") {
              setDonationReceived(true);
              toast({
                variant: "success",
                title: "Donation Received!",
                description: "Your crypto donation has been confirmed and recorded.",
              });
              setTimeout(() => {
                window.location.reload();
              }, 2500);
            }
          } else if (intent.status === "EXPIRED" || intent.status === "FAILED") {
            setIsPolling(false);
            setShowManualEntry(true);
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
          }
        } catch (error: any) {
          console.error("Error polling payment intent:", error);
        }
      }, 10000); // Poll every 10 seconds
    };

    // Try Firestore first
    setupFirestoreListener();

    // Show manual entry option after 5 minutes
    timeout = setTimeout(() => {
      setShowManualEntry(true);
    }, 300000); // 5 minutes

    // Stop after 10 minutes
    finalTimeout = setTimeout(() => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      setIsPolling(false);
      setShowManualEntry(true);
    }, 600000); // 10 minutes

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (timeout) clearTimeout(timeout);
      if (finalTimeout) clearTimeout(finalTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donationAddress?.id, selectedCrypto?.assetId]);

  // Popular cryptocurrencies
  const popularCryptos = [
    { symbol: "BTC", name: "Bitcoin", assetIds: ["btc_bitcoin_mainnet"] },
    { symbol: "ETH", name: "Ethereum", assetIds: ["eth_ethereum_mainnet"] },
    { symbol: "USDT", name: "Tether USD", assetIds: ["usdt_ethereum_mainnet", "usdt_bsc_mainnet", "usdt_polygon_mainnet"] },
    { symbol: "USDC", name: "USD Coin", assetIds: ["usdc_ethereum_mainnet", "usdc_bsc_mainnet", "usdc_polygon_mainnet"] },
    { symbol: "SOL", name: "Solana", assetIds: ["sol_solana_mainnet"] },
    { symbol: "LTC", name: "Litecoin", assetIds: ["ltc_litecoin_mainnet"] },
  ];

  // Get multi-chain options for a symbol
  const getMultiChainOptions = (symbol: string) => {
    try {
      return supportedCryptos
        .filter(c => c.symbol === symbol)
        .map(c => {
          try {
            const chainName = getNetworkDisplayName(c.networkId);
            return {
              assetId: c.assetId,
              networkId: c.networkId,
              label: c.formattedLabel || `${c.symbol} - ${chainName}`,
              chainName,
            };
          } catch (error) {
            console.error("Error formatting crypto option:", error);
            return {
              assetId: c.assetId,
              networkId: c.networkId,
              label: c.formattedLabel || `${c.symbol} - ${c.networkId}`,
              chainName: c.networkId,
            };
          }
        });
    } catch (error) {
      console.error("Error getting multi-chain options:", error);
      return [];
    }
  };

  // Handle popular crypto selection
  const handlePopularCryptoSelect = (symbol: string) => {
    try {
      setSelectedPopularCrypto(symbol);
      const options = getMultiChainOptions(symbol);
      
      if (options.length === 0) {
        onError(`No ${symbol} options found. Please try selecting from the full list.`);
        setSelectedPopularCrypto(null);
        return;
      }
      
      if (options.length === 1) {
        // Single chain option, select directly
        const crypto = supportedCryptos.find(c => c.assetId === options[0].assetId);
        if (crypto) {
          setSelectedCryptoAssetId(options[0].assetId);
          setSelectedCrypto(crypto);
          setSelectedPopularCrypto(null);
          setSelectedChainForMultiChain(null);
        } else {
          onError(`Asset not found for ${symbol}`);
          setSelectedPopularCrypto(null);
        }
      } else if (options.length > 1) {
        // Multiple chains, show chain selector
        setSelectedChainForMultiChain(null);
      }
    } catch (error: any) {
      console.error("Error in handlePopularCryptoSelect:", error);
      onError(error.message || `Failed to select ${symbol}`);
      setSelectedPopularCrypto(null);
    }
  };

  // Handle chain selection for multi-chain tokens
  const handleChainSelect = (assetId: string) => {
    setSelectedChainForMultiChain(assetId);
    const crypto = supportedCryptos.find(c => c.assetId === assetId);
    setSelectedCryptoAssetId(assetId);
    setSelectedCrypto(crypto || null);
    setSelectedPopularCrypto(null);
  };

  // Copy address to clipboard
  const copyAddress = () => {
    if (donationAddress?.address) {
      navigator.clipboard.writeText(donationAddress.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Removed unused variables

  return (
    <div className="space-y-6">
      {/* Popular Cryptos Section */}
      <div>
        <label className="block mb-2 text-sm font-medium">Popular Cryptocurrencies</label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
          {popularCryptos.map((crypto) => {
            // Get the first asset's coingeckoId for better icon matching
            const firstAsset = supportedCryptos.find(c => c.assetId === crypto.assetIds[0]);
            const isSelected = selectedPopularCrypto === crypto.symbol;
            return (
              <button
                key={crypto.symbol}
                onClick={() => {
                  try {
                    handlePopularCryptoSelect(crypto.symbol);
                  } catch (error: any) {
                    console.error("Error selecting popular crypto:", error);
                    const errorInfo = parseErrorMessage(error);
                    toast({
                      variant: errorInfo.variant,
                      title: errorInfo.title,
                      description: errorInfo.description,
                    });
                    onError(error.message || "Failed to select cryptocurrency");
                  }
                }}
                className={`relative flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                  isSelected
                    ? "bg-white/10 border-white/30"
                    : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                <CryptoIcon 
                  symbol={crypto.symbol} 
                  coingeckoId={firstAsset?.coingeckoId}
                  size={32}
                />
                <span className="text-xs font-medium">{crypto.symbol}</span>
              </button>
            );
          })}
        </div>

        {/* Chain Selector for Multi-Chain Tokens */}
        {selectedPopularCrypto && getMultiChainOptions(selectedPopularCrypto).length > 1 && (
          <div className="mb-4">
            <label className="block mb-2 text-sm font-medium">Select Chain</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {getMultiChainOptions(selectedPopularCrypto).map((option) => (
                <button
                  key={option.assetId}
                  onClick={() => handleChainSelect(option.assetId)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedChainForMultiChain === option.assetId
                      ? "bg-white/10 border-white/30"
                      : "bg-white/5 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <div className="font-medium text-sm">{option.chainName}</div>
                  <div className="text-xs text-white/60">{option.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Full Crypto Selection */}
        <div className="mt-4">
          <label className="block mb-2 text-sm font-medium">Or Select Other Cryptocurrency</label>
          <CryptoSelect
            options={supportedCryptos.map((c) => ({
              key: c.assetId,
              symbol: c.symbol,
              name: c.formattedLabel || `${c.name} - ${getNetworkDisplayName(c.networkId)}`,
              blockchain: c.blockchain,
              decimals: c.decimals,
              coingeckoId: c.coingeckoId,
            }))}
            value={selectedCryptoAssetId}
            onChange={(key, option) => {
              setSelectedCryptoAssetId(key);
              const crypto = supportedCryptos.find(c => c.assetId === key);
              setSelectedCrypto(crypto || null);
              setSelectedPopularCrypto(null);
              setSelectedChainForMultiChain(null);
            }}
            placeholder="Search cryptocurrency (e.g., LTC, Litecoin, USDC on Polygon)..."
          />
        </div>
      </div>

      {/* Amount Input */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => setAmountType("crypto")}
            className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
              amountType === "crypto"
                ? "bg-white text-black font-medium"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
          >
            {selectedCrypto?.symbol || "Crypto"}
          </button>
          <button
            onClick={() => setAmountType("usd")}
            className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
              amountType === "usd"
                ? "bg-white text-black font-medium"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
          >
            USD
          </button>
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium">
            Amount ({amountType === "crypto" ? selectedCrypto?.symbol || "Crypto" : "USD"})
          </label>
          <input
            type="number"
            step={amountType === "crypto" ? "0.00000001" : "0.01"}
            value={amountType === "crypto" ? amount : usdAmount}
            onChange={(e) => {
              if (amountType === "crypto") {
                setAmount(e.target.value);
              } else {
                setUsdAmount(e.target.value);
              }
            }}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
            placeholder={`Enter amount in ${amountType === "crypto" ? selectedCrypto?.symbol || "crypto" : "USD"}`}
          />
          {amountType === "crypto" && usdAmount && (
            <p className="text-xs text-white/60 mt-1">≈ ${usdAmount} USD</p>
          )}
          {amountType === "usd" && amount && selectedCrypto && (
            <p className="text-xs text-white/60 mt-1">≈ {amount} {selectedCrypto.symbol}</p>
          )}
        </div>
      </div>

      {/* Manual Payment Mode */}
      <div className="space-y-4">
          {!donationAddress ? (
            <button
              onClick={generateDonationAddress}
              disabled={loading || !amount || parseFloat(amount) <= 0}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all"
            >
              {loading ? "Generating Address..." : "Generate Donation Address"}
            </button>
          ) : (
            <div className="space-y-4">
              {/* QR Code */}
              <div className="bg-white p-4 rounded-lg flex justify-center">
                {(() => {
                  // Prioritize qrCode (has proper URI format), fallback to address
                  const qrValue = donationAddress.qrCode || donationAddress.address;
                  // Validate that we have a non-empty string
                  if (qrValue && typeof qrValue === "string" && qrValue.trim().length > 0) {
                    return (
                      <QRCodeSVG 
                        value={qrValue}
                        size={256}
                        level="H"
                        includeMargin={true}
                      />
                    );
                  }
                  return (
                    <div className="w-64 h-64 flex flex-col items-center justify-center text-gray-500">
                      <p className="text-sm mb-2">Invalid QR code data</p>
                      <p className="text-xs">Please regenerate the address</p>
                    </div>
                  );
                })()}
              </div>

              {/* Address Display */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
                <div>
                  <label className="block text-xs text-white/60 mb-1">Donation Address</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono break-all text-white">
                      {donationAddress.address}
                    </code>
                    <button
                      onClick={copyAddress}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-white/60" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-white/60">Amount:</span>
                    <p className="font-medium">{amount} {donationAddress.crypto || selectedCrypto?.symbol}</p>
                  </div>
                  {usdAmount && (
                    <div>
                      <span className="text-white/60">USD Value:</span>
                      <p className="font-medium">${usdAmount}</p>
                    </div>
                  )}
                </div>

                {donationAddress && (
                  <a
                    href={(donationAddress as any).explorerUrl || `${selectedCrypto?.explorerUrl || "https://etherscan.io/address/"}${donationAddress.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                  >
                    View on Explorer <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>

              {/* Auto-Detection Status */}
              {isPolling && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-400">Detecting transaction...</p>
                      <p className="text-xs text-white/60 mt-1">
                        We're automatically checking for your payment. This may take a few moments.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Donation Received Success */}
              {donationReceived && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-400">Donation received successfully!</p>
                      <p className="text-xs text-white/60 mt-1">
                        Your donation has been recorded. The page will refresh shortly to show updated campaign totals.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Detected Transaction */}
              {detectedTxHash && !loading && !donationReceived && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-400">Transaction detected!</p>
                      <p className="text-xs text-white/60 mt-1 font-mono break-all">
                        {detectedTxHash}
                      </p>
                      <p className="text-xs text-white/60 mt-2">Verifying with blockchain...</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Manual Transaction Hash Input (always available as backup) */}
              {!detectedTxHash && (
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <label className="block mb-2 text-sm font-medium text-white/80">
                    Transaction Hash {showManualEntry && "(Enter manually after 5+ minutes)"}
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={manualTxHash}
                      onChange={(e) => setManualTxHash(e.target.value)}
                      placeholder="Enter transaction hash (format varies by crypto)"
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 font-mono text-sm min-w-0"
                    />
                    <button
                      onClick={verifyManualTransaction}
                      disabled={loading || !manualTxHash}
                      className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 sm:px-6 rounded-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap flex-shrink-0"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="hidden sm:inline">Verifying...</span>
                          <span className="sm:hidden">Verify</span>
                        </>
                      ) : (
                        <>
                          <span className="hidden sm:inline">Verify Transaction</span>
                          <span className="sm:hidden">Verify</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-white/40 mt-2">
                    {showManualEntry 
                      ? "Auto-detection is still running. You can manually enter your transaction hash to verify immediately."
                      : "Transaction will be auto-detected. If needed, you can manually enter the transaction hash above."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
    </div>
  );
}


