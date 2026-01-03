"use client";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const steps = [
  {
    number: "01",
    title: "Create Campaign",
    description: "Organizers create campaigns with clear milestones and funding goals. Each campaign gets its own smart contract vault.",
  },
  {
    number: "02",
    title: "Donate",
    description: "Donors contribute in INR (via UPI/cards) or crypto. All funds are escrowed in smart contracts until milestones are proven.",
  },
  {
    number: "03",
    title: "Request Withdrawal",
    description: "Organizers submit evidence bundles proving milestone completion. Evidence is canonicalized, hashed, and pinned to IPFS.",
  },
  {
    number: "04",
    title: "Review & Release",
    description: "Reviewers verify evidence. Once approved, funds are released on-chain to payees. All transactions are publicly verifiable.",
  },
];

export default function HowItWorksPage() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <div className="min-h-screen bg-black">
      <Header />
      <div className="pt-32 pb-20 px-6 lg:px-8">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-20"
          >
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              How It
              <br />
              <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                Works
              </span>
            </h1>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              A simple, transparent process built on Web3 principles
            </p>
          </motion.div>

          <div ref={ref} className="space-y-12">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: i % 2 === 0 ? -50 : 50 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: i * 0.2, duration: 0.6 }}
                className="glass rounded-2xl p-8 md:p-12"
              >
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="text-6xl md:text-8xl font-bold text-white/10 flex-shrink-0">
                    {step.number}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">{step.title}</h2>
                    <p className="text-lg text-white/60 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

