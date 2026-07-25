"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import type { RevenueImpactData } from "@/types/dashboard";

export interface PaybackWidgetProps {
  paybackDays: RevenueImpactData["paybackDays"];
  totalInvestment: RevenueImpactData["totalInvestment"];
  totalROI: RevenueImpactData["totalROI"];
  roiMultiple?: RevenueImpactData["roiMultiple"];
  buildCost?: number;
}

export function PaybackWidget({
  paybackDays,
  totalInvestment,
  totalROI,
  roiMultiple,
  buildCost = 2000,
}: PaybackWidgetProps) {
  return (
    <Card className="border-primary/25 shadow-glow">
      <CardContent className="p-6 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div className="text-center lg:text-left">
            <p className="font-mono text-7xl font-bold leading-none tracking-tight text-primary sm:text-8xl">
              {paybackDays}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">
              DAYS
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              to recover your full investment
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">
                  Investment
                </p>
                <p className="font-mono text-2xl font-semibold text-text-muted line-through">
                  {formatCurrency(buildCost)}
                </p>
              </div>
              <p className="pb-1 text-text-muted">→</p>
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">
                  Value generated
                </p>
                <p className="font-mono text-3xl font-bold text-accent-green">
                  +{formatCurrency(totalROI)}
                </p>
              </div>
            </div>
            <div>
              <div className="mb-2 flex justify-between text-xs text-text-muted">
                <span>Investment paid back</span>
                {roiMultiple !== undefined && (
                  <span className="text-accent-green">{roiMultiple}× return</span>
                )}
              </div>
              <Progress
                value={100}
                indicatorClassName="bg-accent-green"
                className="h-2.5"
              />
            </div>
            <p className="text-sm text-text-secondary">
              {formatCurrency(totalROI)} total value generated vs{" "}
              {formatCurrency(totalInvestment)} invested
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
