"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { LockIcon, DocumentIcon, DiamondIcon, IdCardIcon, EyeIcon, ShieldIcon } from "@/components/ui/icons";

const features = [
  {
    Icon: LockIcon,
    title: "Smart Contract Escrow",
    description: "All funds held securely in on-chain vaults until milestones are proven",
  },
  {
    Icon: DocumentIcon,
    title: "Evidence-Based Releases",
    description: "Every withdrawal requires verifiable proof bundles anchored on-chain",
  },
  {
    Icon: DiamondIcon,
    title: "Dual Payment Rails",
    description: "Accept donations in INR (UPI/cards) or crypto with full transparency",
  },
  {
    Icon: IdCardIcon,
    title: "Web3 Identity",
    description: "DID/VC-based KYC without storing PII on-chain for privacy",
  },
  {
    Icon: EyeIcon,
    title: "Public Transparency",
    description: "Complete ledger of all transactions, proofs, and releases publicly verifiable",
  },
  {
    Icon: ShieldIcon,
    title: "Anti-Fraud Protection",
    description: "Duplicate detection, anomaly scoring, and automated safeguards",
  },
];

export function Features() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-16 sm:py-24 md:py-32 container mx-auto px-4 sm:px-6 lg:px-8 bg-black/30">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8 }}
        className="text-center mb-12 sm:mb-16"
      >
        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-4 sm:mb-6 px-2">
          How It
          <br />
          <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Works
          </span>
        </h2>
        <p className="text-base sm:text-lg md:text-xl text-white/60 max-w-2xl mx-auto px-4">
          Built on Web3 principles for maximum transparency and trust
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-7xl mx-auto px-4">
        {features.map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.1, duration: 0.6 }}
            className="glass rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:bg-white/10 transition-all group"
          >
            <div className="text-white/60 mb-4 sm:mb-6 group-hover:scale-110 transition-transform inline-block">
              <feature.Icon className="w-10 h-10 sm:w-12 sm:h-12" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">{feature.title}</h3>
            <p className="text-sm sm:text-base text-white/60 leading-relaxed">{feature.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

