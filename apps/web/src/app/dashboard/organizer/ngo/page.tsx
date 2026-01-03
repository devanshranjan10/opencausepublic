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

export default function NGOOrganizerDashboard() {
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

  // Get campaigns filtered by organizer
  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ["my-campaigns", user?.id],
    queryFn: async () => {
      try {
        if (!user?.id) return [];
        return await apiRequest<any[]>(`/campaigns?organizerId=${user.id}`);
      } catch (error) {
        return [];
      }
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (user && user.role !== "NGO_ORGANIZER") {
      router.push("/dashboard");
    }
  }, [user, router]);

  // raisedInr is stored in paise (smallest unit), convert to rupees by dividing by 100
  const totalRaised = campaigns?.reduce((sum: number, c: any) => sum + (parseInt(c.raisedInr || "0") / 100), 0) || 0;
  const totalGoal = campaigns?.reduce((sum: number, c: any) => sum + parseInt(c.goalInr || "0"), 0) || 0;
  const activeCampaigns = campaigns?.filter((c: any) => c.status === "ACTIVE").length || 0;

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
              NGO
              <br />
              <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                Organizer Dashboard
              </span>
            </h1>
            <p className="text-white/60 text-lg mt-4">
              Manage your organization's campaigns, track impact, and maintain transparency
            </p>
            {user?.kycStatus === "VERIFIED" && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg">
                <span className="text-green-400 text-sm font-medium">✓ Verified NGO</span>
              </div>
            )}
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-2xl p-6"
            >
              <div className="text-white/60 text-sm mb-2">Total Raised</div>
              <div className="text-3xl font-bold">₹{totalRaised.toLocaleString()}</div>
              <div className="text-white/40 text-xs mt-2">across all campaigns</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-2xl p-6"
            >
              <div className="text-white/60 text-sm mb-2">Active Campaigns</div>
              <div className="text-3xl font-bold">{activeCampaigns}</div>
              <div className="text-white/40 text-xs mt-2">currently running</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-2xl p-6"
            >
              <div className="text-white/60 text-sm mb-2">Total Campaigns</div>
              <div className="text-3xl font-bold">{campaigns?.length || 0}</div>
              <div className="text-white/40 text-xs mt-2">all time</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass rounded-2xl p-6"
            >
              <div className="text-white/60 text-sm mb-2">Completion Rate</div>
              <div className="text-3xl font-bold">
                {totalGoal > 0 ? Math.round((totalRaised / totalGoal) * 100) : 0}%
              </div>
              <div className="text-white/40 text-xs mt-2">of funding goals</div>
            </motion.div>
          </div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-12 flex gap-4 flex-wrap"
          >
            <Link href="/dashboard/organizer/campaigns/new">
              <Button size="lg">Create New Campaign</Button>
            </Link>
            <Link href="/dashboard/organizer/campaigns">
              <Button size="lg" variant="outline">Manage All Campaigns</Button>
            </Link>
            <Link href="/dashboard/organizer/campaigns">
              <Button size="lg" variant="outline">View Reports</Button>
            </Link>
          </motion.div>

          {/* Recent Campaigns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h2 className="text-3xl font-bold mb-6">Your Organization's Campaigns</h2>
            {campaignsLoading ? (
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
                      <div className="flex gap-2">
                        <Link href={`/dashboard/organizer/campaigns/${campaign.id}`} className="flex-1">
                          <Button variant="outline" className="w-full">
                            Manage
                          </Button>
                        </Link>
                        <Link href={`/campaigns/${campaign.id}`}>
                          <Button variant="outline">View</Button>
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 glass rounded-2xl">
                <p className="text-white/60 text-lg mb-4">No campaigns yet.</p>
                <Link href="/dashboard/organizer/campaigns/new">
                  <Button size="lg">Create Your First Campaign</Button>
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

