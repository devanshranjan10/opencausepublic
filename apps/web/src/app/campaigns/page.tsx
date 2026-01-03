"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { usePrices } from "@/hooks/usePrices";

export default function CampaignsPage() {
  const { data: campaigns, isLoading, error } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      try {
        // Only fetch ACTIVE campaigns for public display
        const data = await apiRequest<any[]>("/campaigns?status=ACTIVE");
        console.log("Fetched campaigns:", data);
        return data || [];
      } catch (error: any) {
        console.error("Failed to fetch campaigns:", error);
        // Return empty array on error but log it
        return [];
      }
    },
    retry: 2,
    staleTime: 30000,
  });

  // Fetch donations for all campaigns to calculate accurate totals
  const { data: allDonations } = useQuery({
    queryKey: ["all-campaigns-donations", campaigns?.map(c => c.id)],
    queryFn: async () => {
      if (!campaigns || campaigns.length === 0) return {};
      const donationsMap: Record<string, any[]> = {};
      await Promise.all(
        campaigns.map(async (campaign: any) => {
          try {
            const donations = await apiRequest<any[]>(`/crypto/campaigns/${campaign.id}/donations-public`);
            donationsMap[campaign.id] = donations || [];
          } catch (error) {
            donationsMap[campaign.id] = [];
          }
        })
      );
      return donationsMap;
    },
    enabled: !!campaigns && campaigns.length > 0,
    staleTime: 30000,
  });

  // Get unique symbols for price fetching
  const symbols = useMemo(() => {
    const unique = new Set<string>(["INR"]);
    if (allDonations) {
      Object.values(allDonations).flat().forEach((d: any) => {
        if (d.assetSymbol && d.assetSymbol !== "INR") {
          unique.add(d.assetSymbol);
        }
      });
    }
    return Array.from(unique);
  }, [allDonations]);

  // Fetch prices
  const { data: pricesData } = usePrices(symbols);
  const prices = pricesData?.prices || {};

  // Calculate raised amounts from donations for each campaign using stored inrAtConfirm values ONLY
  const campaignTotals = useMemo(() => {
    if (!allDonations || !campaigns) return {};
    const totals: Record<string, number> = {};
    campaigns.forEach((campaign: any) => {
      const donations = allDonations[campaign.id] || [];
      totals[campaign.id] = donations.reduce((sum: number, donation: any) => {
        if (!donation.verified) return sum;
        
        if (donation.type === "INR") {
          // INR donations: use amountNative directly
          return sum + parseFloat(donation.amountNative || "0");
        }
        
        // For crypto donations: ALWAYS use inrAtConfirm (stored at donation time)
        if (donation.inrAtConfirm && parseFloat(donation.inrAtConfirm) > 0) {
          return sum + parseFloat(donation.inrAtConfirm);
        }
        
        // If inrAtConfirm is missing, skip (shouldn't happen for verified donations)
        return sum;
      }, 0);
    });
    return totals;
  }, [allDonations, campaigns]);

  return (
    <div className="min-h-screen bg-black">
      <Header />
      <div className="pt-32 pb-20 px-6 lg:px-8">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <h1 className="text-5xl md:text-7xl font-bold mb-4">All Campaigns</h1>
            <p className="text-xl text-white/60">Discover causes making a real impact</p>
          </motion.div>

          {isLoading ? (
            <div className="text-center py-20">
              <p className="text-white/60">Loading campaigns...</p>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-red-400 mb-4">Error loading campaigns. Please try again.</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
          ) : campaigns && campaigns.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {campaigns.map((campaign: any, i: number) => (
                <motion.div
                  key={campaign.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link href={`/campaigns/${campaign.id}`}>
                    <div className="glass rounded-2xl p-6 hover:bg-white/10 transition-all h-full group cursor-pointer">
                      <div className="aspect-video bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg mb-4 flex items-center justify-center">
                        {campaign.imageUrl ? (
                          <img
                            src={campaign.imageUrl}
                            alt={campaign.title}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <div className="text-4xl">🎯</div>
                        )}
                      </div>
                      <h3 className="text-xl font-semibold mb-2 group-hover:text-white transition-colors">
                        {campaign.title}
                      </h3>
                      <p className="text-white/60 mb-4 line-clamp-2 text-sm">
                        {campaign.description}
                      </p>
                      <div className="flex justify-between text-sm mb-3">
                        <div>
                          <div className="text-white/40">Raised</div>
                          <div className="font-semibold">
                            ₹{(campaignTotals[campaign.id] || (parseInt(campaign.raisedInr || "0") / 100)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-white/40">Goal</div>
                          <div className="font-semibold">
                            ₹{parseFloat(campaign.goalInr || "0").toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              ((campaignTotals[campaign.id] || (parseInt(campaign.raisedInr || "0") / 100)) / parseFloat(campaign.goalInr || "1")) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-white/60 text-lg mb-4">No campaigns found.</p>
              <Link href="/auth/signup">
                <button className="px-6 py-3 bg-white text-black rounded-lg hover:bg-white/90 transition-colors">
                  Create First Campaign
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

