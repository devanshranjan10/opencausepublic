"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";

export default function OrganizerCampaignDetailPage() {
  const params = useParams();
  const router = useRouter();

  const { data: campaign } = useQuery({
    queryKey: ["campaign", params.id],
    queryFn: async () => {
      try {
        return await apiRequest<any>(`/campaigns/${params.id}`);
      } catch (error) {
        return null;
      }
    },
  });

  if (!campaign) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="pt-32 text-center">
          <p className="text-white/60">Loading campaign...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Header />
      <div className="pt-32 pb-20 px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
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
            <h1 className="text-4xl md:text-6xl font-bold mb-4">{campaign.title}</h1>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-2xl p-8"
            >
              <h2 className="text-2xl font-bold mb-6">Campaign Stats</h2>
              <div className="space-y-4">
                <div>
                  <div className="text-white/40 text-sm mb-1">Raised</div>
                  <div className="text-3xl font-bold">₹{(parseInt(campaign.raisedInr || "0") / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
                </div>
                <div>
                  <div className="text-white/40 text-sm mb-1">Goal</div>
                  <div className="text-3xl font-bold">₹{parseInt(campaign.goalInr || "0").toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-white/40 text-sm mb-1">Status</div>
                  <div className="text-xl font-semibold">{campaign.status}</div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-2xl p-8"
            >
              <h2 className="text-2xl font-bold mb-6">Actions</h2>
              <div className="space-y-4">
                <Link href={`/dashboard/organizer/campaigns/${params.id}/withdraw`}>
                  <Button className="w-full" size="lg">
                    Request Withdrawal
                  </Button>
                </Link>
                <Link href={`/campaigns/${params.id}`}>
                  <Button variant="outline" className="w-full" size="lg">
                    View Public Page
                  </Button>
                </Link>
                <Link href={`/campaigns/${params.id}/proofs`}>
                  <Button variant="outline" className="w-full" size="lg">
                    View Proof Ledger
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>

          {campaign.milestones && campaign.milestones.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-2xl p-8"
            >
              <h2 className="text-2xl font-bold mb-6">Milestones</h2>
              <div className="space-y-4">
                {campaign.milestones.map((milestone: any) => (
                  <div
                    key={milestone.id}
                    className="border border-white/10 rounded-lg p-6 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-semibold">{milestone.name}</h3>
                      <span className="text-sm text-white/40 px-3 py-1 bg-white/5 rounded-full">
                        {milestone.status}
                      </span>
                    </div>
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
        </div>
      </div>
      <Footer />
    </div>
  );
}

