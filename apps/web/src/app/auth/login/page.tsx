"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { motion } from "framer-motion";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiRequest<any>("/auth/login", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      
      if (result && result.token) {
        localStorage.setItem("token", result.token);
        // Invalidate queries to ensure fresh data
        window.location.href = "/dashboard";
      } else {
        setError("Login failed. Invalid response from server.");
        setLoading(false);
      }
    } catch (err: any) {
      // Extract error message safely to avoid React error overlay issues
      let errorMessage = "Login failed. Please check your credentials.";
      
      try {
        if (err?.message) {
          errorMessage = String(err.message);
        } else if (typeof err === "string") {
          errorMessage = err;
        } else if (err?.response?.data?.message) {
          errorMessage = String(err.response.data.message);
        } else if (err?.response?.data?.error) {
          errorMessage = String(err.response.data.error);
        }
      } catch {
        // Fallback if error extraction fails
        errorMessage = "Login failed. Please check your credentials.";
      }
      
      // Only log the message, not the full error object
      console.error("Login error:", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <LoadingOverlay isVisible={loading} message="Logging in..." />
      <Header />
      <div className="flex items-center justify-center min-h-screen pt-20 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md glass rounded-2xl p-8"
        >
          <h1 className="text-4xl font-bold mb-2">Login</h1>
          <p className="text-white/60 mb-8">Welcome back to OpenCause</p>
          
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
              {error.includes("connect") && (
                <p className="text-red-300 text-xs mt-2">
                  Make sure the API server is running: <code className="bg-black/30 px-2 py-1 rounded">npx pnpm --filter api dev</code>
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block mb-2 text-sm font-medium">Email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  setError(null);
                }}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                placeholder="admin@opencause.in"
              />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  setError(null);
                }}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                placeholder="admin123 (or leave empty for dev)"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>
          
          <div className="mt-6 p-4 bg-white/5 rounded-lg">
            <p className="text-xs text-white/60 mb-2">Test Credentials (Password: admin123):</p>
            <div className="text-xs text-white/40 space-y-1">
              <p>Admin: admin@opencause.in</p>
              <p>Reviewer: reviewer@opencause.in</p>
              <p>Donor: donor@opencause.in</p>
              <p>Organizer: organizer@opencause.in</p>
              <p>NGO: ngo@opencause.in</p>
              <p>Vendor: vendor@opencause.in</p>
              <p>CSR Team: csr@opencause.in</p>
            </div>
          </div>

          <p className="mt-6 text-center text-white/60">
            Don't have an account?{" "}
            <Link href="/auth/signup" className="text-white hover:underline">
              Sign up
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

