"use client";

import { Star } from "lucide-react";
import { RatingTrendChart } from "@/components/dashboard/charts/RatingTrendChart";
import { ReviewGenerationChart } from "@/components/dashboard/charts/ReviewGenerationChart";
import { SectionReveal } from "@/components/dashboard/SectionReveal";
import { RecentReviewsList } from "@/components/dashboard/widgets/RecentReviewsList";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber, formatPct } from "@/lib/utils";
import type { DashboardData } from "@/types/dashboard";

export function ReviewsSection({ data }: { data: DashboardData }) {
  const { reviews } = data;

  return (
    <SectionReveal id="reviews">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Reviews & Reputation
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Automated review requests after completed appointments
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-text-muted">Reviews this period</p>
            <p className="mt-1 font-mono text-3xl font-bold">
              {formatNumber(reviews.totalReviewsGenerated)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-text-muted">Conversion rate</p>
            <p className="mt-1 font-mono text-3xl font-bold">
              {formatPct(reviews.conversionRate, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-text-muted">Current avg rating</p>
            <p className="mt-1 font-mono text-3xl font-bold text-accent-amber">
              {reviews.currentAvgRating.toFixed(1)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-text-muted">Review request rate</p>
            <p className="mt-1 font-mono text-3xl font-bold">
              {formatPct(reviews.requestSendRate, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <ReviewGenerationChart data={reviews.monthlyReviews} />

      <div className="grid gap-4 lg:grid-cols-2">
        <RatingTrendChart data={reviews.monthlyReviews} />
        <RecentReviewsList reviews={reviews.recentReviews} />
      </div>

      <Card className="border-accent-amber/25 bg-accent-amber/5">
        <CardContent className="flex gap-3 p-5 text-sm leading-relaxed text-text-secondary">
          <Star className="mt-0.5 h-5 w-5 shrink-0 text-accent-amber" />
          <p>
            <span className="font-semibold text-text-primary">Insight: </span>
            Your rating improved from {reviews.previousAvgRating.toFixed(1)} to{" "}
            {reviews.currentAvgRating.toFixed(1)} since automation. Studies show
            each 0.1 star increase on Google results in approximately 5–9% more
            organic inquiries.
          </p>
        </CardContent>
      </Card>
    </SectionReveal>
  );
}
