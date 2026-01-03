"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { MoneyIcon } from "@/components/ui/icons";

export function Pricing() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-16 sm:py-24 md:py-32 container mx-auto px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8 }}
        className="max-w-3xl mx-auto text-center"
      >
        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-4 sm:mb-6 px-2">
          Transparent
          <br />
          <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Pricing
          </span>
        </h2>
        <p className="text-base sm:text-lg md:text-xl text-white/60 mb-8 sm:mb-12 px-4">
          Simple, fair pricing with no hidden fees
        </p>

        <div className="glass rounded-xl sm:rounded-2xl p-6 sm:p-8 md:p-12 max-w-2xl mx-auto">
          <div className="text-white/60 mb-4 sm:mb-6 flex justify-center">
            <MoneyIcon className="w-12 h-12 sm:w-16 sm:h-16" />
          </div>
          <div className="text-4xl sm:text-5xl md:text-6xl font-bold mb-3 sm:mb-4">2%</div>
          <div className="text-lg sm:text-xl text-white/60 mb-6 sm:mb-8">Platform Fee</div>
          <p className="text-sm sm:text-base text-white/60 leading-relaxed mb-6 sm:mb-8 px-2">
            All fees go towards maintaining the platform infrastructure,
            ensuring transparency, and supporting the Web3 infrastructure.
            No hidden costs, no surprises.
          </p>
          <ul className="text-left space-y-2 sm:space-y-3 mb-6 sm:mb-8 px-2">
            <li className="flex items-center gap-3">
              <span className="text-green-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </span>
              <span className="text-white/80">Smart contract deployment</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-green-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </span>
              <span className="text-white/80">Evidence anchoring on-chain</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-green-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </span>
              <span className="text-white/80">IPFS storage for proofs</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-green-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </span>
              <span className="text-white/80">24/7 platform support</span>
            </li>
          </ul>
        </div>
      </motion.div>
    </section>
  );
}

