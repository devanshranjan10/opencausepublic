"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CSRDashboard() {
  const router = useRouter();

  // Get current user
  const { data: user, isLoading: userLoading } = useQuery({
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
    retry: 1,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Get all campaigns for CSR team to review
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["csr-campaigns"],
    queryFn: async () => {
      try {
        return await apiRequest<any[]>("/campaigns");
      } catch (error) {
        return [];
      }
    },
  });

  // Get all donations
  const { data: donations } = useQuery({
    queryKey: ["csr-donations"],
    queryFn: async () => {
      try {
        const allDonations = await Promise.all(
          (campaigns || []).map(async (campaign: any) => {
            try {
              return await apiRequest<any[]>(`/donations?campaignId=${campaign.id}`);
            } catch {
              return [];
            }
          })
        );
        return allDonations.flat();
      } catch (error) {
        return [];
      }
    },
    enabled: !!campaigns,
  });

  // CSR-specific metrics
  const totalDonated = donations?.reduce((sum: number, d: any) => sum + parseInt(d.amount || "0"), 0) || 0;
  const verifiedCampaigns = campaigns?.filter((c: any) => c.status === "ACTIVE").length || 0;
  // raisedInr is stored in paise (smallest unit), convert to rupees by dividing by 100
  const totalImpact = campaigns?.reduce((sum: number, c: any) => sum + (parseInt(c.raisedInr || "0") / 100), 0) || 0;
  const pendingCampaigns = campaigns?.filter((c: any) => c.status === "DRAFT").length || 0;
  const completedCampaigns = campaigns?.filter((c: any) => c.status === "COMPLETED").length || 0;
  
  // Get CSR-specific donations (can filter by corporate donors if needed)
  const corporateDonations = donations?.filter((d: any) => d.type === "INR" || d.type === "CRYPTO") || [];
  const avgDonationSize = corporateDonations.length > 0 
    ? Math.round(totalDonated / corporateDonations.length) 
    : 0;

  useEffect(() => {
    if (user && user.role !== "CSR_TEAM") {
      router.push("/dashboard");
    }
  }, [user, router]);

  if (userLoading) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="pt-32 text-center">
          <p className="text-white/60">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "CSR_TEAM") {
    return null;
  }

  return (
    <div className="min-h-screen bg-black">
      <Header />
      <div className="pt-32 pb-20 px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/10">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-5xl md:text-7xl font-bold">
                  CSR Team
                  <br />
                  <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                    Dashboard
                  </span>
                </h1>
                <p className="text-white/60 text-lg mt-2">
                  Corporate Social Responsibility • Impact Tracking • Strategic Giving
                </p>
              </div>
            </div>
          </motion.div>

          {/* CSR-Specific Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-2xl p-6 border border-blue-500/20"
            >
              <div className="text-blue-400 text-sm mb-2 font-medium">Corporate Contributions</div>
              <div className="text-3xl font-bold">₹{totalDonated.toLocaleString()}</div>
              <div className="text-white/40 text-xs mt-2">total CSR funding</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-2xl p-6 border border-green-500/20"
            >
              <div className="text-green-400 text-sm mb-2 font-medium">Active Initiatives</div>
              <div className="text-3xl font-bold">{verifiedCampaigns}</div>
              <div className="text-white/40 text-xs mt-2">verified campaigns</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-2xl p-6 border border-purple-500/20"
            >
              <div className="text-purple-400 text-sm mb-2 font-medium">Total Impact</div>
              <div className="text-3xl font-bold">₹{totalImpact.toLocaleString()}</div>
              <div className="text-white/40 text-xs mt-2">platform-wide raised</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass rounded-2xl p-6 border border-yellow-500/20"
            >
              <div className="text-yellow-400 text-sm mb-2 font-medium">Avg Donation</div>
              <div className="text-3xl font-bold">₹{avgDonationSize.toLocaleString()}</div>
              <div className="text-white/40 text-xs mt-2">per contribution</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="glass rounded-2xl p-6 border border-orange-500/20"
            >
              <div className="text-orange-400 text-sm mb-2 font-medium">Completed</div>
              <div className="text-3xl font-bold">{completedCampaigns}</div>
              <div className="text-white/40 text-xs mt-2">successful campaigns</div>
            </motion.div>
          </div>

          {/* CSR Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-12"
          >
            <h2 className="text-2xl font-bold mb-4">CSR Actions</h2>
            <div className="flex gap-4 flex-wrap">
              <Link href="/campaigns">
                <Button size="lg" className="bg-blue-500 hover:bg-blue-600">
                  Discover Campaigns
                </Button>
              </Link>
              <Link href="/campaigns">
                <Button size="lg" variant="outline" className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10">
                  Impact Analytics
                </Button>
              </Link>
              <Link href="/campaigns">
                <Button size="lg" variant="outline" className="border-green-500/50 text-green-400 hover:bg-green-500/10">
                  Generate CSR Report
                </Button>
              </Link>
              <Link href="/campaigns">
                <Button size="lg" variant="outline" className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10">
                  Track Compliance
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* CSR Impact Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mb-12 glass rounded-2xl p-8 border border-blue-500/20"
          >
            <h2 className="text-3xl font-bold mb-6">CSR Impact Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-white/60 text-sm mb-2">Campaigns Under Review</div>
                <div className="text-2xl font-bold text-yellow-400">{pendingCampaigns}</div>
                <div className="text-white/40 text-xs mt-1">awaiting CSR approval</div>
              </div>
              <div>
                <div className="text-white/60 text-sm mb-2">Success Rate</div>
                <div className="text-2xl font-bold text-green-400">
                  {campaigns && campaigns.length > 0 
                    ? Math.round((completedCampaigns / campaigns.length) * 100) 
                    : 0}%
                </div>
                <div className="text-white/40 text-xs mt-1">completion rate</div>
              </div>
              <div>
                <div className="text-white/60 text-sm mb-2">Platform Engagement</div>
                <div className="text-2xl font-bold text-blue-400">{donations?.length || 0}</div>
                <div className="text-white/40 text-xs mt-1">total contributions</div>
              </div>
            </div>
          </motion.div>

          {/* Featured Campaigns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h2 className="text-3xl font-bold mb-6">Featured Campaigns</h2>
            {isLoading ? (
              <div className="text-center py-20">
                <p className="text-white/60">Loading campaigns...</p>
              </div>
            ) : campaigns && campaigns.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {campaigns.slice(0, 6).map((campaign: any, i: number) => (
                  <motion.div
                    key={campaign.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + i * 0.05 }}
                  >
                    <div className="glass rounded-2xl p-6 hover:bg-white/10 transition-all h-full">
                      <div className="aspect-video bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg mb-4 flex items-center justify-center">
                        {campaign.imageUrl ? (
                          <img
                            src={campaign.imageUrl}
                            alt={campaign.title}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : null}
                      </div>
                      <h3 className="text-xl font-semibold mb-2">{campaign.title}</h3>
                      <p className="text-white/60 mb-4 line-clamp-2 text-sm">{campaign.description}</p>
                      <div className="flex justify-between text-sm mb-4">
                        <div>
                          <div className="text-white/40">Raised</div>
                          <div className="font-semibold">₹{(parseInt(campaign.raisedInr || "0") / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-white/40">Goal</div>
                          <div className="font-semibold">₹{parseInt(campaign.goalInr || "0").toLocaleString()}</div>
                        </div>
                      </div>
                      <Link href={`/campaigns/${campaign.id}`} className="block">
                        <Button variant="outline" className="w-full">
                          View Campaign
                        </Button>
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 glass rounded-2xl">
                <p className="text-white/60 text-lg">No campaigns available.</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

