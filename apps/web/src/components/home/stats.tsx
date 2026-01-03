"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

function AnimatedCounter({
  value,
  duration = 2,
  prefix = "",
  suffix = "",
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      let start = 0;
      const end = value;
      const increment = end / (duration * 60);
      const timer = setInterval(() => {
        start += increment;
        if (start >= end) {
          setCount(end);
          clearInterval(timer);
        } else {
          setCount(Math.floor(start));
        }
      }, 1000 / 60);
      return () => clearInterval(timer);
    }
  }, [isInView, value, duration]);

  return (
    <span ref={ref} className="inline-block">
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

export function Stats() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const { data: platformStats, isLoading } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      try {
        return await apiRequest<any>("/stats");
      } catch (error) {
        console.error("Failed to fetch platform stats:", error);
        return {
          activeCampaigns: 0,
          totalDonations: 0,
          totalRaised: "0",
          verifiedOrganizers: 0,
        };
      }
    },
    staleTime: 60000, // Cache for 1 minute
    refetchOnMount: true,
  });

  const stats = [
    { 
      label: "Active Campaigns", 
      value: platformStats?.activeCampaigns || 0, 
      prefix: "", 
      suffix: "" 
    },
    { 
      label: "Total Donations", 
      value: platformStats?.totalDonations || 0, 
      prefix: "", 
      suffix: "" 
    },
    { 
      label: "Amount Raised", 
      value: parseInt(platformStats?.totalRaised || "0") / 100, // Convert from paise to rupees
      prefix: "₹", 
      suffix: "" 
    },
    { 
      label: "Verified Organizers", 
      value: platformStats?.verifiedOrganizers || 0, 
      prefix: "", 
      suffix: "" 
    },
  ];

  return (
    <section ref={ref} className="py-16 sm:py-24 md:py-32 container mx-auto px-4 sm:px-6 lg:px-8 bg-black/50">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8 max-w-7xl mx-auto">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="text-center px-2">
              <div className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                <div className="h-12 bg-white/10 rounded animate-pulse" />
              </div>
              <div className="h-4 bg-white/10 rounded animate-pulse" />
            </div>
          ))
        ) : (
          stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: i * 0.1, duration: 0.6 }}
            className="text-center px-2"
          >
            <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold mb-2 sm:mb-3 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent overflow-visible">
              <div className="whitespace-nowrap truncate">
                <AnimatedCounter
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                />
              </div>
            </div>
            <div className="text-xs sm:text-sm md:text-base text-white/40">{stat.label}</div>
          </motion.div>
        ))
        )}
      </div>
    </section>
  );
}

