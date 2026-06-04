"use client";

import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/cn";

export function Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (v) => {
    setScrolled(v > 24);
  });

  return (
    <motion.header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background,border-color,backdrop-filter] duration-500",
        scrolled
          ? "border-b border-white/[0.08] bg-[#0a0a0a]/72 backdrop-blur-2xl backdrop-saturate-150"
          : "border-b border-transparent bg-transparent"
      )}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6 md:h-16 md:px-8">
        <a href="#" className="text-[15px] font-semibold tracking-tight text-white">
          Powerhouse
        </a>
        <nav className="hidden items-center gap-8 text-[13px] text-white/55 md:flex">
          <a href="#capabilities" className="transition-colors hover:text-white">
            Capabilities
          </a>
          <a href="#playground" className="transition-colors hover:text-white">
            Playground
          </a>
          <a href="#process" className="transition-colors hover:text-white">
            Process
          </a>
          <a href="#team" className="transition-colors hover:text-white">
            Team
          </a>
        </nav>
        <a href="#book" className="btn-apple text-[13px]">
          Book audit
        </a>
      </div>
    </motion.header>
  );
}
