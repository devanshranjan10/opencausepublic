"use client";

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { LockIcon, CheckIcon, CurrencyIcon } from "@/components/ui/icons";

export function About() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-16 sm:py-24 md:py-32 container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-4 sm:mb-6 md:mb-8 leading-tight px-2">
            Trust by
            <br />
            <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              Default
            </span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/60 leading-relaxed max-w-3xl mx-auto px-4">
            OpenCause escrows all donations in smart contracts. Funds are released
            only when organizers provide proof-backed evidence for each milestone.
            Every transaction is transparent, verifiable, and anchored on-chain.
          </p>
        </motion.div>

        {/* Feature Grid */}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mt-12 sm:mt-16 md:mt-20 px-4">
          {[
            {
              title: "Escrowed Funds",
              description: "All donations held in smart contract vaults until proof is provided",
              Icon: LockIcon,
            },
            {
              title: "Proof-Backed",
              description: "Every withdrawal requires evidence bundles anchored on-chain",
              Icon: CheckIcon,
            },
            {
              title: "Dual Rail",
              description: "Donate in INR or crypto. Full transparency for both",
              Icon: CurrencyIcon,
            },
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.6 }}
              className="glass rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:bg-white/10 transition-all"
            >
              <div className="text-white/60 mb-3 sm:mb-4">
                <feature.Icon className="w-10 h-10 sm:w-12 sm:h-12" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">{feature.title}</h3>
              <p className="text-sm sm:text-base text-white/60 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

