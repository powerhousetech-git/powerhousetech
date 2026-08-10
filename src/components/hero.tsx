"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useRef } from "react";
import { RotatingText } from "@/components/ui/rotating-text";

const stats = [
  { value: "₹1L–₹10L+", label: "Per engagement" },
  { value: "10", label: "Production workflows" },
  { value: "7 days", label: "To working demo" },
  { value: "3", label: "Slots this quarter" },
];

const rotatingSystems = [
  "revenue intelligence",
  "churn prevention",
  "finance ops",
  "outbound GTM",
  "support automation",
  "hiring flows",
];

export function Hero() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const meshY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 120]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 60]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.75], [1, reduce ? 1 : 0.25]);

  return (
    <section
      ref={ref}
      className="relative min-h-[100svh] overflow-hidden pt-28 pb-16 md:pt-36 md:pb-24"
    >
      <motion.div className="mesh-canvas" style={{ y: meshY }} aria-hidden="true">
        <div className="mesh-orb mesh-orb-a" />
        <div className="mesh-orb mesh-orb-b" />
        <div className="mesh-orb mesh-orb-c" />
        <div className="hero-beam" />
      </motion.div>
      <div className="grid-noise" aria-hidden="true" />

      <motion.div
        className="relative z-10 mx-auto max-w-6xl px-6 md:px-8"
        style={{ y: contentY, opacity: contentOpacity }}
      >
        <motion.div
          className="mb-8 flex items-center gap-3"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.55 }}
        >
          <span className="hero-mark" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="4" r="2.5" fill="#2997ff" />
              <circle cx="3" cy="15" r="2.5" fill="#2997ff" />
              <circle cx="17" cy="15" r="2.5" fill="#2997ff" />
              <line x1="10" y1="6.5" x2="3" y2="12.5" stroke="#2997ff" strokeWidth="1.2" />
              <line x1="10" y1="6.5" x2="17" y2="12.5" stroke="#2997ff" strokeWidth="1.2" />
            </svg>
          </span>
          <span className="text-[13px] font-medium tracking-wide text-white/50">
            AI automation studio · India
          </span>
        </motion.div>

        {/* Brand name — clear, solid, not gradient */}
        <motion.p
          className="hero-brand"
          initial={{ opacity: 0, y: reduce ? 0 : 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          PowerhouseTech
        </motion.p>

        <motion.h1
          className="mt-4 max-w-[20ch] text-[clamp(1.75rem,4.5vw,2.75rem)] font-medium leading-[1.15] tracking-[-0.03em] text-white/90"
          initial={{ opacity: 0, y: reduce ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.75 }}
        >
          We automate the ops.
          <br />
          You scale the company.
        </motion.h1>

        {/* Dynamic line */}
        <motion.p
          className="mt-6 max-w-2xl text-[clamp(1.125rem,2.5vw,1.5rem)] leading-snug tracking-[-0.02em] text-white/70"
          initial={{ opacity: 0, y: reduce ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.7 }}
        >
          Building{" "}
          <RotatingText words={rotatingSystems} className="font-semibold" />
          <span className="text-white/70"> for India&apos;s B2B SaaS founders.</span>
        </motion.p>

        <motion.p
          className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/45"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.48, duration: 0.65 }}
        >
          Not a freelancer. Not an agency. A focused studio — working demo in 7 days.
        </motion.p>

        <motion.div
          className="mt-10 flex flex-wrap items-center gap-4"
          initial={{ opacity: 0, y: reduce ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.58, duration: 0.65 }}
        >
          <a href="#book" className="btn-apple btn-apple-primary">
            Book free audit
          </a>
          <a href="#capabilities" className="btn-apple btn-apple-secondary">
            See what we build
          </a>
        </motion.div>

        <motion.div
          className="mt-16 md:mt-24"
          initial={{ opacity: 0, y: reduce ? 0 : 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.72, duration: 0.8 }}
        >
          <div className="glass-panel grid grid-cols-2 gap-px overflow-hidden rounded-2xl md:grid-cols-4">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                className="bg-[#0c0c0c]/80 px-5 py-6 md:px-6 md:py-7"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 + i * 0.07 }}
              >
                <p className="text-[22px] font-semibold tracking-tight text-white md:text-[26px]">
                  {s.value}
                </p>
                <p className="mt-1 text-[12px] text-white/45">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 md:flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
        aria-hidden="true"
      >
        <motion.div
          className="flex flex-col items-center gap-2 text-white/30"
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="text-[10px] uppercase tracking-[0.2em]">Scroll</span>
          <div className="h-10 w-px bg-gradient-to-b from-white/50 to-transparent" />
        </motion.div>
      </motion.div>
    </section>
  );
}
