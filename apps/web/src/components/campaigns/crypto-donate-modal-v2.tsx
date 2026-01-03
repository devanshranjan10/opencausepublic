"use client";

import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// TODO: Re-enable when wagmi/rainbowkit are installed
// import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
// import { ConnectButton } from "@rainbow-me/rainbowkit";
// import { parseUnits, Address } from "viem";

// Stub types and functions
type Address = string;
const parseUnits = (value: string, decimals: number) => BigInt(0);
const ConnectButton: any = () => null;
const useAccount = () => ({ address: undefined, isConnected: false, chain: undefined });
const useWriteContract = () => ({ writeContract: () => {}, isPending: false, data: undefined, error: undefined });
const useWaitForTransactionReceipt = () => ({ isLoading: false, isSuccess: false });
import { X, Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// QR Code component
// Using qrcode.react for QR code generation
// Install: pnpm add qrcode.react
import { QRCodeSVG } from "qrcode.react";

interface CryptoDonateModalProps {
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (intentId: string, txHash?: string) => void;
}

interface Network {
  networkId: string;
  name: string;
  symbol: string;
  type: string;
  explorerBaseUrl: string;
}

interface Asset {
  assetId: string;
  symbol: string;
  name: string;
  decimals: number;
  networkId: string;
  assetType: string;
}

interface PaymentIntent {
  intentId: string;
  depositAddress: string;
  qrString: string;
  amountNative: string;
  amountUsd: string;
  expiresAt: string;
  explorerBaseUrl: string;
  explorerAddressUrl: string;
  status: "CREATED" | "SEEN" | "CONFIRMING" | "CONFIRMED" | "EXPIRED" | "FAILED";
  txHash?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function CryptoDonateModalV2({
  campaignId,
  open,
  onOpenChange,
  onSuccess,
}: CryptoDonateModalProps) {
  const [step, setStep] = useState<"select" | "amount" | "payment">("select");
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [amountUsd, setAmountUsd] = useState("");
  const [amountNative, setAmountNative] = useState("");
  const [amountMode, setAmountMode] = useState<"usd" | "native">("usd");
  const [copied, setCopied] = useState(false);
  const [intentId, setIntentId] = useState<string | null>(null);

  const { address, isConnected, chain } = useAccount();

  // Fetch networks
  const { data: networks } = useQuery<Network[]>({
    queryKey: ["crypto", "networks"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/crypto/networks`);
      return res.json();
    },
    enabled: open,
  });

  // Fetch assets for selected network
  const { data: assets } = useQuery<Asset[]>({
    queryKey: ["crypto", "assets", selectedNetwork?.networkId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/crypto/assets?networkId=${selectedNetwork?.networkId}`);
      return res.json();
    },
    enabled: !!selectedNetwork && open,
  });

  // Fetch payment intent status
  const { data: paymentIntent, refetch: refetchIntent } = useQuery<PaymentIntent>({
    queryKey: ["payment-intent", intentId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/crypto/payment-intents/${intentId}`);
      return res.json();
    },
    enabled: !!intentId && open,
    refetchInterval: (query) => {
      // Poll while confirming or created
      const data = query.state.data as any;
      if (data?.status === "CREATED" || data?.status === "CONFIRMING") {
        return 3000; // Every 3 seconds
      }
      return false;
    },
  });

  // Create payment intent mutation
  const createIntentMutation = useMutation({
    mutationFn: async (data: {
      campaignId: string;
      networkId: string;
      assetId: string;
      amountUsd?: string;
      amountNative?: string;
    }) => {
      const res = await fetch(`${API_BASE}/campaigns/${campaignId}/payment-intents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create payment intent");
      return res.json();
    },
    onSuccess: (data: PaymentIntent) => {
      setIntentId(data.intentId);
      setStep("payment");
      onSuccess?.(data.intentId);
    },
  });

  // Handle network/asset selection
  const handleContinue = () => {
    if (!selectedNetwork || !selectedAsset) return;
    if (!amountUsd && !amountNative) return;

    createIntentMutation.mutate({
      campaignId,
      networkId: selectedNetwork.networkId,
      assetId: selectedAsset.assetId,
      amountUsd: amountMode === "usd" ? amountUsd : undefined,
      amountNative: amountMode === "native" ? amountNative : undefined,
    });
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep("select");
      setSelectedNetwork(null);
      setSelectedAsset(null);
      setAmountUsd("");
      setAmountNative("");
      setIntentId(null);
    }
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 z-50 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-2xl font-bold">Donate Crypto</Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <AnimatePresence mode="wait">
            {step === "select" && (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* Network Selection */}
                <div>
                  <label className="block text-sm font-medium mb-3">Select Network</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {networks?.map((network) => (
                      <button
                        key={network.networkId}
                        onClick={() => {
                          setSelectedNetwork(network);
                          setSelectedAsset(null);
                        }}
                        className={cn(
                          "p-4 rounded-lg border transition-all text-left",
                          selectedNetwork?.networkId === network.networkId
                            ? "border-white bg-white/10"
                            : "border-white/10 hover:border-white/30 hover:bg-white/5"
                        )}
                      >
                        <div className="font-medium">{network.name}</div>
                        <div className="text-sm text-white/60">{network.symbol}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Asset Selection */}
                {selectedNetwork && (
                  <div>
                    <label className="block text-sm font-medium mb-3">Select Asset</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-60 overflow-y-auto">
                      {assets?.map((asset) => (
                        <button
                          key={asset.assetId}
                          onClick={() => setSelectedAsset(asset)}
                          className={cn(
                            "p-3 rounded-lg border transition-all text-left",
                            selectedAsset?.assetId === asset.assetId
                              ? "border-white bg-white/10"
                              : "border-white/10 hover:border-white/30 hover:bg-white/5"
                          )}
                        >
                          <div className="font-medium text-sm">{asset.symbol}</div>
                          <div className="text-xs text-white/60 truncate">{asset.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Amount Input */}
                {selectedAsset && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Amount</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAmountMode("usd")}
                          className={cn(
                            "px-4 py-2 rounded-lg border transition-all",
                            amountMode === "usd"
                              ? "border-white bg-white/10"
                              : "border-white/10 hover:border-white/30"
                          )}
                        >
                          USD
                        </button>
                        <button
                          onClick={() => setAmountMode("native")}
                          className={cn(
                            "px-4 py-2 rounded-lg border transition-all",
                            amountMode === "native"
                              ? "border-white bg-white/10"
                              : "border-white/10 hover:border-white/30"
                          )}
                        >
                          {selectedAsset.symbol}
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      step="any"
                      placeholder={amountMode === "usd" ? "Enter USD amount" : `Enter ${selectedAsset.symbol} amount`}
                      value={amountMode === "usd" ? amountUsd : amountNative}
                      onChange={(e) => {
                        if (amountMode === "usd") {
                          setAmountUsd(e.target.value);
                        } else {
                          setAmountNative(e.target.value);
                        }
                      }}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-white/30"
                    />
                  </div>
                )}

                <Button
                  onClick={handleContinue}
                  disabled={!selectedNetwork || !selectedAsset || (!amountUsd && !amountNative) || createIntentMutation.isPending}
                  className="w-full"
                >
                  {createIntentMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating payment intent...
                    </>
                  ) : (
                    "Continue to Payment"
                  )}
                </Button>
              </motion.div>
            )}

            {step === "payment" && paymentIntent && (
              <motion.div
                key="payment"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* Payment Status */}
                <div className="text-center">
                  <div className="text-sm text-white/60 mb-2">Payment Status</div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10">
                    {paymentIntent.status === "CREATED" && (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Waiting for payment...</span>
                      </>
                    )}
                    {paymentIntent.status === "CONFIRMING" && (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Confirming transaction...</span>
                      </>
                    )}
                    {paymentIntent.status === "CONFIRMED" && (
                      <>
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-green-500">Payment confirmed!</span>
                      </>
                    )}
                    {paymentIntent.status === "EXPIRED" && (
                      <span className="text-red-500">Payment expired</span>
                    )}
                  </div>
                </div>

                {/* QR Code */}
                {paymentIntent.status !== "CONFIRMED" && (
                  <div className="flex flex-col items-center space-y-4 p-6 bg-white/5 rounded-xl">
                    <div className="bg-white p-4 rounded-lg">
                      <QRCodeSVG
                        value={paymentIntent.qrString || paymentIntent.depositAddress}
                        size={256}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-white/60 mb-2">Scan to pay</div>
                      <div className="text-xs text-white/40">
                        {paymentIntent.amountNative} {selectedAsset?.symbol}
                      </div>
                      <div className="text-xs text-white/40">
                        ≈ ${paymentIntent.amountUsd} USD
                      </div>
                    </div>
                  </div>
                )}

                {/* Deposit Address */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Deposit Address</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={paymentIntent.depositAddress}
                      className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(paymentIntent.depositAddress)}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(paymentIntent.explorerAddressUrl, "_blank")}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Amount Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-lg">
                  <div>
                    <div className="text-xs text-white/60">Amount</div>
                    <div className="font-medium">
                      {paymentIntent.amountNative} {selectedAsset?.symbol}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-white/60">USD Value</div>
                    <div className="font-medium">${paymentIntent.amountUsd}</div>
                  </div>
                </div>

                {/* Transaction Hash */}
                {paymentIntent.txHash && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Transaction Hash</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={paymentIntent.txHash}
                        className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(`${paymentIntent.explorerBaseUrl}/tx/${paymentIntent.txHash}`, "_blank")
                        }
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Wallet Connect Option (for EVM) */}
                {selectedNetwork?.type === "EVM" && (
                  <div className="pt-4 border-t border-white/10">
                    <div className="text-sm text-white/60 mb-3">Or pay directly with wallet:</div>
                    {isConnected ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          // TODO: Implement direct wallet payment
                          // This would call vault.donate(intentId) with wagmi
                        }}
                      >
                        Pay with {address ? `${String(address).slice(0, 6)}...${String(address).slice(-4)}` : 'Wallet'}
                      </Button>
                    ) : (
                      <ConnectButton />
                    )}
                  </div>
                )}

                {paymentIntent.status === "CONFIRMED" && (
                  <Button
                    onClick={() => onOpenChange(false)}
                    className="w-full"
                  >
                    Close
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
