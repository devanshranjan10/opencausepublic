"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useRouter } from "next/navigation";
import { redirectToCashfree } from "@/lib/cashfree";
import { CryptoDonation } from "./crypto-donation";
import { CryptoDonationAdvanced } from "./crypto-donation-advanced";

interface DonateModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: any;
}

export function DonateModal({ isOpen, onClose, campaign }: DonateModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"INR" | "CRYPTO">("INR");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cryptoTokenType, setCryptoTokenType] = useState<"NATIVE" | "USDC" | "USDT">("NATIVE");
  const [cryptoTxHash, setCryptoTxHash] = useState<string | null>(null);
  
  // Guest donation fields
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const isGuest = !token;

  useEffect(() => {
    // Prevent body scroll when modal is open
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // No script loading needed for Cashfree - it uses redirect-based payment

  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (activeTab === "INR") {
        // INR donation via Cashfree
        if (!amount || parseFloat(amount) <= 0) {
          setError("Please enter a valid amount");
          setLoading(false);
          return;
        }

        // Add guest info if not logged in
        if (isGuest) {
          if (!guestName || !guestEmail) {
            setError("Please provide your name and email");
            setLoading(false);
            return;
          }
        }

        // Create Cashfree order
        const orderResponse = await apiRequest<{
          orderId: string;
          orderAmount: number;
          orderCurrency: string;
          paymentSessionId: string;
          paymentUrl: string;
        }>("/payments/cashfree/order", {
          method: "POST",
          body: JSON.stringify({
            amount: parseFloat(amount),
            campaignId: campaign.id,
            guestName: isGuest ? guestName : undefined,
            guestEmail: isGuest ? guestEmail : undefined,
          }),
        });

        // Redirect to Cashfree payment page
        redirectToCashfree(orderResponse.paymentUrl);
      } else {
        // Crypto donation - handled by CryptoDonation component
        // The component will handle the transaction and call onSuccess
        setLoading(true);
      }
    } catch (err: any) {
      setError(err.message || "Donation failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="glass rounded-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Donate to Campaign</h2>
                <button
                  onClick={onClose}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {success ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Thank You!</h3>
                  <p className="text-white/60 mb-4">Your donation has been received.</p>
                  {cryptoTxHash && (
                    <div className="mt-4 p-3 bg-white/5 rounded-lg">
                      <p className="text-xs text-white/60 mb-1">Transaction Hash:</p>
                      <p className="text-xs font-mono break-all">{cryptoTxHash}</p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold mb-2">{campaign.title}</h3>
                    <p className="text-white/60 text-sm line-clamp-2">{campaign.description}</p>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-2 mb-6">
                    <button
                      onClick={() => setActiveTab("INR")}
                      className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                        activeTab === "INR"
                          ? "bg-white text-black"
                          : "bg-white/10 text-white/60 hover:bg-white/20"
                      }`}
                    >
                      INR
                    </button>
                    <button
                      onClick={() => setActiveTab("CRYPTO")}
                      className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                        activeTab === "CRYPTO"
                          ? "bg-white text-black"
                          : "bg-white/10 text-white/60 hover:bg-white/20"
                      }`}
                    >
                      Crypto
                    </button>
                  </div>

                  <form onSubmit={handleDonate} className="space-y-4">
                    {isGuest && (
                      <>
                        <div>
                          <label className="block mb-2 text-sm font-medium">Your Name</label>
                          <input
                            type="text"
                            required
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                            placeholder="Enter your name"
                          />
                        </div>
                        <div>
                          <label className="block mb-2 text-sm font-medium">Your Email</label>
                          <input
                            type="email"
                            required
                            value={guestEmail}
                            onChange={(e) => setGuestEmail(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                            placeholder="Enter your email"
                          />
                        </div>
                      </>
                    )}


                    {activeTab === "CRYPTO" ? (
                      <CryptoDonationAdvanced
                        campaign={campaign}
                        onSuccess={(txHash) => {
                          setCryptoTxHash(txHash);
                          setSuccess(true);
                          setLoading(false);
                          setTimeout(() => {
                            onClose();
                            router.refresh();
                          }, 3000);
                        }}
                        onError={(err) => {
                          setError(err);
                          setLoading(false);
                        }}
                        guestName={isGuest ? guestName : undefined}
                        guestEmail={isGuest ? guestEmail : undefined}
                      />
                    ) : (
                      <>
                        {/* INR Amount Input */}
                        <div>
                          <label htmlFor="amount-input" className="block mb-2 text-sm font-medium text-white">
                            Amount (₹)
                          </label>
                          <input
                            id="amount-input"
                            type="number"
                            required
                            min="1"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                            placeholder="Enter amount in ₹"
                            autoFocus={activeTab === "INR"}
                          />
                        </div>

                        {error && (
                          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                            <p className="text-red-400 text-sm">{error}</p>
                          </div>
                        )}

                        <Button
                          type="submit"
                          className="w-full"
                          size="lg"
                          disabled={loading || !amount || parseFloat(amount) <= 0}
                        >
                          {loading ? "Processing..." : `Donate ₹${amount || "0"}`}
                        </Button>
                      </>
                    )}

                    {isGuest && (
                      <p className="text-xs text-white/40 text-center">
                        You can create an account to track your donations
                      </p>
                    )}
                  </form>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

