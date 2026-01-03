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

export default function VendorDashboard() {
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

  // Get withdrawals where this vendor is the payee
  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ["vendor-withdrawals", user?.id],
    queryFn: async () => {
      try {
        if (!user?.id) return [];
        const allWithdrawals = await apiRequest<any[]>("/withdrawals");
        // Filter by payee (would need wallet address matching)
        return allWithdrawals.filter((w: any) => 
          w.payee?.toLowerCase() === user.walletAddress?.toLowerCase() ||
          w.payee?.toLowerCase() === user.email?.toLowerCase()
        );
      } catch (error) {
        return [];
      }
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (user && user.role !== "VENDOR") {
      router.push("/dashboard");
    }
  }, [user, router]);

  const totalReceived = withdrawals?.reduce((sum: number, w: any) => 
    sum + parseInt(w.amount || "0"), 0) || 0;
  const pendingWithdrawals = withdrawals?.filter((w: any) => 
    w.status === "SUBMITTED" || w.status === "IN_REVIEW").length || 0;
  const completedWithdrawals = withdrawals?.filter((w: any) => 
    w.status === "RELEASED").length || 0;

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
              Vendor
              <br />
              <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                Dashboard
              </span>
            </h1>
            <p className="text-white/60 text-lg mt-4">
              Track your payouts and manage vendor services
            </p>
            {user?.walletAddress && (
              <div className="mt-4 text-white/40 text-sm">
                Wallet: <span className="font-mono text-white/60">{user.walletAddress}</span>
              </div>
            )}
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-2xl p-6"
            >
              <div className="text-white/60 text-sm mb-2">Total Received</div>
              <div className="text-3xl font-bold">₹{totalReceived.toLocaleString()}</div>
              <div className="text-white/40 text-xs mt-2">all time payouts</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-2xl p-6"
            >
              <div className="text-white/60 text-sm mb-2">Pending</div>
              <div className="text-3xl font-bold">{pendingWithdrawals}</div>
              <div className="text-white/40 text-xs mt-2">awaiting approval</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-2xl p-6"
            >
              <div className="text-white/60 text-sm mb-2">Completed</div>
              <div className="text-3xl font-bold">{completedWithdrawals}</div>
              <div className="text-white/40 text-xs mt-2">successful payouts</div>
            </motion.div>
          </div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-12 flex gap-4 flex-wrap"
          >
            {!user?.walletAddress && (
              <Button size="lg" variant="outline">
                Connect Wallet
              </Button>
            )}
            <Link href="/campaigns">
              <Button size="lg" variant="outline">Browse Campaigns</Button>
            </Link>
          </motion.div>

          {/* Withdrawals */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h2 className="text-3xl font-bold mb-6">Your Payouts</h2>
            {isLoading ? (
              <div className="text-center py-20">
                <p className="text-white/60">Loading payouts...</p>
              </div>
            ) : withdrawals && withdrawals.length > 0 ? (
              <div className="space-y-4">
                {withdrawals.map((withdrawal: any, i: number) => (
                  <motion.div
                    key={withdrawal.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + i * 0.05 }}
                    className="glass rounded-2xl p-6 hover:bg-white/10 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm text-white/60 mb-2">Campaign</div>
                        <div className="text-lg font-semibold mb-4">
                          {withdrawal.campaignId?.slice(0, 8)}...
                        </div>
                        <div className="flex gap-6 text-sm">
                          <div>
                            <div className="text-white/60">Amount</div>
                            <div className="font-semibold">₹{parseInt(withdrawal.amount || "0").toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-white/60">Status</div>
                            <div className={`font-semibold ${
                              withdrawal.status === "RELEASED" ? "text-green-400" :
                              withdrawal.status === "REJECTED" ? "text-red-400" :
                              "text-yellow-400"
                            }`}>
                              {withdrawal.status}
                            </div>
                          </div>
                        </div>
                      </div>
                      {withdrawal.txHash && (
                        <Link
                          href={`https://polygonscan.com/tx/${withdrawal.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="sm">
                            View TX
                          </Button>
                        </Link>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 glass rounded-2xl">
                <p className="text-white/60 text-lg mb-4">No payouts yet.</p>
                <p className="text-white/40 text-sm">
                  Payouts will appear here when campaigns release funds to you.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
