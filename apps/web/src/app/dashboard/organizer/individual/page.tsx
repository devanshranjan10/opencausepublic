"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { getKYCStatus } from "@/lib/kyc/api";

export default function IndividualOrganizerDashboard() {
  const router = useRouter();
  const [showKYCModal, setShowKYCModal] = useState(false);

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

  // Get donations to campaigns
  const { data: donations } = useQuery({
    queryKey: ["my-donations", user?.id],
    queryFn: async () => {
      try {
        if (!user?.id) return [];
        const allCampaigns = campaigns || [];
        const allDonations = await Promise.all(
          allCampaigns.map(async (campaign: any) => {
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
    enabled: !!user?.id && !!campaigns,
  });

  // Get KYC status
  const { data: kycStatus, refetch: refetchKYCStatus } = useQuery({
    queryKey: ["kyc-status", user?.id],
    queryFn: async () => {
      try {
        if (!user?.id) return null;
        return await getKYCStatus();
      } catch (error) {
        return { status: "NOT_STARTED" };
      }
    },
    enabled: !!user?.id && user?.role === "INDIVIDUAL_ORGANIZER",
    refetchInterval: 10000, // Refetch every 10 seconds to update status
  });

  const isKYCVerified = kycStatus?.status === "VERIFIED" || kycStatus?.status === "APPROVED";
  const kycStatusBadge = isKYCVerified ? (
    <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
      <CheckCircle2 className="w-3 h-3 mr-1" />
      KYC Verified
    </Badge>
  ) : kycStatus?.status === "PENDING" ? (
    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
      <Clock className="w-3 h-3 mr-1" />
      KYC Pending
    </Badge>
  ) : kycStatus?.status === "IN_REVIEW" || kycStatus?.status === "UNDER_REVIEW" ? (
    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">
      <Clock className="w-3 h-3 mr-1" />
      Under Review
    </Badge>
  ) : kycStatus?.status === "REJECTED" ? (
    <Badge className="bg-red-500/20 text-red-400 border-red-500/50">
      <XCircle className="w-3 h-3 mr-1" />
      KYC Rejected
    </Badge>
  ) : (
    <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">
      <AlertCircle className="w-3 h-3 mr-1" />
      KYC Not Started
    </Badge>
  );

  // Get KYC banner message based on status
  const getKYCBannerMessage = () => {
    const status = kycStatus?.status || "NOT_STARTED";
    switch (status) {
      case "NOT_STARTED":
        return "KYC Verification Required: Complete KYC verification to create campaigns.";
      case "PENDING":
        return "KYC Verification Pending: Your KYC submission is being reviewed. Please wait for a response.";
      case "IN_REVIEW":
      case "UNDER_REVIEW":
        return "KYC Under Review: Your KYC is currently being reviewed by our team. You'll be notified once a decision is made.";
      case "REJECTED":
        return "KYC Verification Rejected: Your KYC submission was rejected. Please review the feedback and resubmit.";
      case "APPROVED":
      case "VERIFIED":
        return null; // Don't show banner if verified
      default:
        return "KYC Verification Required: Complete KYC verification to create campaigns.";
    }
  };

  const kycBannerMessage = getKYCBannerMessage();
  const canSubmitKYC = !kycStatus?.status || kycStatus?.status === "NOT_STARTED" || kycStatus?.status === "REJECTED";

  useEffect(() => {
    if (user && user.role !== "INDIVIDUAL_ORGANIZER") {
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
              Individual
              <br />
              <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                Organizer Dashboard
              </span>
            </h1>
            <p className="text-white/60 text-lg mt-4">
              Manage your personal campaigns and track your impact
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
              <div className="text-white/60 text-sm mb-2">Total Raised</div>
              <div className="text-3xl font-bold">₹{totalRaised.toLocaleString()}</div>
              <div className="text-white/40 text-xs mt-2">of ₹{totalGoal.toLocaleString()} goal</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-2xl p-6"
            >
              <div className="text-white/60 text-sm mb-2">Active Campaigns</div>
              <div className="text-3xl font-bold">{activeCampaigns}</div>
              <div className="text-white/40 text-xs mt-2">out of {campaigns?.length || 0} total</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-2xl p-6"
            >
              <div className="text-white/60 text-sm mb-2">Total Donations</div>
              <div className="text-3xl font-bold">{donations?.length || 0}</div>
              <div className="text-white/40 text-xs mt-2">across all campaigns</div>
            </motion.div>
          </div>

          {/* KYC Status Alert (Individual Organizers Only) */}
          {!isKYCVerified && kycBannerMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mb-6"
            >
              <Alert className={
                kycStatus?.status === "REJECTED" 
                  ? "border-red-500/50 bg-red-500/10"
                  : kycStatus?.status === "IN_REVIEW" || kycStatus?.status === "UNDER_REVIEW"
                  ? "border-blue-500/50 bg-blue-500/10"
                  : kycStatus?.status === "PENDING"
                  ? "border-yellow-500/50 bg-yellow-500/10"
                  : "border-yellow-500/50 bg-yellow-500/10"
              }>
                <AlertCircle className={
                  kycStatus?.status === "REJECTED"
                    ? "h-4 w-4 text-red-400"
                    : kycStatus?.status === "IN_REVIEW" || kycStatus?.status === "UNDER_REVIEW"
                    ? "h-4 w-4 text-blue-400"
                    : "h-4 w-4 text-yellow-400"
                } />
                <AlertDescription className={
                  kycStatus?.status === "REJECTED"
                    ? "text-red-400"
                    : kycStatus?.status === "IN_REVIEW" || kycStatus?.status === "UNDER_REVIEW"
                    ? "text-blue-400"
                    : "text-yellow-400"
                }>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <strong>{kycBannerMessage}</strong>
                    </div>
                    {canSubmitKYC && (
                      <Link href="/dashboard/kyc" className="inline-block">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className={
                            kycStatus?.status === "REJECTED"
                              ? "bg-red-500/20 hover:bg-red-500/30 border-red-500/50 text-red-400 hover:text-red-300 cursor-pointer"
                              : "bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/50 text-yellow-400 hover:text-yellow-300 cursor-pointer"
                          }
                        >
                          {kycStatus?.status === "REJECTED" ? "Resubmit KYC" : "Verify KYC"}
                        </Button>
                      </Link>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            </motion.div>
          )}

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-12 flex gap-4 flex-wrap items-center"
          >
            <div className="flex items-center gap-4">
              <Button 
                size="lg" 
                disabled={!isKYCVerified} 
                title={!isKYCVerified ? "Complete KYC to create campaigns" : ""}
                onClick={() => {
                  if (isKYCVerified) {
                    router.push("/dashboard/organizer/campaigns/new");
                  } else {
                    setShowKYCModal(true);
                  }
                }}
              >
                Create New Campaign
              </Button>
              {kycStatusBadge}
            </div>
            <Link href="/dashboard/organizer/campaigns">
              <Button size="lg" variant="outline">Manage All Campaigns</Button>
            </Link>
          </motion.div>

          {/* Recent Campaigns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h2 className="text-3xl font-bold mb-6">Your Campaigns</h2>
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
                    transition={{ delay: 0.6 + i * 0.05 }}
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

      {/* KYC Modal */}
      <Dialog open={showKYCModal} onOpenChange={setShowKYCModal}>
        <DialogContent className="max-w-md p-8 bg-black border border-white/10 rounded-2xl">
          <DialogHeader>
            {kycStatus?.status === "PENDING" || kycStatus?.status === "IN_REVIEW" || kycStatus?.status === "UNDER_REVIEW" ? (
              <div className="text-center">
                <Clock className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                <DialogTitle className="text-3xl font-bold mb-2">KYC Under Review</DialogTitle>
                <DialogDescription className="text-white/60 mb-6">
                  Your KYC submission is currently being reviewed by our team. You will be notified once a decision has been made.
                  You cannot create campaigns until your KYC is approved.
                </DialogDescription>
                <Button onClick={() => setShowKYCModal(false)}>Close</Button>
              </div>
            ) : kycStatus?.status === "REJECTED" ? (
              <div className="text-center">
                <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <DialogTitle className="text-3xl font-bold mb-2">KYC Rejected</DialogTitle>
                <DialogDescription className="text-white/60 mb-6">
                  Unfortunately, your KYC submission was rejected. Please review the feedback and resubmit your application.
                  You cannot create campaigns until your KYC is approved.
                </DialogDescription>
                <Link href="/dashboard/kyc">
                  <Button size="lg" className="w-full">Go to KYC Page</Button>
                </Link>
              </div>
            ) : (
              <div className="text-center">
                <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                <DialogTitle className="text-3xl font-bold mb-2">KYC Verification Required</DialogTitle>
                <DialogDescription className="text-white/60 mb-6">
                  To create a new campaign, you must first complete your KYC (Know Your Customer) verification.
                </DialogDescription>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowKYCModal(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Link href="/dashboard/kyc" className="flex-1">
                    <Button size="lg" className="w-full">Complete KYC Now</Button>
                  </Link>
                </div>
              </div>
            )}
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

