"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AlertBannerProps {
  message: string;
  detail?: string;
  scrollToId?: string;
  onClick?: () => void;
  className?: string;
}

export function AlertBanner({
  message,
  detail,
  scrollToId,
  onClick,
  className,
}: AlertBannerProps) {
  const handleClick = () => {
    onClick?.();
    if (scrollToId) {
      document.getElementById(scrollToId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const interactive = Boolean(onClick || scrollToId);

  return (
    <button
      type="button"
      onClick={interactive ? handleClick : undefined}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border border-accent-amber/30 bg-accent-amber/10 px-4 py-3 text-left transition-colors",
        interactive && "cursor-pointer hover:bg-accent-amber/15",
        !interactive && "cursor-default",
        className
      )}
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent-amber" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">{message}</p>
        {detail && (
          <p className="mt-0.5 text-xs text-text-secondary">{detail}</p>
        )}
      </div>
    </button>
  );
}
