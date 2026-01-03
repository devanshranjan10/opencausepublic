"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, AlertCircle, X } from "lucide-react";
import Link from "next/link";

interface Milestone {
  name: string;
  description: string;
  capAmount: string;
  proofTypes: string[];
  coolingOffHours: number;
  reviewWindowHours: number;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showKYCModal, setShowKYCModal] = useState(false);

  // Get KYC status
  const { data: kycStatus, isLoading: kycLoading } = useQuery({
    queryKey: ["kyc-status"],
    queryFn: async () => {
      try {
        return await apiRequest<{ status: string; type?: string }>("/kyc/status");
      } catch (error) {
        return { status: "NOT_STARTED" };
      }
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const isKYCVerified = kycStatus?.status === "VERIFIED" || kycStatus?.status === "APPROVED";

  // Check KYC status on mount
  useEffect(() => {
    if (!kycLoading && !isKYCVerified) {
      setShowKYCModal(true);
    }
  }, [kycLoading, isKYCVerified]);

  // Get KYC message based on status
  const getKYCMessage = () => {
    const status = kycStatus?.status || "NOT_STARTED";
    switch (status) {
      case "NOT_STARTED":
        return {
          title: "KYC Verification Required",
          message: "You must complete KYC verification before creating campaigns.",
          action: "Start KYC Verification",
        };
      case "PENDING":
        return {
          title: "KYC Verification Pending",
          message: "Your KYC submission is being reviewed. Please wait for a response before creating campaigns.",
          action: null,
        };
      case "IN_REVIEW":
      case "UNDER_REVIEW":
        return {
          title: "KYC Under Review",
          message: "Your KYC is currently being reviewed by our team. You'll be notified once a decision is made.",
          action: null,
        };
      case "REJECTED":
        return {
          title: "KYC Verification Rejected",
          message: "Your KYC submission was rejected. Please review the feedback and resubmit before creating campaigns.",
          action: "Resubmit KYC",
        };
      default:
        return {
          title: "KYC Verification Required",
          message: "You must complete KYC verification before creating campaigns.",
          action: "Start KYC Verification",
        };
    }
  };

  const kycMessage = getKYCMessage();
  const canSubmitKYC = !kycStatus?.status || kycStatus?.status === "NOT_STARTED" || kycStatus?.status === "REJECTED";

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    goalInr: "",
    goalCrypto: "",
    startDate: "",
    endDate: "",
    imageUrl: "",
    milestones: [
      {
        name: "",
        description: "",
        capAmount: "",
        proofTypes: [] as string[],
        coolingOffHours: 0,
        reviewWindowHours: 24,
      },
    ] as Milestone[],
  });

  const addMilestone = () => {
    setFormData({
      ...formData,
      milestones: [
        ...formData.milestones,
        {
          name: "",
          description: "",
          capAmount: "",
          proofTypes: [],
          coolingOffHours: 0,
          reviewWindowHours: 24,
        },
      ],
    });
  };

  const removeMilestone = (index: number) => {
    if (formData.milestones.length > 1) {
      setFormData({
        ...formData,
        milestones: formData.milestones.filter((_, i) => i !== index),
      });
    }
  };

  const updateMilestone = (index: number, field: keyof Milestone, value: any) => {
    const updated = [...formData.milestones];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, milestones: updated });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check KYC status before submission
    if (!isKYCVerified) {
      setShowKYCModal(true);
      return;
    }

    setLoading(true);
    try {
      // Validate milestones
      const validMilestones = formData.milestones.filter(
        (m) => m.name && m.capAmount
      );
      
      if (validMilestones.length === 0) {
        alert("Please add at least one milestone with name and cap amount");
        setLoading(false);
        return;
      }

      const result = await apiRequest<{ id: string }>("/campaigns", {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          milestones: validMilestones.map((m) => ({
            ...m,
            capAmount: m.capAmount,
            coolingOffHours: m.coolingOffHours || 0,
            reviewWindowHours: m.reviewWindowHours || 24,
          })),
          startDate: new Date(formData.startDate),
          endDate: new Date(formData.endDate),
        }),
      });
      alert("Campaign created successfully! It is now pending review by an admin or reviewer. You will be notified once it's approved.");
      router.push(`/dashboard/organizer/campaigns/${result.id}`);
    } catch (error: any) {
      alert(error.message || "Failed to create campaign");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <Header />
      
      {/* KYC Verification Modal */}
      <AnimatePresence>
        {showKYCModal && !isKYCVerified && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass rounded-2xl p-8 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-yellow-400" />
                  <h2 className="text-2xl font-bold">{kycMessage.title}</h2>
                </div>
                <button
                  onClick={() => setShowKYCModal(false)}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-white/80 mb-6 leading-relaxed">
                {kycMessage.message}
              </p>

              <div className="flex gap-3">
                {kycMessage.action && canSubmitKYC ? (
                  <Link href="/dashboard/kyc" className="flex-1">
                    <Button size="lg" className="w-full">
                      {kycMessage.action}
                    </Button>
                  </Link>
                ) : null}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => router.push("/dashboard/organizer/individual")}
                  className={kycMessage.action ? "" : "flex-1"}
                >
                  Go to Dashboard
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="pt-32 pb-20 px-6 lg:px-8">
        <div className="container mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-5xl md:text-7xl font-bold mb-4">
              Create
              <br />
              <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                Campaign
              </span>
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-8"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block mb-2 text-sm font-medium">Campaign Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                  placeholder="Enter campaign title"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium">Description</label>
                <textarea
                  required
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
                  placeholder="Describe your campaign"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-sm font-medium">Goal (INR)</label>
                  <input
                    type="number"
                    required
                    value={formData.goalInr}
                    onChange={(e) => setFormData({ ...formData, goalInr: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                    placeholder="100000"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium">Category</label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                    placeholder="Education, Health, etc."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-sm font-medium">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium">End Date</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                </div>
              </div>

              <ImageUpload
                value={formData.imageUrl}
                onChange={(url) => setFormData({ ...formData, imageUrl: url })}
                label="Campaign Image"
              />

              {/* Milestones Section */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="block text-sm font-medium">Milestones</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addMilestone}
                    className="flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Milestone
                  </Button>
                </div>
                <div className="space-y-4">
                  {formData.milestones.map((milestone, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border border-white/10 rounded-lg p-4 bg-white/5"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-semibold text-white/80">
                          Milestone {index + 1}
                        </h4>
                        {formData.milestones.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeMilestone(index)}
                            className="text-red-400 border-red-400/50 hover:bg-red-400/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block mb-1 text-xs text-white/60">
                            Milestone Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={milestone.name}
                            onChange={(e) =>
                              updateMilestone(index, "name", e.target.value)
                            }
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                            placeholder="e.g., Phase 1: Initial Setup"
                          />
                        </div>
                        <div>
                          <label className="block mb-1 text-xs text-white/60">
                            Description
                          </label>
                          <textarea
                            value={milestone.description}
                            onChange={(e) =>
                              updateMilestone(index, "description", e.target.value)
                            }
                            rows={2}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
                            placeholder="Describe what this milestone achieves"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block mb-1 text-xs text-white/60">
                              Cap Amount (INR) *
                            </label>
                            <input
                              type="number"
                              required
                              value={milestone.capAmount}
                              onChange={(e) =>
                                updateMilestone(index, "capAmount", e.target.value)
                              }
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                              placeholder="50000"
                            />
                          </div>
                          <div>
                            <label className="block mb-1 text-xs text-white/60">
                              Review Window (hours)
                            </label>
                            <input
                              type="number"
                              value={milestone.reviewWindowHours}
                              onChange={(e) =>
                                updateMilestone(
                                  index,
                                  "reviewWindowHours",
                                  parseInt(e.target.value) || 24
                                )
                              }
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                              placeholder="24"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Creating..." : "Create Campaign"}
              </Button>
            </form>
          </motion.div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

