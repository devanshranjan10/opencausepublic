"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { UserIcon } from "@/components/ui/icons";

const testimonials = [
  {
    name: "Priya Sharma",
    role: "NGO Organizer",
    text: "OpenCause gave our donors complete transparency. They could see exactly where every rupee went, which built incredible trust.",
  },
  {
    name: "Raj Patel",
    role: "Donor",
    text: "Finally, a platform I can trust. The proof system ensures my donations are used correctly, and I can verify everything on-chain.",
  },
  {
    name: "Anita Desai",
    role: "CSR Manager",
    text: "The dual rail system makes it easy for our company to donate in INR while maintaining full transparency. Game changer.",
  },
];

export function Testimonials() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <section ref={ref} className="py-32 container mx-auto px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8 }}
        className="text-center mb-16"
      >
        <h2 className="text-5xl md:text-7xl font-bold mb-6">
          What People
          <br />
          <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Say
          </span>
        </h2>
      </motion.div>

      <div className="max-w-4xl mx-auto">
        <div className="relative">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: i === currentIndex ? 0 : 50 }}
              animate={{
                opacity: i === currentIndex ? 1 : 0,
                x: i === currentIndex ? 0 : 50,
                display: i === currentIndex ? "block" : "none",
              }}
              transition={{ duration: 0.5 }}
              className="glass rounded-2xl p-12 text-center"
            >
              <div className="text-white/40 mb-6 flex justify-center">
                <UserIcon className="w-16 h-16" />
              </div>
              <p className="text-xl md:text-2xl text-white/80 mb-8 leading-relaxed">
                &quot;{testimonial.text}&quot;
              </p>
              <div>
                <p className="font-semibold text-lg mb-1">{testimonial.name}</p>
                <p className="text-sm text-white/40">{testimonial.role}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Navigation dots */}
        <div className="flex justify-center gap-2 mt-8">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentIndex ? "bg-white w-8" : "bg-white/20"
              }`}
              aria-label={`Go to testimonial ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

