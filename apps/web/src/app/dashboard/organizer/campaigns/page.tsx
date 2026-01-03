"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function OrganizerCampaignsPage() {
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
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["my-campaigns", user?.id],
    queryFn: async () => {
      try {
        if (!user?.id) return [];
        // Get all campaigns for this organizer (including pending review)
        return await apiRequest<any[]>(`/campaigns?organizerId=${user.id}&includeAll=true`);
      } catch (error) {
        return [];
      }
    },
    enabled: !!user?.id,
  });

  const myCampaigns = campaigns || [];

  return (
    <div className="min-h-screen bg-black">
      <Header />
      <div className="pt-32 pb-20 px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 flex justify-between items-center"
          >
            <div>
              <h1 className="text-5xl md:text-7xl font-bold mb-4">
                My
                <br />
                <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                  Campaigns
                </span>
              </h1>
            </div>
            {/* Note: KYC check happens on backend, button disabled state can be added here if needed */}
            <Link href="/dashboard/organizer/campaigns/new">
              <Button size="lg">Create Campaign</Button>
            </Link>
          </motion.div>

          {isLoading ? (
            <div className="text-center py-20">
              <p className="text-white/60">Loading campaigns...</p>
            </div>
          ) : myCampaigns.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myCampaigns.map((campaign: any, i: number) => (
                <motion.div
                  key={campaign.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
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
                    <div className="mb-3">
                      <span className={`text-xs px-3 py-1 rounded-full ${
                        campaign.status === "ACTIVE" 
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : campaign.status === "PENDING_REVIEW"
                          ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                          : campaign.status === "REJECTED"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-white/10 text-white/60 border border-white/20"
                      }`}>
                        {campaign.status === "PENDING_REVIEW" ? "⏳ Pending Review" : campaign.status}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/dashboard/organizer/campaigns/${campaign.id}`} className="flex-1">
                        <Button variant="outline" className="w-full">
                          Manage
                        </Button>
                      </Link>
                      {campaign.status === "ACTIVE" && (
                        <Link href={`/campaigns/${campaign.id}`}>
                          <Button variant="outline">View</Button>
                        </Link>
                      )}
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
        </div>
      </div>
      <Footer />
    </div>
  );
}

