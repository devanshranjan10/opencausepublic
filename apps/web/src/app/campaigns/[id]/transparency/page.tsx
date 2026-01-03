"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ExternalLink, Copy, Check, TrendingUp, Wallet, ArrowRight, Shield } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface CampaignFinance {
  campaignId: string;
  totalsUsd: string;
  totalsByAsset: Record<string, string>;
  balanceByAsset: Record<string, string>;
  recentDonations: Array<{
    txHash: string;
    amountNative: string;
    assetId: string;
    networkId: string;
    explorerUrl: string;
    status: string;
    confirmations: number;
    createdAt: string;
  }>;
  withdrawals: Array<{
    withdrawalId: string;
    assetId: string;
    networkId: string;
    amountNative: string;
    toAddress: string;
    status: string;
    proofCids: string[];
    txHash?: string;
    explorerUrl?: string;
    createdAt: string;
  }>;
}

export default function CampaignTransparencyPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const [copied, setCopied] = useState<string | null>(null);

  const { data: finance, isLoading } = useQuery<CampaignFinance>({
    queryKey: ["campaign-finance", campaignId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/admin/campaigns/${campaignId}/finance`);
      if (!res.ok) throw new Error("Failed to fetch campaign finance");
      return res.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/60">Loading transparency data...</div>
      </div>
    );
  }

  if (!finance) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-red-500">Failed to load campaign data</div>
      </div>
    );
  }

  const totalUsd = parseFloat(finance.totalsUsd || "0");
  const assetKeys = Object.keys(finance.totalsByAsset || {});

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">Campaign Transparency</h1>
          <p className="text-white/60">
            All donations and withdrawals are verifiable on-chain. Click any transaction hash to view on the blockchain explorer.
          </p>
        </div>

        {/* Total Raised */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-8 bg-white/5 rounded-2xl border border-white/10"
        >
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-6 h-6 text-green-500" />
            <h2 className="text-2xl font-bold">Total Raised</h2>
          </div>
          <div className="text-5xl font-bold mb-6">
            ${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>

          {/* Breakdown by Asset */}
          {assetKeys.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-4">By Asset</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {assetKeys.map((assetKey) => {
                  const [assetId, networkId] = assetKey.split("_");
                  const total = finance.totalsByAsset[assetKey];
                  return (
                    <div key={assetKey} className="p-4 bg-white/5 rounded-lg">
                      <div className="text-sm text-white/60 mb-1">{assetId.toUpperCase()}</div>
                      <div className="text-xl font-bold">{total}</div>
                      <div className="text-xs text-white/40">{networkId}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>

        {/* Current Balances */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 p-8 bg-white/5 rounded-2xl border border-white/10"
        >
          <div className="flex items-center gap-3 mb-4">
            <Wallet className="w-6 h-6 text-blue-500" />
            <h2 className="text-2xl font-bold">Current On-Chain Balances</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {assetKeys.map((assetKey) => {
              const [assetId, networkId] = assetKey.split("_");
              const balance = finance.balanceByAsset[assetKey] || "0";
              return (
                <div key={assetKey} className="p-4 bg-white/5 rounded-lg">
                  <div className="text-sm text-white/60 mb-1">{assetId.toUpperCase()}</div>
                  <div className="text-xl font-bold">{balance}</div>
                  <div className="text-xs text-white/40">{networkId}</div>
                </div>
              );
            })}
            {assetKeys.length === 0 && (
              <div className="col-span-full text-white/60 text-center py-8">
                No balances yet
              </div>
            )}
          </div>
        </motion.div>

        {/* Recent Donations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold mb-6">Recent Donations</h2>
          <div className="space-y-4">
            {finance.recentDonations.length > 0 ? (
              finance.recentDonations.map((donation, idx) => (
                <motion.div
                  key={donation.txHash}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-6 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="text-lg font-medium">{donation.amountNative}</div>
                        <div className="text-sm text-white/60">{donation.assetId.toUpperCase()}</div>
                        <div
                          className={`px-2 py-1 rounded text-xs ${
                            donation.status === "CONFIRMED"
                              ? "bg-green-500/20 text-green-500"
                              : donation.status === "CONFIRMING"
                              ? "bg-yellow-500/20 text-yellow-500"
                              : "bg-white/20 text-white/60"
                          }`}
                        >
                          {donation.status}
                        </div>
                        {donation.confirmations > 0 && (
                          <div className="text-xs text-white/40">
                            {donation.confirmations} confirmations
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white/60 font-mono">
                          {donation.txHash.slice(0, 10)}...{donation.txHash.slice(-8)}
                        </span>
                        <button
                          onClick={() => copyToClipboard(donation.txHash, donation.txHash)}
                          className="p-1 hover:bg-white/10 rounded"
                        >
                          {copied === donation.txHash ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <a
                          href={donation.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-white/10 rounded"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                      <div className="text-xs text-white/40 mt-2">
                        {new Date(donation.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-12 text-white/60">
                No donations yet
              </div>
            )}
          </div>
        </motion.div>

        {/* Withdrawals */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-6 h-6 text-purple-500" />
            <h2 className="text-2xl font-bold">Withdrawal History</h2>
          </div>
          <div className="space-y-4">
            {finance.withdrawals.length > 0 ? (
              finance.withdrawals.map((withdrawal, idx) => (
                <motion.div
                  key={withdrawal.withdrawalId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-6 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="text-lg font-medium">{withdrawal.amountNative}</div>
                        <div className="text-sm text-white/60">{withdrawal.assetId.toUpperCase()}</div>
                        <div
                          className={`px-2 py-1 rounded text-xs ${
                            withdrawal.status === "EXECUTED"
                              ? "bg-green-500/20 text-green-500"
                              : withdrawal.status === "APPROVED"
                              ? "bg-blue-500/20 text-blue-500"
                              : withdrawal.status === "REQUESTED"
                              ? "bg-yellow-500/20 text-yellow-500"
                              : withdrawal.status === "REJECTED"
                              ? "bg-red-500/20 text-red-500"
                              : "bg-white/20 text-white/60"
                          }`}
                        >
                          {withdrawal.status}
                        </div>
                      </div>
                      <div className="text-sm text-white/60 mb-2">
                        To: <span className="font-mono">{withdrawal.toAddress}</span>
                      </div>
                      {withdrawal.txHash && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm text-white/60 font-mono">
                            {withdrawal.txHash.slice(0, 10)}...{withdrawal.txHash.slice(-8)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(withdrawal.txHash!, withdrawal.txHash!)}
                            className="p-1 hover:bg-white/10 rounded"
                          >
                            {copied === withdrawal.txHash ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          {withdrawal.explorerUrl && (
                            <a
                              href={withdrawal.explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 hover:bg-white/10 rounded"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      )}
                      {withdrawal.proofCids.length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs text-white/60 mb-2">Proof Documents (IPFS):</div>
                          <div className="flex flex-wrap gap-2">
                            {withdrawal.proofCids.map((cid) => (
                              <a
                                key={cid}
                                href={`https://ipfs.io/ipfs/${cid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1"
                              >
                                {cid.slice(0, 12)}...
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="text-xs text-white/40 mt-2">
                        {new Date(withdrawal.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-12 text-white/60">
                No withdrawals yet
              </div>
            )}
          </div>
        </motion.div>

        {/* Verify on Chain CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-12 p-8 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl border border-purple-500/30 text-center"
        >
          <h3 className="text-xl font-bold mb-2">Verify Everything On-Chain</h3>
          <p className="text-white/60 mb-4">
            All transactions are publicly verifiable on their respective blockchains. Use the explorer links above to verify any donation or withdrawal.
          </p>
          <Button
            variant="outline"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            View All Transactions
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}






