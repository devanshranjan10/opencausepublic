"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { motion } from "framer-motion";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    role: "DONOR",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await apiRequest<{ token?: string }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      if (result.token) {
        localStorage.setItem("token", result.token);
        // Invalidate queries to ensure fresh data
        window.location.href = "/dashboard";
      } else {
        setLoading(false);
      }
    } catch (error: any) {
      alert(error.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <LoadingOverlay isVisible={loading} message="Signing up..." />
      <Header />
      <div className="flex items-center justify-center min-h-screen pt-16 sm:pt-20 px-4 sm:px-6 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md glass rounded-xl sm:rounded-2xl p-6 sm:p-8"
        >
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Sign Up</h1>
          <p className="text-sm sm:text-base text-white/60 mb-6 sm:mb-8">Create your OpenCause account</p>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block mb-2 text-sm font-medium">Email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium">Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                <option value="DONOR">Donor</option>
                <option value="INDIVIDUAL_ORGANIZER">Individual Organizer</option>
                <option value="NGO_ORGANIZER">NGO Organizer</option>
                <option value="VENDOR">Vendor</option>
                <option value="CSR_TEAM">CSR Team</option>
              </select>
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium">Password (for dev)</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                placeholder="Optional"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating Account..." : "Sign Up"}
            </Button>
          </form>
          <p className="mt-6 text-center text-white/60">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-white hover:underline">
              Login
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

