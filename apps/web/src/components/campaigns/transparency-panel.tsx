"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Clock, XCircle, FileText, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

interface WithdrawalPublicDoc {
  id: string;
  withdrawalId: string;
  campaignId: string;
  method: "INR" | "CRYPTO";
  amountDisplay: string;
  assetSymbol?: string;
  networkId?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID";
  publicNote?: string;
  rejectionReasonPublic?: string;
  proofSummary?: { count: number };
  payeeMasked?: string;
  createdAt: {
    seconds?: number;
    toDate?: () => Date;
    toMillis?: () => number;
  };
  updatedAt: any;
}

function WithdrawalTimeline({ campaignId }: { campaignId: string }) {
  const { data: withdrawals = [], isLoading } = useQuery<WithdrawalPublicDoc[]>({
    queryKey: ["campaign-withdrawals-public", campaignId],
    queryFn: async () => {
      return apiRequest<WithdrawalPublicDoc[]>(`/withdrawals/campaign/${campaignId}/public`);
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const formatTime = (timestamp: WithdrawalPublicDoc["createdAt"]) => {
    const date = timestamp?.toDate?.() || 
                 (timestamp?.toMillis ? new Date(timestamp.toMillis()) : null) ||
                 (timestamp?.seconds ? new Date(timestamp.seconds * 1000) : null);
    if (!date || isNaN(date.getTime())) return "Unknown date";
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getStatusBadge = (status: WithdrawalPublicDoc["status"]) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50"><Clock className="w-3 h-3 mr-1" />Pending Review</Badge>;
      case "APPROVED":
        return <Badge variant="default" className="bg-blue-500/20 text-blue-400 border-blue-500/50"><CheckCircle2 className="w-3 h-3 mr-1" />Approved</Badge>;
      case "PAID":
        return <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/50"><CheckCircle2 className="w-3 h-3 mr-1" />Paid</Badge>;
      case "REJECTED":
        return <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/50"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-white/5 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (withdrawals.length === 0) {
    return (
      <div className="text-center py-12 text-white/40">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No withdrawal requests yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {withdrawals.map((withdrawal, index) => (
        <motion.div
          key={withdrawal.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="p-4 rounded-lg border border-white/10 bg-white/5"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-semibold text-lg">{withdrawal.amountDisplay}</span>
                {withdrawal.assetSymbol && withdrawal.method === "CRYPTO" && (
                  <span className="text-sm text-white/60">{withdrawal.assetSymbol}</span>
                )}
                {withdrawal.networkId && (
                  <span className="text-xs text-white/40">({withdrawal.networkId.replace("_mainnet", "")})</span>
                )}
                {getStatusBadge(withdrawal.status)}
              </div>
              {withdrawal.publicNote && (
                <p className="text-sm text-white/60 mb-1">{withdrawal.publicNote}</p>
              )}
              {withdrawal.rejectionReasonPublic && (
                <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/30">
                  <p className="text-sm text-red-400">
                    <strong>Rejection reason:</strong> {withdrawal.rejectionReasonPublic}
                  </p>
                </div>
              )}
              {withdrawal.proofSummary && withdrawal.proofSummary.count > 0 && (
                <p className="text-xs text-white/40 mt-1">
                  {withdrawal.proofSummary.count} proof file{withdrawal.proofSummary.count > 1 ? "s" : ""} attached
                </p>
              )}
              <p className="text-xs text-white/40 mt-2">{formatTime(withdrawal.createdAt)}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Simple date formatting utility (replaces date-fns)
const formatDistanceToNow = (date: Date, options?: { addSuffix?: boolean }) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(Math.abs(diffMs) / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  let result = "";
  if (diffDays > 0) {
    result = `${diffDays} day${diffDays > 1 ? "s" : ""}`;
  } else if (diffHours > 0) {
    result = `${diffHours} hour${diffHours > 1 ? "s" : ""}`;
  } else if (diffMins > 0) {
    result = `${diffMins} minute${diffMins > 1 ? "s" : ""}`;
  } else {
    result = `${diffSecs} second${diffSecs > 1 ? "s" : ""}`;
  }
  
  return options?.addSuffix ? `${result} ago` : result;
};

interface Milestone {
  id: string;
  title: string;
  description: string;
  targetAmountInr?: string;
  targetAmountCrypto?: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "FUNDING_COMPLETED" | "WITHDRAWAL_IN_REVIEW" | "PAID_OUT";
  receivedAmountInr?: string;
  receivedAmountCrypto?: string;
  fundingCompletedAt?: any;
}

interface Event {
  id: string;
  type: string;
  data: Record<string, any>;
  createdAt: any;
}

interface TransparencyPanelProps {
  campaignId: string;
}

export function TransparencyPanel({ campaignId }: TransparencyPanelProps) {
  const [activeTab, setActiveTab] = useState("milestones");

  // Fetch milestones
  const { data: milestones, isLoading: milestonesLoading } = useQuery({
    queryKey: ["campaign-milestones", campaignId],
    queryFn: async () => {
      return apiRequest<Milestone[]>(`/campaigns/${campaignId}/milestones`);
    },
    staleTime: 30 * 1000,
  });

  // Fetch events
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ["campaign-events", campaignId],
    queryFn: async () => {
      return apiRequest<Event[]>(`/campaigns/${campaignId}/events?visibility=PUBLIC&limit=50`);
    },
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000, // Refresh every 15s for real-time feel
  });

  const getStatusBadge = (status: Milestone["status"]) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      NOT_STARTED: { label: "Not Started", variant: "outline" },
      IN_PROGRESS: { label: "In Progress", variant: "secondary" },
      FUNDING_COMPLETED: { label: "Funding Complete", variant: "default" },
      WITHDRAWAL_IN_REVIEW: { label: "Under Review", variant: "secondary" },
      PAID_OUT: { label: "Paid Out", variant: "default" },
    };
    const config = variants[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatAmount = (amount: string | undefined, currency: string = "INR") => {
    if (!amount) return "0";
    const num = parseFloat(amount);
    if (currency === "INR") {
      return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
    }
    return `${num.toLocaleString("en-IN", { maximumFractionDigits: 6 })} ${currency}`;
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "CAMPAIGN_PUBLISHED":
        return <FileText className="w-4 h-4" />;
      case "DONATION_RECEIVED":
      case "DONATION_ALLOCATED":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "MILESTONE_FUNDING_COMPLETED":
        return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
      case "WITHDRAWAL_SUBMITTED":
      case "WITHDRAWAL_APPROVED":
      case "WITHDRAWAL_PAID":
        return <CheckCircle2 className="w-4 h-4 text-purple-500" />;
      case "WITHDRAWAL_REJECTED":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const formatEventMessage = (event: Event) => {
    const data = event.data || {};
    switch (event.type) {
      case "CAMPAIGN_PUBLISHED":
        return "Campaign published";
      case "DONATION_RECEIVED":
        return `Received ${formatAmount(data.amount, data.currency)} donation`;
      case "DONATION_ALLOCATED":
        return `Allocated ${formatAmount(data.amount, data.currency)} to ${data.milestoneTitle || "milestone"}`;
      case "MILESTONE_FUNDING_COMPLETED":
        return `Milestone "${data.milestoneTitle || ""}" funding completed`;
      case "WITHDRAWAL_SUBMITTED":
        return `Withdrawal request submitted: ${formatAmount(data.amount, data.currency)}`;
      case "WITHDRAWAL_APPROVED":
        return `Withdrawal approved: ${formatAmount(data.amount, data.currency)}`;
      case "WITHDRAWAL_PAID":
        return `Withdrawal paid: ${formatAmount(data.amount, data.currency)}`;
      case "WITHDRAWAL_REJECTED":
        return `Withdrawal rejected: ${formatAmount(data.amount, data.currency)}`;
      default:
        return event.type.replace(/_/g, " ").toLowerCase();
    }
  };

  return (
    <Card className="glass border border-white/10">
      <CardHeader>
        <CardTitle>Transparency</CardTitle>
        <CardDescription>Campaign milestones, withdrawals, and activity</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="milestones">Milestones</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          {/* Milestones Tab */}
          <TabsContent value="milestones" className="mt-6 space-y-4">
            {milestonesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 bg-white/5 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : milestones && milestones.length > 0 ? (
              milestones.map((milestone, index) => {
                const targetAmount = milestone.targetAmountInr || milestone.targetAmountCrypto || "0";
                const receivedAmount = milestone.receivedAmountInr || milestone.receivedAmountCrypto || "0";
                const progress = parseFloat(targetAmount) > 0 
                  ? (parseFloat(receivedAmount) / parseFloat(targetAmount)) * 100 
                  : 0;
                const currency = milestone.targetAmountInr ? "INR" : "ETH";

                return (
                  <motion.div
                    key={milestone.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-4 rounded-lg border border-white/10 bg-white/5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1">{milestone.title}</h3>
                        {milestone.description && (
                          <p className="text-sm text-white/60 mb-2">{milestone.description}</p>
                        )}
                      </div>
                      {getStatusBadge(milestone.status)}
                    </div>

                    <div className="mb-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-white/60">
                          {formatAmount(receivedAmount, currency)} / {formatAmount(targetAmount, currency)}
                        </span>
                        <span className="font-semibold">{Math.min(100, Math.round(progress))}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    {milestone.status === "FUNDING_COMPLETED" && milestone.fundingCompletedAt && (
                      <p className="text-xs text-green-400 mt-2">
                        ✓ Completed{" "}
                        {formatDistanceToNow(
                          milestone.fundingCompletedAt?.toDate
                            ? milestone.fundingCompletedAt.toDate()
                            : milestone.fundingCompletedAt?.toMillis
                            ? new Date(milestone.fundingCompletedAt.toMillis())
                            : typeof milestone.fundingCompletedAt === "string"
                            ? new Date(milestone.fundingCompletedAt)
                            : new Date(),
                          { addSuffix: true }
                        )}
                      </p>
                    )}
                  </motion.div>
                );
              })
            ) : (
              <div className="text-center py-12 text-white/40">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No milestones defined for this campaign</p>
              </div>
            )}
          </TabsContent>

          {/* Withdrawals Tab */}
          <TabsContent value="withdrawals" className="mt-6">
            <WithdrawalTimeline campaignId={campaignId} />
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="mt-6">
            {eventsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : events && events.length > 0 ? (
              <div className="space-y-3">
                {events.map((event, index) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-3 p-3 rounded-lg border border-white/10 bg-white/5"
                  >
                    <div className="mt-0.5">{getEventIcon(event.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{formatEventMessage(event)}</p>
                      {event.createdAt && (
                        <p className="text-xs text-white/40 mt-1">
                          {formatDistanceToNow(
                            event.createdAt?.toDate
                              ? event.createdAt.toDate()
                              : event.createdAt?.toMillis
                              ? new Date(event.createdAt.toMillis())
                              : typeof event.createdAt === "string"
                              ? new Date(event.createdAt)
                              : new Date(),
                            { addSuffix: true }
                          )}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-white/40">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No activity yet</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

