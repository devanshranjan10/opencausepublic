"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const { data: user, isLoading, isFetching } = useQuery({
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

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token && !isLoading) {
      router.push("/auth/login");
      return;
    }
    
    // Invalidate user query when token changes
    if (token) {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    }
  }, [isLoading, router, queryClient]);

  useEffect(() => {
    if (user && !isFetching) {
      // Redirect to role-specific dashboard
      if (user.role === "ADMIN") {
        router.replace("/dashboard/admin");
      } else if (user.role === "REVIEWER") {
        router.replace("/dashboard/reviewer");
      } else if (user.role === "VENDOR") {
        router.replace("/dashboard/vendor");
      } else if (user.role === "INDIVIDUAL_ORGANIZER") {
        router.replace("/dashboard/organizer/individual");
      } else if (user.role === "NGO_ORGANIZER") {
        router.replace("/dashboard/organizer/ngo");
      } else if (user.role === "DONOR") {
        router.replace("/dashboard/donor");
      } else if (user.role === "CSR_TEAM") {
        router.replace("/dashboard/csr");
      }
    }
  }, [user, router, isFetching]);

  if (isLoading || isFetching) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <LoadingOverlay isVisible={true} message="Loading dashboard..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="pt-32 text-center">
          <p className="text-white/60">Redirecting to login...</p>
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
            className="mb-12"
          >
            <h1 className="text-5xl md:text-7xl font-bold mb-4">
              Welcome back,
              <br />
              <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                {user.name}
              </span>
            </h1>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-2xl p-8"
            >
              <h2 className="text-2xl font-semibold mb-4">Profile</h2>
              <div className="space-y-2 text-white/60">
                <p>
                  <span className="text-white/40">Role:</span> {user.role}
                </p>
                <p>
                  <span className="text-white/40">Email:</span> {user.email}
                </p>
                <p>
                  <span className="text-white/40">KYC Status:</span>{" "}
                  <span className={user.kycStatus === "VERIFIED" ? "text-green-400" : "text-yellow-400"}>
                    {user.kycStatus}
                  </span>
                </p>
              </div>
            </motion.div>
          </div>

          <div className="space-y-4">
            {user.role === "INDIVIDUAL_ORGANIZER" || user.role === "NGO_ORGANIZER" ? (
              <Link href="/dashboard/organizer/campaigns">
                <Button size="lg" className="w-full sm:w-auto">
                  Manage Campaigns
                </Button>
              </Link>
            ) : null}
            {user.role === "DONOR" ? (
              <Link href="/dashboard/donor">
                <Button size="lg" className="w-full sm:w-auto">
                  My Donations
                </Button>
              </Link>
            ) : null}
            {user.role === "ADMIN" ? (
              <Link href="/dashboard/admin">
                <Button size="lg" className="w-full sm:w-auto">
                  Admin Dashboard
                </Button>
              </Link>
            ) : null}
            {user.role === "REVIEWER" ? (
              <Link href="/dashboard/reviewer">
                <Button size="lg" className="w-full sm:w-auto">
                  Reviewer Dashboard
                </Button>
              </Link>
            ) : null}
            {user.role === "VENDOR" ? (
              <Link href="/dashboard/vendor">
                <Button size="lg" className="w-full sm:w-auto">
                  Vendor Dashboard
                </Button>
              </Link>
            ) : null}
            {user.role === "CSR_TEAM" ? (
              <Link href="/dashboard/csr">
                <Button size="lg" className="w-full sm:w-auto">
                  CSR Dashboard
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

