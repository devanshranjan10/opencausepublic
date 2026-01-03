"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/api";
import { usePrices, computeInrValue } from "@/hooks/usePrices";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Trophy, TrendingUp, FileText } from "lucide-react";

interface DonationPublicDoc {
  donationId: string;
  campaignId: string;
  type: "CRYPTO" | "INR";
  donorLabel: string;
  isAnonymous: boolean;
  assetSymbol: string;
  networkId?: string;
  amountNative: string;
  amountRaw?: string;
  decimals?: number;
  verified: boolean;
  verifiedOnChain: boolean;
  txHashMasked?: string;
  explorerUrl?: string;
  createdAt: {
    seconds?: number;
    toDate?: () => Date;
    toMillis?: () => number;
  };
  blockTimestamp?: {
    seconds?: number;
    toDate?: () => Date;
  };
  blockNumber?: string;
  inrAtConfirm?: string;
  updatedAt: any;
}

interface CampaignDonationsPanelProps {
  campaignId: string;
  goalInr?: string;
  totalRaisedInr?: string;
}

export function CampaignDonationsPanel({ campaignId, goalInr, totalRaisedInr }: CampaignDonationsPanelProps) {
  const [timeFilter, setTimeFilter] = useState<"all" | "24h" | "7d">("all");
  const [showOnlyCrypto, setShowOnlyCrypto] = useState(false);

  // Fetch donations
  const { data: donations = [], isLoading } = useQuery<DonationPublicDoc[]>({
    queryKey: ["campaign-donations", campaignId],
    queryFn: async () => {
      return apiRequest<DonationPublicDoc[]>(`/crypto/campaigns/${campaignId}/donations-public`);
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Get unique symbols for price fetching
  const symbols = useMemo(() => {
    const unique = new Set<string>(["INR"]); // Always include INR
    donations.forEach((d) => {
      if (d.assetSymbol && d.assetSymbol !== "INR") {
        unique.add(d.assetSymbol);
      }
    });
    return Array.from(unique);
  }, [donations]);

  // Fetch prices with fallback
  const { data: pricesData, isLoading: pricesLoading } = usePrices(symbols);
  const prices = pricesData?.prices || {};
  
  // Fallback prices (last known good values)
  const fallbackPrices: Record<string, string> = {
    "USDT": "83.50",
    "USDC": "83.50",
    "ETH": "250000",
    "BTC": "5500000",
    "LTC": "8300",
    "BNB": "50000",
    "MATIC": "80",
    "SOL": "12000",
    "AVAX": "3500",
    "DOGE": "12",
  };
  
  // Use fallback prices if API fails
  const effectivePrices = pricesLoading || Object.keys(prices).length === 0 
    ? { ...fallbackPrices, ...prices } 
    : prices;
  
  // Debug: Log prices when they change
  if (pricesData && Object.keys(prices).length > 0) {
    console.log('[DonationsPanel] Prices loaded:', prices);
  }

  // Filter donations by time and validate data quality
  const filteredDonations = useMemo(() => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    return donations.filter((donation) => {
      // Hard filters: skip invalid donations (safety net in case backend misses some)
      if (!donation.verified) return false;
      
      // Skip 0 amounts
      const amountNative = parseFloat(donation.amountNative || "0");
      if (amountNative <= 0) return false;
      
      // Must have createdAt
      const createdAt = getTimestamp(donation.createdAt);
      if (!createdAt || createdAt <= 0) return false;
      
      // Time filter
      if (timeFilter === "24h" && createdAt < oneDayAgo) return false;
      if (timeFilter === "7d" && createdAt < sevenDaysAgo) return false;

      // Type filter
      if (showOnlyCrypto && donation.type !== "CRYPTO") return false;

      return true;
    });
  }, [donations, timeFilter, showOnlyCrypto]);

  // Top donations (sorted by INR value)
  const topDonations = useMemo(() => {
    return [...filteredDonations]
      .map((d) => {
        const inrValue = d.type === "INR" 
          ? parseFloat(d.amountNative)
          : computeInrValue(d.amountNative, d.assetSymbol, prices);
        return { ...d, inrValue };
      })
      .sort((a, b) => (b.inrAtConfirm ? parseFloat(b.inrAtConfirm) : b.inrValue) - (a.inrAtConfirm ? parseFloat(a.inrAtConfirm) : a.inrValue))
      .slice(0, 25);
  }, [filteredDonations, prices]);

  // Recent donations (sorted by time)
  const recentDonations = useMemo(() => {
    return [...filteredDonations].sort((a, b) => {
      const aTime = getTimestamp(a.createdAt);
      const bTime = getTimestamp(b.createdAt);
      return bTime - aTime;
    }).slice(0, 50);
  }, [filteredDonations]);

  // Format timestamp
  const formatTime = (timestamp: DonationPublicDoc["createdAt"]) => {
    const date = getDateFromTimestamp(timestamp);
    if (!date || isNaN(date.getTime())) {
      // If date is invalid, don't render this donation (filtered out above)
      return "";
    }
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatAmount = (donation: DonationPublicDoc) => {
    const amount = parseFloat(donation.amountNative);
    if (donation.type === "INR") {
      return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
    }
    return `${amount.toLocaleString("en-US", { maximumFractionDigits: 8 })} ${donation.assetSymbol}`;
  };

  const getInrValue = (donation: DonationPublicDoc) => {
    if (donation.type === "INR") {
      return parseFloat(donation.amountNative);
    }
    
    // ALWAYS use stored inrAtConfirm value (at time of donation) - never calculate from live prices
    if (donation.inrAtConfirm && parseFloat(donation.inrAtConfirm) > 0) {
      return parseFloat(donation.inrAtConfirm);
    }
    
    // If inrAtConfirm is missing, return 0 (should not happen for verified donations)
    console.warn(`[getInrValue] Missing inrAtConfirm for ${donation.assetSymbol} donation ${donation.donationId}`);
    return 0;
  };

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-white/10 rounded w-1/3" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-white/5 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-8">
      <div className="mb-6">
        <h2 className="text-3xl font-bold mb-4">Donations</h2>
        
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-white/40 text-sm mb-1">Total Raised</p>
            <p className="text-2xl font-bold">
              ₹{filteredDonations.reduce((sum, donation) => {
                const inrValue = getInrValue(donation);
                return sum + (inrValue > 0 ? inrValue : 0);
              }, 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-white/40 text-sm mb-1">Donors</p>
            <p className="text-2xl font-bold">{new Set(filteredDonations.map((d) => d.donorLabel)).size}</p>
          </div>
          <div>
            <p className="text-white/40 text-sm mb-1">Goal</p>
            <p className="text-2xl font-bold">
              ₹{goalInr ? parseFloat(goalInr).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "0"}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant={timeFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter("all")}
          >
            All-time
          </Button>
          <Button
            variant={timeFilter === "24h" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter("24h")}
          >
            24h
          </Button>
          <Button
            variant={timeFilter === "7d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter("7d")}
          >
            7d
          </Button>
          <Button
            variant={showOnlyCrypto ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOnlyCrypto(!showOnlyCrypto)}
          >
            {showOnlyCrypto ? "All" : "Crypto Only"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="top" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="top">
            <Trophy className="w-4 h-4 mr-2" />
            Top Donations
          </TabsTrigger>
          <TabsTrigger value="recent">
            <TrendingUp className="w-4 h-4 mr-2" />
            Recent
          </TabsTrigger>
          <TabsTrigger value="proof">
            <FileText className="w-4 h-4 mr-2" />
            Proof Ledger
          </TabsTrigger>
        </TabsList>

        <TabsContent value="top" className="mt-6">
          {topDonations.length === 0 ? (
            <div className="text-center py-12 text-white/40">
              <p>No donations yet. Be the first to support this cause!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topDonations.map((donation, index) => {
                const inrValue = getInrValue(donation);
                const rank = index + 1;
                const rankClass = rank === 1 ? "border-yellow-500/50 bg-yellow-500/10" : 
                                 rank === 2 ? "border-gray-400/50 bg-gray-400/10" : 
                                 rank === 3 ? "border-orange-600/50 bg-orange-600/10" : 
                                 "border-white/10";

                return (
                  <motion.div
                    key={donation.donationId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`border rounded-lg p-4 hover:bg-white/5 transition-colors ${rankClass}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {rank <= 3 && (
                            <span className="text-xl font-bold">#{rank}</span>
                          )}
                          <span className="font-semibold text-lg">{donation.donorLabel}</span>
                          {donation.verifiedOnChain ? (
                            <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/50">
                              ✓ Verified on-chain
                            </Badge>
                          ) : donation.verified ? (
                            <Badge variant="default" className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                              Verified
                            </Badge>
                          ) : null}
                        </div>
                        <div className="text-sm text-white/60 space-y-1">
                          <div>
                            <span className="font-medium">{formatAmount(donation)}</span>
                          </div>
                          <div>
                            <span className="font-semibold">
                              {inrValue > 0 ? `₹${inrValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : pricesLoading ? "Loading price..." : "₹0"}
                            </span>
                            {donation.inrAtConfirm && donation.type === "CRYPTO" && parseFloat(donation.inrAtConfirm) > 0 && (
                              <span className="text-white/40 text-xs ml-2">
                                (₹{parseFloat(donation.inrAtConfirm).toLocaleString("en-IN", { maximumFractionDigits: 2 })} at donation)
                              </span>
                            )}
                          </div>
                          {formatTime(donation.createdAt) && (
                            <div className="text-white/40 text-xs">{formatTime(donation.createdAt)}</div>
                          )}
                        </div>
                      </div>
                      {donation.explorerUrl && donation.txHashMasked && (
                        <a
                          href={donation.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-sm font-medium ml-4 flex items-center gap-1"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Explorer
                          <br />
                          <span className="text-xs text-white/40 font-mono">{donation.txHashMasked}</span>
                        </a>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recent" className="mt-6">
          {recentDonations.length === 0 ? (
            <div className="text-center py-12 text-white/40">
              <p>No recent donations.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {recentDonations.map((donation) => {
                  const inrValue = getInrValue(donation);
                  return (
                    <motion.div
                      key={donation.donationId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="border border-white/10 rounded-lg p-4 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-semibold">{donation.donorLabel}</span>
                            {donation.verifiedOnChain ? (
                              <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/50 text-xs">
                                ✓ Verified on-chain
                              </Badge>
                            ) : donation.verified ? (
                              <Badge variant="default" className="bg-blue-500/20 text-blue-400 border-blue-500/50 text-xs">
                                Verified
                              </Badge>
                            ) : null}
                          </div>
                          <div className="text-sm text-white/60">
                            {donation.type === "INR" 
                              ? `₹${parseFloat(donation.amountNative).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                              : `${donation.amountNative} ${donation.assetSymbol}${inrValue > 0 ? ` (₹${inrValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })} at time of donation)` : ""}`
                            }
                            {formatTime(donation.createdAt) && ` · ${formatTime(donation.createdAt)}`}
                          </div>
                        </div>
                        {donation.explorerUrl && donation.txHashMasked && (
                          <a
                            href={donation.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 ml-4"
                          >
                            <ExternalLink className="w-5 h-5" />
                          </a>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        <TabsContent value="proof" className="mt-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-white/60 text-sm font-medium">Time</th>
                  <th className="text-left py-3 px-4 text-white/60 text-sm font-medium">Donor</th>
                  <th className="text-left py-3 px-4 text-white/60 text-sm font-medium">Asset</th>
                  <th className="text-left py-3 px-4 text-white/60 text-sm font-medium">Amount</th>
                  <th className="text-left py-3 px-4 text-white/60 text-sm font-medium">INR Value</th>
                  {!showOnlyCrypto && (
                    <>
                      <th className="text-left py-3 px-4 text-white/60 text-sm font-medium">Tx Hash</th>
                      <th className="text-left py-3 px-4 text-white/60 text-sm font-medium">Explorer</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredDonations.map((donation) => {
                  const inrValue = getInrValue(donation);
                  return (
                    <tr key={donation.donationId} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 px-4 text-sm">{formatTime(donation.createdAt)}</td>
                      <td className="py-3 px-4 text-sm font-medium">{donation.donorLabel}</td>
                      <td className="py-3 px-4 text-sm">{donation.assetSymbol}</td>
                      <td className="py-3 px-4 text-sm font-mono">
                        {donation.type === "INR" 
                          ? `₹${parseFloat(donation.amountNative).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                          : `${donation.amountNative} ${donation.assetSymbol}${inrValue > 0 ? ` (₹${inrValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })} at time of donation)` : ""}`
                        }
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold">
                        {inrValue > 0 ? `₹${inrValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "₹0"}
                      </td>
                      {donation.type === "CRYPTO" && donation.txHashMasked && donation.explorerUrl && (
                        <>
                          <td className="py-3 px-4 text-sm font-mono text-white/60">{donation.txHashMasked}</td>
                          <td className="py-3 px-4 text-sm">
                            <a
                              href={donation.explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300"
                            >
                              View
                            </a>
                          </td>
                        </>
                      )}
                      {donation.type === "INR" && (
                        <>
                          <td className="py-3 px-4 text-sm text-white/40">-</td>
                          <td className="py-3 px-4 text-sm">
                            <Badge variant="default" className="bg-blue-500/20 text-blue-400 border-blue-500/50 text-xs">
                              Verified
                            </Badge>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
                {/* Total Row */}
                {filteredDonations.length > 0 && (
                  <tr className="border-t-2 border-white/20 bg-white/5 font-bold">
                    <td colSpan={4} className="py-4 px-4 text-sm text-right">
                      Total:
                    </td>
                    <td className="py-4 px-4 text-lg">
                      ₹{filteredDonations.reduce((sum, donation) => {
                        const inrValue = getInrValue(donation);
                        return sum + (inrValue > 0 ? inrValue : 0);
                      }, 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </td>
                    {!showOnlyCrypto && (
                      <td colSpan={2} className="py-4 px-4"></td>
                    )}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function getTimestamp(ts: DonationPublicDoc["createdAt"]): number {
  if (ts?.toMillis) return ts.toMillis();
  if (ts?.toDate) return ts.toDate().getTime();
  if (ts?.seconds) return ts.seconds * 1000;
  if (typeof ts === "number") return ts;
  if (ts instanceof Date) return ts.getTime();
  return Date.now();
}

function getDateFromTimestamp(ts: DonationPublicDoc["createdAt"]): Date | null {
  try {
    if (ts?.toDate) return ts.toDate();
    if (ts?.toMillis) return new Date(ts.toMillis());
    if (ts?.seconds) return new Date(ts.seconds * 1000);
    if (typeof ts === "number") return new Date(ts);
    if (ts instanceof Date) return ts;
    return null;
  } catch {
    return null;
  }
}

