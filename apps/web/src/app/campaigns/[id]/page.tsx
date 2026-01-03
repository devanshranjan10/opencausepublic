"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { DonateModal } from "@/components/campaigns/donate-modal";
import { CampaignDonationsPanel } from "@/components/campaigns/campaign-donations-panel";
import { TransparencyPanel } from "@/components/campaigns/transparency-panel";
import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import { usePrices, computeInrValue } from "@/hooks/usePrices";

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [donateOpen, setDonateOpen] = useState(false);
  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return null;
        return await apiRequest<any>("/users/me");
      } catch (error) {
        return null;
      }
    },
    retry: false,
  });

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["campaign", params.id],
    queryFn: async () => {
      try {
        return await apiRequest<any>(`/campaigns/${params.id}`);
      } catch (error) {
        console.error("Failed to fetch campaign:", error);
        return null;
      }
    },
    enabled: !!params.id,
  });

  // Fetch public donations - MUST be called before any early returns (Rules of Hooks)
  const { data: donations = [], isLoading: donationsLoading } = useQuery({
    queryKey: ["campaign-donations", params.id],
    queryFn: async () => {
      try {
        return await apiRequest<any[]>(`/crypto/campaigns/${params.id}/donations-public`);
      } catch (error) {
        console.error("Failed to fetch donations:", error);
        // Return cached donations from localStorage as fallback
        try {
          const cached = localStorage.getItem(`donations-${params.id}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            console.log("[Campaign] Using cached donations as fallback");
            return parsed;
          }
        } catch (e) {
          console.error("Failed to parse cached donations:", e);
        }
        return [];
      }
    },
    enabled: !!params.id && !!campaign, // Only fetch if campaign exists
    refetchInterval: 30000, // Refetch every 30 seconds for live updates (reduced to avoid throttling)
    onSuccess: (data) => {
      // Cache successful donations response
      if (data && params.id) {
        try {
          localStorage.setItem(`donations-${params.id}`, JSON.stringify(data));
        } catch (e) {
          console.warn("Failed to cache donations:", e);
        }
      }
    },
  });

  // Get unique symbols for price fetching
  const symbols = useMemo(() => {
    const unique = new Set<string>(["INR"]);
    donations.forEach((d: any) => {
      if (d.assetSymbol && d.assetSymbol !== "INR") {
        unique.add(d.assetSymbol);
      }
    });
    return Array.from(unique);
  }, [donations]);

  // Fetch prices for calculating INR values with fallback
  const { data: pricesData, isLoading: pricesLoading } = usePrices(symbols);
  const prices = pricesData?.prices || {};
  
  // Fallback prices (last known good values, updated periodically)
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

  // Calculate total raised from actual donations using stored inrAtConfirm values (NOT live prices)
  const totalRaisedFromDonations = useMemo(() => {
    if (!donations || donations.length === 0) {
      // If no donations loaded, try to use cached total
      try {
        const cachedTotal = localStorage.getItem(`campaign-total-${params.id}`);
        if (cachedTotal) {
          const parsed = parseFloat(cachedTotal);
          if (!isNaN(parsed) && parsed > 0) {
            console.log("[Campaign] Using cached total as fallback:", parsed);
            return parsed;
          }
        }
      } catch (e) {
        console.warn("Failed to read cached total:", e);
      }
      return 0;
    }
    
    // ALWAYS use stored inrAtConfirm value - never calculate from live prices
    const total = donations.reduce((sum: number, donation: any) => {
      if (!donation.verified) return sum;
      
      if (donation.type === "INR") {
        // INR donations: use amountNative directly
        return sum + parseFloat(donation.amountNative || "0");
      }
      
      // For crypto donations: ALWAYS use inrAtConfirm (stored at donation time)
      if (donation.inrAtConfirm && parseFloat(donation.inrAtConfirm) > 0) {
        const storedInr = parseFloat(donation.inrAtConfirm);
        return sum + storedInr;
      }
      
      // If inrAtConfirm is missing, log warning but don't add to total
      // (This should not happen for verified donations)
      console.warn(`[Campaign] Missing inrAtConfirm for donation ${donation.donationId}, skipping from total`);
      return sum;
    }, 0);
    
    // Cache the calculated total
    if (total > 0 && params.id) {
      try {
        localStorage.setItem(`campaign-total-${params.id}`, total.toString());
      } catch (e) {
        console.warn("Failed to cache total:", e);
      }
    }
    
    return total;
  }, [donations, params.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="pt-32 text-center">
          <p className="text-white/60">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="pt-32 text-center">
          <p className="text-white/60 mb-4">Campaign not found</p>
          <Button onClick={() => router.push("/campaigns")}>Back to Campaigns</Button>
        </div>
      </div>
    );
  }

  // Only show ACTIVE campaigns to public, but allow organizers to see their own campaigns
  const isOrganizer = user && (user.role === "INDIVIDUAL_ORGANIZER" || user.role === "NGO_ORGANIZER");
  const isOwnCampaign = isOrganizer && campaign.organizerId === user.id;
  const isAdminOrReviewer = user && (user.role === "ADMIN" || user.role === "REVIEWER");

  if (campaign.status !== "ACTIVE" && !isOwnCampaign && !isAdminOrReviewer) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="pt-32 text-center">
          <p className="text-white/60 mb-4">This campaign is not currently active.</p>
          <p className="text-white/40 text-sm mb-6">Status: {campaign.status}</p>
          <Button onClick={() => router.push("/campaigns")}>Back to Campaigns</Button>
        </div>
      </div>
    );
  }

  // Use calculated total from donations, fallback to campaign.raisedInr (in paise) if no donations
  const raisedInrRupees = totalRaisedFromDonations > 0 
    ? totalRaisedFromDonations 
    : (parseInt(campaign.raisedInr || "0") / 100);
  // goalInr is stored in rupees (user input), so don't divide by 100
  const goalInrRupees = parseFloat(campaign.goalInr || "1");
  const progress = Math.min(
    (raisedInrRupees / goalInrRupees) * 100,
    100
  );

  const goalMet = progress >= 100;

  return (
    <div className="min-h-screen bg-black">
      <Header />
      <div className="pt-32 pb-20 px-6 lg:px-8">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <button
              onClick={() => router.back()}
              className="text-white/60 hover:text-white mb-6 transition-colors"
            >
              ← Back
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-2xl p-8 md:p-12 mb-8"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-4">{campaign.title}</h1>
            <p className="text-xl text-white/60 mb-8 leading-relaxed">{campaign.description}</p>

            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="glass rounded-lg p-6">
                <p className="text-white/40 mb-2">Raised</p>
                <p className="text-3xl font-bold">
                  ₹{raisedInrRupees.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  {donationsLoading && (
                    <span className="text-sm text-white/40 ml-2">(updating...)</span>
                  )}
                </p>
              </div>
              <div className="glass rounded-lg p-6">
                <p className="text-white/40 mb-2">Goal</p>
                <p className="text-3xl font-bold">₹{goalInrRupees.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/60">Progress</span>
                <span className="text-white/60">{progress.toFixed(1)}%</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {campaign.status === "ACTIVE" && !goalMet ? (
              <Button
                size="lg"
                onClick={() => setDonateOpen(true)}
                className="w-full sm:w-auto"
              >
                Donate Now
              </Button>
            ) : goalMet ? (
              <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
                <p className="text-green-400 text-sm font-semibold">
                  🎉 Goal Met! Thank you to all donors.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                <p className="text-yellow-400 text-sm">
                  {campaign.status === "PENDING_REVIEW" 
                    ? "⏳ This campaign is pending review. Donations will be enabled once approved."
                    : `This campaign is ${campaign.status}. Donations are not available.`}
                </p>
              </div>
            )}
          </motion.div>

          {/* Milestones */}
          {campaign.milestones && campaign.milestones.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-2xl p-8 mb-8"
            >
              <h2 className="text-3xl font-bold mb-6">Milestones</h2>
              <div className="space-y-4">
                {campaign.milestones.map((milestone: any, i: number) => (
                  <div
                    key={milestone.id || i}
                    className="border border-white/10 rounded-lg p-6 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-semibold">{milestone.name}</h3>
                      <span className="text-sm text-white/40 px-3 py-1 bg-white/5 rounded-full">
                        {milestone.status}
                      </span>
                    </div>
                    {milestone.description && (
                      <p className="text-white/60 mb-4">{milestone.description}</p>
                    )}
                    <div className="flex justify-between text-sm">
                      <div>
                        <span className="text-white/40">Cap: </span>
                        <span className="font-semibold">₹{parseInt(milestone.capAmount || "0").toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-white/40">Released: </span>
                        <span className="font-semibold">
                          ₹{parseInt(milestone.releasedAmount || "0").toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Transparency Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mb-8"
          >
            <TransparencyPanel campaignId={campaign.id} />
          </motion.div>

          {/* Donations Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <CampaignDonationsPanel
              campaignId={campaign.id}
              goalInr={campaign.goalInr}
              totalRaisedInr={campaign.raisedInr}
            />
          </motion.div>

          {/* Proofs Link */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-center"
          >
            <Button
              variant="outline"
              onClick={() => router.push(`/campaigns/${params.id}/proofs`)}
            >
              View Proof Ledger
            </Button>
          </motion.div>
        </div>
      </div>
      <Footer />
      <DonateModal
        isOpen={donateOpen}
        onClose={() => setDonateOpen(false)}
        campaign={campaign}
      />
    </div>
  );
}

