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

export default function DonorDashboard() {
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

  // Get user's donations
  const { data: donations, isLoading } = useQuery({
    queryKey: ["my-donations", user?.id],
    queryFn: async () => {
      try {
        if (!user?.id) return [];
        return await apiRequest<any[]>(`/donations?donorId=${user.id}`);
      } catch (error) {
        return [];
      }
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (user && user.role !== "DONOR") {
      router.push("/dashboard");
    }
  }, [user, router]);

  const totalDonated = donations?.reduce((sum: number, d: any) => 
    sum + parseInt(d.amount || "0"), 0) || 0;
  const uniqueCampaigns = new Set(donations?.map((d: any) => d.campaignId)).size;
  const recentDonations = donations?.slice(0, 5) || [];

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
            <h1 className="text-5xl md:text-7xl font-bold mb-4">
              Donor
              <br />
              <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                Dashboard
              </span>
            </h1>
            <p className="text-white/60 text-lg mt-4">
              Track your donations and see the impact you're making
            </p>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-2xl p-6"
            >
              <div className="text-white/60 text-sm mb-2">Total Donated</div>
              <div className="text-3xl font-bold">₹{totalDonated.toLocaleString()}</div>
              <div className="text-white/40 text-xs mt-2">lifetime contributions</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-2xl p-6"
            >
              <div className="text-white/60 text-sm mb-2">Campaigns Supported</div>
              <div className="text-3xl font-bold">{uniqueCampaigns}</div>
              <div className="text-white/40 text-xs mt-2">unique causes</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-2xl p-6"
            >
              <div className="text-white/60 text-sm mb-2">Total Donations</div>
              <div className="text-3xl font-bold">{donations?.length || 0}</div>
              <div className="text-white/40 text-xs mt-2">all contributions</div>
            </motion.div>
          </div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-12 flex gap-4 flex-wrap"
          >
            <Link href="/campaigns">
              <Button size="lg">Discover Campaigns</Button>
            </Link>
            <Link href="/campaigns">
              <Button size="lg" variant="outline">View Impact Reports</Button>
            </Link>
          </motion.div>

          {/* Recent Donations */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h2 className="text-3xl font-bold mb-6">Your Donations</h2>
            {isLoading ? (
              <div className="text-center py-20">
                <p className="text-white/60">Loading donations...</p>
              </div>
            ) : donations && donations.length > 0 ? (
              <div className="space-y-4">
                {recentDonations.map((donation: any, i: number) => (
                  <motion.div
                    key={donation.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + i * 0.05 }}
                    className="glass rounded-2xl p-6 hover:bg-white/10 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="text-sm text-white/60 mb-2">
                          {new Date(donation.createdAt || Date.now()).toLocaleDateString()}
                        </div>
                        <div className="text-lg font-semibold mb-2">
                          {donation.campaign?.title || `Campaign ${donation.campaignId?.slice(0, 8)}`}
                        </div>
                        <div className="flex gap-6 text-sm">
                          <div>
                            <div className="text-white/60">Amount</div>
                            <div className="font-semibold">₹{parseInt(donation.amount || "0").toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-white/60">Type</div>
                            <div className="font-semibold">{donation.type || "INR"}</div>
                          </div>
                        </div>
                      </div>
                      {donation.campaignId && (
                        <Link href={`/campaigns/${donation.campaignId}`}>
                          <Button variant="outline" size="sm">
                            View Campaign
                          </Button>
                        </Link>
                      )}
                    </div>
                  </motion.div>
                ))}
                {donations.length > 5 && (
                  <div className="text-center pt-4">
                    <Link href="/campaigns">
                      <Button variant="outline">View All Donations</Button>
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-20 glass rounded-2xl">
                <p className="text-white/60 text-lg mb-4">No donations yet.</p>
                <Link href="/campaigns">
                  <Button size="lg">Start Donating</Button>
                </Link>
              </div>
            )}
          </motion.div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
