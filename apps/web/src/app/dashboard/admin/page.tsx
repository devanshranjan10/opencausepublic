"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { getKYCStats } from "@/lib/kyc/api";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FileCheck } from "lucide-react";

// Component to handle proof file links
function ProofLink({ proofId, index }: { proofId: string; index: number }) {
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProofUrl = async () => {
      try {
        const result = await apiRequest<{ url: string }>(`/proofs/${proofId}/url`);
        setProofUrl(result.url);
        setError(null);
      } catch (error: any) {
        console.error("Failed to fetch proof URL:", error);
        setError(error?.message || "Failed to load proof");
      } finally {
        setLoading(false);
      }
    };
    fetchProofUrl();
  }, [proofId]);

  if (loading) {
    return (
      <div className="inline-flex items-center px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg">
        <span>Loading...</span>
      </div>
    );
  }

  if (!proofUrl) {
    return (
      <div className="inline-flex items-center px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg text-white/40" title={error || "Proof unavailable"}>
        <span>Proof {index + 1} ({error ? "error" : "unavailable"})</span>
      </div>
    );
  }

  return (
    <a
      href={proofUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
    >
      <span>Proof {index + 1}</span>
      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    category: "",
    goalInr: "",
    status: "",
  });

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

  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: async () => {
      try {
        // Get all campaigns including pending review
        return await apiRequest<any[]>("/campaigns?includeAll=true");
      } catch (error) {
        console.error("Failed to fetch campaigns:", error);
        return [];
      }
    },
    refetchOnMount: true,
  });

  const { data: pendingCampaigns } = useQuery({
    queryKey: ["pending-campaigns"],
    queryFn: async () => {
      try {
        const allCampaigns = await apiRequest<any[]>("/campaigns?includeAll=true");
        return allCampaigns.filter((c: any) => c.status === "PENDING_REVIEW");
      } catch (error) {
        return [];
      }
    },
    enabled: !!campaigns,
  });

  const { data: donations } = useQuery({
    queryKey: ["admin-donations"],
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

  const { data: withdrawals } = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => {
      try {
        return await apiRequest<any[]>(`/admin/review/withdrawals?status=PENDING`);
      } catch (error) {
        console.error("Failed to fetch withdrawal review queue:", error);
        return [];
      }
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Get KYC stats for pending/under review count
  const { data: kycStats } = useQuery({
    queryKey: ["kyc-stats"],
    queryFn: async () => {
      try {
        return await getKYCStats();
      } catch (error) {
        return { total: 0, pending: 0, approved: 0, rejected: 0, underReview: 0 };
      }
    },
    retry: 1,
    staleTime: 30 * 1000, // Refresh every 30 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const pendingKYCCount = (kycStats?.pending || 0) + (kycStats?.underReview || 0);

  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [showRejectModal, setShowRejectModal] = useState<Record<string, boolean>>({});

  const updateCampaignMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest(`/campaigns/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setEditingCampaign(null);
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/campaigns/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  const approveWithdrawalMutation = useMutation({
    mutationFn: async (withdrawalId: string) => {
      return apiRequest(`/withdrawals/${withdrawalId}/approve`, {
        method: "PUT",
        body: JSON.stringify({ notes: reviewNotes[withdrawalId] || "" }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      alert("Withdrawal approved successfully");
    },
  });

  const rejectWithdrawalMutation = useMutation({
    mutationFn: async ({ withdrawalId, reasonPublic, reasonInternal }: { withdrawalId: string; reasonPublic: string; reasonInternal?: string }) => {
      return apiRequest(`/withdrawals/${withdrawalId}/reject`, {
        method: "PUT",
        body: JSON.stringify({ reasonPublic, reasonInternal }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      setShowRejectModal({});
      setRejectReason({});
      alert("Withdrawal rejected successfully");
    },
    onError: (error: any) => {
      alert(error?.response?.data?.message || "Failed to reject withdrawal");
    },
  });

  const approveCampaignMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return await apiRequest(`/campaigns/${id}/approve`, {
        method: "PUT",
        body: JSON.stringify({ notes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["pending-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
    },
  });

  const rejectCampaignMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return await apiRequest(`/campaigns/${id}/reject`, {
        method: "PUT",
        body: JSON.stringify({ notes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["pending-campaigns"] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest(`/campaigns/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
    },
  });

  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      router.push("/dashboard");
    }
  }, [user, router]);

  const handleEdit = (campaign: any) => {
    setEditingCampaign(campaign);
    setEditForm({
      title: campaign.title || "",
      description: campaign.description || "",
      category: campaign.category || "",
      goalInr: campaign.goalInr || "",
      status: campaign.status || "",
    });
  };

  const handleSave = () => {
    if (editingCampaign) {
      updateCampaignMutation.mutate({
        id: editingCampaign.id,
        data: editForm,
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this campaign? This action cannot be undone.")) {
      deleteCampaignMutation.mutate(id);
    }
  };

  // raisedInr is stored in paise (smallest unit), convert to rupees by dividing by 100
  const totalRaised = campaigns?.reduce((sum: number, c: any) => sum + (parseInt(c.raisedInr || "0") / 100), 0) || 0;
  const totalDonations = donations?.length || 0;

  if (userLoading || campaignsLoading) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="pt-32 text-center">
          <p className="text-white/60">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "ADMIN") {
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
            <h1 className="text-5xl md:text-7xl font-bold mb-4">
              Admin
              <br />
              <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                Dashboard
              </span>
            </h1>
            <p className="text-white/60 text-lg">Manage all campaigns, donations, and platform activity</p>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            {[
              { label: "Total Campaigns", value: campaigns?.length || 0 },
              { label: "Total Donations", value: totalDonations },
              { label: "Total Raised", value: `₹${totalRaised.toLocaleString()}` },
              { label: "Pending Reviews", value: withdrawals?.length || 0 },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-2xl p-6"
              >
                <div className="text-white/40 text-sm mb-2">{stat.label}</div>
                <div className="text-3xl font-bold">{stat.value}</div>
              </motion.div>
            ))}
          </div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-8 flex gap-4 flex-wrap"
          >
            <Link href="/dashboard/kyc/admin">
              <Button
                size="lg"
                className={`w-full md:w-auto border ${
                  pendingKYCCount > 0
                    ? "bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/50 text-yellow-400"
                    : "bg-white/5 hover:bg-white/10 border-white/20 text-white"
                }`}
              >
                <FileCheck className="w-5 h-5 mr-2" />
                Review KYC {pendingKYCCount > 0 && `(${pendingKYCCount})`}
              </Button>
            </Link>
          </motion.div>

          {/* Pending Review Queue */}
          {pendingCampaigns && pendingCampaigns.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-2xl p-8 mb-8 border border-yellow-500/20"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Campaigns Pending Review ({pendingCampaigns.length})</h2>
              </div>
              <div className="space-y-4">
                {pendingCampaigns.map((campaign: any) => (
                  <div
                    key={campaign.id}
                    className="border border-yellow-500/30 rounded-lg p-6 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold mb-2">{campaign.title}</h3>
                        <p className="text-white/60 text-sm mb-3 line-clamp-2">{campaign.description}</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-white/40">Organizer</div>
                            <div className="font-semibold">{campaign.organizer?.name || "Unknown"}</div>
                          </div>
                          <div>
                            <div className="text-white/40">Goal</div>
                            <div className="font-semibold">₹{parseInt(campaign.goalInr || "0").toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-white/40">Category</div>
                            <div className="font-semibold">{campaign.category}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => {
                          if (confirm("Approve this campaign? It will become active and visible to the public.")) {
                            approveCampaignMutation.mutate({ id: campaign.id });
                          }
                        }}
                        disabled={approveCampaignMutation.isPending}
                        className="bg-green-500 hover:bg-green-600"
                      >
                        {approveCampaignMutation.isPending ? "Approving..." : "Approve"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const notes = prompt("Enter rejection reason (optional):");
                          if (notes !== null) {
                            rejectCampaignMutation.mutate({ id: campaign.id, notes: notes || undefined });
                          }
                        }}
                        disabled={rejectCampaignMutation.isPending}
                        className="text-red-400 border-red-400/50 hover:bg-red-400/10"
                      >
                        {rejectCampaignMutation.isPending ? "Rejecting..." : "Reject"}
                      </Button>
                      <Link href={`/campaigns/${campaign.id}`}>
                        <Button variant="outline">View Details</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* All Campaigns with Full Management */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-8 mb-8"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold">All Campaigns</h2>
              <div className="text-sm text-white/60">
                {campaigns?.length || 0} total
              </div>
            </div>
            
            {campaigns && campaigns.length > 0 ? (
              <div className="space-y-4">
                {campaigns.map((campaign: any) => (
                  <div
                    key={campaign.id}
                    className="border border-white/10 rounded-lg p-6 hover:bg-white/5 transition-colors"
                  >
                    {editingCampaign?.id === campaign.id ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block mb-2 text-sm font-medium">Title</label>
                          <input
                            type="text"
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="block mb-2 text-sm font-medium">Description</label>
                          <textarea
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                            rows={3}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block mb-2 text-sm font-medium">Category</label>
                            <input
                              type="text"
                              value={editForm.category}
                              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                            />
                          </div>
                          <div>
                            <label className="block mb-2 text-sm font-medium">Goal (INR)</label>
                            <input
                              type="number"
                              value={editForm.goalInr}
                              onChange={(e) => setEditForm({ ...editForm, goalInr: e.target.value })}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block mb-2 text-sm font-medium">Status</label>
                          <select
                            value={editForm.status}
                            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                          >
                            <option value="DRAFT">DRAFT</option>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="PAUSED">PAUSED</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                        </div>
                        <div className="flex gap-4">
                          <Button onClick={handleSave} disabled={updateCampaignMutation.isPending}>
                            {updateCampaignMutation.isPending ? "Saving..." : "Save Changes"}
                          </Button>
                          <Button variant="outline" onClick={() => setEditingCampaign(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h3 className="text-xl font-semibold mb-2">{campaign.title}</h3>
                            <p className="text-white/60 text-sm mb-3 line-clamp-2">{campaign.description}</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <div className="text-white/40">Status</div>
                                <div className="font-semibold">{campaign.status}</div>
                              </div>
                              <div>
                                <div className="text-white/40">Raised</div>
                                <div className="font-semibold">₹{(parseInt(campaign.raisedInr || "0") / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
                              </div>
                              <div>
                                <div className="text-white/40">Goal</div>
                                <div className="font-semibold">₹{parseInt(campaign.goalInr || "0").toLocaleString()}</div>
                              </div>
                              <div>
                                <div className="text-white/40">Donations</div>
                                <div className="font-semibold">{campaign._count?.donations || 0}</div>
                              </div>
                            </div>
                            {campaign.organizer && (
                              <div className="mt-3 text-sm">
                                <span className="text-white/40">Organizer: </span>
                                <span className="text-white/60">{campaign.organizer.name} ({campaign.organizer.email})</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-3 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(campaign)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newStatus = campaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
                              updateStatusMutation.mutate({ id: campaign.id, status: newStatus });
                            }}
                            disabled={updateStatusMutation.isPending}
                          >
                            {campaign.status === "ACTIVE" ? "Pause" : "Activate"}
                          </Button>
                          <Link href={`/campaigns/${campaign.id}`}>
                            <Button variant="outline" size="sm">
                              View
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(campaign.id)}
                            disabled={deleteCampaignMutation.isPending}
                            className="text-red-400 border-red-400/50 hover:bg-red-400/10"
                          >
                            {deleteCampaignMutation.isPending ? "Deleting..." : "Delete"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/60 text-center py-8">No campaigns found</p>
            )}
          </motion.div>

          {/* Withdrawal Review Queue */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-2xl p-8"
          >
            <h2 className="text-3xl font-bold mb-6">Withdrawals Pending Review ({withdrawals?.length || 0})</h2>
            {withdrawals && withdrawals.length > 0 ? (
              <div className="space-y-6">
                {withdrawals.map((withdrawal: any) => {
                  // Format amount based on method
                  const amountDisplay = withdrawal.method === "INR"
                    ? `₹${(withdrawal.amountInrPaise ? parseInt(withdrawal.amountInrPaise.toString()) / 100 : 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                    : withdrawal.assetSymbol
                    ? `${withdrawal.amountNative || "0"} ${withdrawal.assetSymbol}`
                    : "N/A";
                  
                  return (
                    <div
                      key={withdrawal.withdrawalId}
                      className="border border-white/10 rounded-lg p-6 hover:bg-white/5 transition-colors"
                    >
                      <div className="mb-4">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-xl font-semibold">Withdrawal #{withdrawal.withdrawalId.slice(0, 8)}</h3>
                          <Link href={`/campaigns/${withdrawal.campaignId}`}>
                            <Button variant="outline" size="sm">View Campaign</Button>
                          </Link>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-white/40">Campaign: </span>
                            <span className="font-semibold">{withdrawal.campaignTitle}</span>
                          </div>
                          <div>
                            <span className="text-white/40">Amount: </span>
                            <span className="font-semibold">{amountDisplay}</span>
                          </div>
                          <div>
                            <span className="text-white/40">Method: </span>
                            <span className="font-semibold">{withdrawal.method}</span>
                          </div>
                          {withdrawal.invoice?.vendorName && (
                            <div>
                              <span className="text-white/40">Vendor: </span>
                              <span className="font-semibold">{withdrawal.invoice.vendorName}</span>
                            </div>
                          )}
                          {withdrawal.invoice?.invoiceNumber && (
                            <div>
                              <span className="text-white/40">Invoice #: </span>
                              <span className="font-semibold">{withdrawal.invoice.invoiceNumber}</span>
                            </div>
                          )}
                          {withdrawal.invoice?.proofCount !== undefined && (
                            <div>
                              <span className="text-white/40">Proofs: </span>
                              <span className="font-semibold">{withdrawal.invoice.proofCount}</span>
                            </div>
                          )}
                        </div>
                        {withdrawal.invoice?.proofIds && withdrawal.invoice.proofIds.length > 0 && (
                          <div className="mt-4">
                            <label className="block text-sm font-medium mb-2">Proof Files:</label>
                            <div className="flex flex-wrap gap-2">
                              {withdrawal.invoice.proofIds.map((proofId: string, idx: number) => (
                                <ProofLink key={proofId} proofId={proofId} index={idx} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">Review Notes</label>
                        <textarea
                          value={reviewNotes[withdrawal.withdrawalId] || ""}
                          onChange={(e) =>
                            setReviewNotes({ ...reviewNotes, [withdrawal.withdrawalId]: e.target.value })
                          }
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
                          rows={3}
                          placeholder="Add review notes..."
                        />
                      </div>
                      <div className="flex gap-4">
                        <Button
                          onClick={() => approveWithdrawalMutation.mutate(withdrawal.withdrawalId)}
                          disabled={approveWithdrawalMutation.isPending || rejectWithdrawalMutation.isPending}
                          className="flex-1 bg-green-500 hover:bg-green-600"
                        >
                          {approveWithdrawalMutation.isPending ? "Approving..." : "Approve"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowRejectModal({ ...showRejectModal, [withdrawal.withdrawalId]: true })}
                          disabled={approveWithdrawalMutation.isPending || rejectWithdrawalMutation.isPending}
                          className="text-red-400 border-red-400/50 hover:bg-red-400/10"
                        >
                          Reject
                        </Button>
                        <Link href={`/campaigns/${withdrawal.campaignId}`}>
                          <Button variant="outline">
                            View Details
                          </Button>
                        </Link>
                      </div>

                      {/* Reject Modal */}
                      {showRejectModal[withdrawal.withdrawalId] && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="glass rounded-2xl p-8 max-w-lg w-full border border-white/20"
                          >
                            <h3 className="text-2xl font-bold mb-4">Reject Withdrawal</h3>
                            <p className="text-white/60 mb-4">
                              Please provide a reason for rejecting this withdrawal. This reason will be visible to the organizer and may be shown publicly.
                            </p>
                            <textarea
                              value={rejectReason[withdrawal.withdrawalId] || ""}
                              onChange={(e) =>
                                setRejectReason({ ...rejectReason, [withdrawal.withdrawalId]: e.target.value })
                              }
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none mb-4"
                              rows={4}
                              placeholder="Enter rejection reason (required)..."
                            />
                            <div className="flex gap-3">
                              <Button
                                onClick={() => {
                                  if (!rejectReason[withdrawal.withdrawalId] || rejectReason[withdrawal.withdrawalId].trim().length === 0) {
                                    alert("Please provide a rejection reason");
                                    return;
                                  }
                                  rejectWithdrawalMutation.mutate({
                                    withdrawalId: withdrawal.withdrawalId,
                                    reasonPublic: rejectReason[withdrawal.withdrawalId],
                                  });
                                }}
                                disabled={rejectWithdrawalMutation.isPending}
                                className="flex-1 bg-red-500 hover:bg-red-600"
                              >
                                {rejectWithdrawalMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setShowRejectModal({ ...showRejectModal, [withdrawal.withdrawalId]: false });
                                  setRejectReason({ ...rejectReason, [withdrawal.withdrawalId]: "" });
                                }}
                                disabled={rejectWithdrawalMutation.isPending}
                              >
                                Cancel
                              </Button>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-white/60">No withdrawals pending review</p>
            )}
          </motion.div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
