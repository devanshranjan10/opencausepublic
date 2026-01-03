"use client";

import { motion, useAnimation } from "framer-motion";
import { useRef, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { CampaignIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { DonateModal } from "@/components/campaigns/donate-modal";

export function FeaturedCampaigns() {
  const ref = useRef(null);
  const controls = useAnimation();
  const [isPaused, setIsPaused] = useState(false);
  const [hoveredCampaign, setHoveredCampaign] = useState<string | null>(null);
  const [donateModalOpen, setDonateModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaigns", "featured"],
    queryFn: async () => {
      try {
        // Only fetch ACTIVE campaigns for public display
        const activeCampaigns = await apiRequest<any[]>("/campaigns?status=ACTIVE");
        return activeCampaigns || [];
      } catch (error) {
        console.error("Failed to fetch featured campaigns:", error);
        return [];
      }
    },
    retry: false,
    staleTime: 60000,
  });

  // Fetch donations for featured campaigns to calculate accurate totals
  const { data: allDonations } = useQuery({
    queryKey: ["featured-campaigns-donations", campaigns?.map(c => c.id)],
    queryFn: async () => {
      if (!campaigns || campaigns.length === 0) return {};
      const donationsMap: Record<string, any[]> = {};
      await Promise.all(
        campaigns.map(async (campaign: any) => {
          try {
            const donations = await apiRequest<any[]>(`/crypto/campaigns/${campaign.id}/donations-public`);
            donationsMap[campaign.id] = donations || [];
          } catch (error) {
            donationsMap[campaign.id] = [];
          }
        })
      );
      return donationsMap;
    },
    enabled: !!campaigns && campaigns.length > 0,
    staleTime: 30000,
  });

  // Calculate raised amounts from donations for each campaign using stored inrAtConfirm values ONLY
  const campaignTotals = useMemo(() => {
    if (!allDonations || !campaigns) return {};
    const totals: Record<string, number> = {};
    campaigns.forEach((campaign: any) => {
      const donations = allDonations[campaign.id] || [];
      totals[campaign.id] = donations.reduce((sum: number, donation: any) => {
        if (!donation.verified) return sum;
        
        if (donation.type === "INR") {
          return sum + parseFloat(donation.amountNative || "0");
        }
        
        // For crypto donations: ALWAYS use inrAtConfirm (stored at donation time)
        if (donation.inrAtConfirm && parseFloat(donation.inrAtConfirm) > 0) {
          return sum + parseFloat(donation.inrAtConfirm);
        }
        
        return sum;
      }, 0);
    });
    return totals;
  }, [allDonations, campaigns]);

  // Duplicate campaigns for seamless loop
  const displayCampaigns = campaigns && campaigns.length > 0 
    ? [...campaigns, ...campaigns, ...campaigns]
    : [];

  useEffect(() => {
    if (displayCampaigns.length > 0 && !isPaused) {
      controls.start({
        x: [0, -2400],
        transition: {
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: 60,
            ease: "linear",
          },
        },
      });
    } else {
      controls.stop();
    }
  }, [displayCampaigns.length, isPaused, controls]);

  return (
    <section ref={ref} className="py-16 sm:py-24 md:py-32 container mx-auto px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-4 sm:mb-6 px-2">
            Featured
            <br />
            <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              Campaigns
            </span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-white/60 max-w-2xl mx-auto px-4">
            Discover causes making a real impact with transparent, proof-backed funding
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-20">
            <p className="text-white/60">Loading campaigns...</p>
          </div>
        ) : displayCampaigns.length > 0 ? (
          <div className="relative overflow-hidden">
            {/* Sliding Campaigns Container */}
            <motion.div
              className="flex gap-8 items-center"
              animate={controls}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {displayCampaigns.map((campaign: any, i: number) => (
                <CampaignCard
                  key={`${campaign.id}-${i}`}
                  campaign={campaign}
                  campaignTotals={campaignTotals}
                  isHovered={hoveredCampaign === campaign.id}
                  onHover={() => setHoveredCampaign(campaign.id)}
                  onLeave={() => setHoveredCampaign(null)}
                  onDonate={() => {
                    setSelectedCampaign(campaign);
                    setDonateModalOpen(true);
                  }}
                />
              ))}
            </motion.div>
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-white/40 text-lg mb-4">No campaigns yet. Be the first to create one!</p>
            <Link href="/auth/signup">
              <Button className="px-6 py-3 bg-white text-black hover:bg-white/90 transition-colors">
                Create Campaign
              </Button>
            </Link>
          </div>
        )}

        {displayCampaigns.length > 0 && (
          <div className="text-center mt-12">
            <Link href="/campaigns">
              <Button variant="outline" size="lg">
                View All Campaigns
              </Button>
            </Link>
          </div>
        )}
      </motion.div>
      
      {selectedCampaign && (
        <DonateModal
          isOpen={donateModalOpen}
          onClose={() => {
            setDonateModalOpen(false);
            setSelectedCampaign(null);
          }}
          campaign={selectedCampaign}
        />
      )}
    </section>
  );
}

function CampaignCard({
  campaign,
  campaignTotals = {},
  isHovered,
  onHover,
  onLeave,
  onDonate,
}: {
  campaign: any;
  campaignTotals?: Record<string, number>;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onDonate: () => void;
}) {
  // Use calculated total from donations if available, fallback to campaign.raisedInr (in paise)
  const raisedInrRupees = campaignTotals[campaign.id] || (parseInt(campaign.raisedInr || "0") / 100);
  const goalInrRupees = parseFloat(campaign.goalInr || "1");
  const progress = Math.min(
    (raisedInrRupees / goalInrRupees) * 100,
    100
  );

  return (
    <motion.div
      className="flex-shrink-0 w-96"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={`/campaigns/${campaign.id}`}>
        <div className="glass rounded-2xl p-6 hover:bg-white/10 transition-all h-full group cursor-pointer border border-white/10 hover:border-white/20">
          <div className="aspect-video bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
            {campaign.imageUrl ? (
              <img
                src={campaign.imageUrl}
                alt={campaign.title}
                className="w-full h-full object-cover rounded-lg group-hover:scale-110 transition-transform duration-300"
              />
            ) : (
              <div className="text-white/20">
                <CampaignIcon className="w-16 h-16" />
              </div>
            )}
          </div>
          <h3 className="text-xl font-semibold mb-2 group-hover:text-white transition-colors line-clamp-1">
            {campaign.title}
          </h3>
          <p className="text-white/60 mb-4 line-clamp-2 text-sm">
            {campaign.description}
          </p>
          <div className="flex justify-between items-center text-sm mb-3">
            <div>
              <div className="text-white/40 text-xs">Raised</div>
              <div className="font-semibold">₹{raisedInrRupees.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
            </div>
            <div className="text-right">
              <div className="text-white/40 text-xs">Goal</div>
              <div className="font-semibold">₹{goalInrRupees.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
            </div>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <Button 
            className="w-full" 
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDonate();
            }}
          >
            Donate Now
          </Button>
        </div>
      </Link>
    </motion.div>
  );
}
