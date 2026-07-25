"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatNumber } from "@/lib/utils";

export interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  iconColor?: string;
  highlight?: boolean;
  tooltip?: string;
  animate?: boolean;
  invertChangeColor?: boolean;
}

function useCountUp(target: number, enabled: boolean, duration = 900) {
  const [display, setDisplay] = useState(enabled ? 0 : target);

  useEffect(() => {
    if (!enabled) {
      setDisplay(target);
      return;
    }
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled, duration]);

  return display;
}

export function KPICard({
  title,
  value,
  change,
  changeLabel = "vs prior period",
  icon: Icon,
  iconColor = "#424FD1",
  highlight,
  tooltip,
  animate = false,
  invertChangeColor = false,
}: KPICardProps) {
  const numericValue = typeof value === "number" ? value : null;
  const counted = useCountUp(numericValue ?? 0, animate && numericValue !== null);
  const displayValue =
    numericValue !== null && animate ? formatNumber(counted) : String(value);

  const changePositive = change !== undefined && change >= 0;
  const changeGood = invertChangeColor ? !changePositive : changePositive;

  const body = (
    <Card
      className={cn(
        highlight && "border-primary/40 shadow-glow",
        tooltip && "cursor-help"
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              {title}
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-text-primary">
              {displayValue}
            </p>
            {change !== undefined && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
                {changeGood ? (
                  <TrendingUp className="h-4 w-4 shrink-0 text-accent-green" />
                ) : (
                  <TrendingDown className="h-4 w-4 shrink-0 text-accent-red" />
                )}
                <span
                  className={cn(
                    "font-semibold",
                    changeGood ? "text-accent-green" : "text-accent-red"
                  )}
                >
                  {change > 0 ? "+" : ""}
                  {change}%
                </span>
                <span className="text-text-muted">{changeLabel}</span>
              </div>
            )}
          </div>
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${iconColor}22` }}
          >
            <Icon className="h-5 w-5" style={{ color: iconColor }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!tooltip) return body;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="h-full">{body}</div>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
