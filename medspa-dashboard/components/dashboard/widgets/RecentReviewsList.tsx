"use client";

import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReviewData } from "@/types/dashboard";

export interface RecentReviewsListProps {
  reviews: ReviewData["recentReviews"];
  className?: string;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < rating
              ? "fill-accent-amber text-accent-amber"
              : "text-border"
          )}
        />
      ))}
    </div>
  );
}

export function RecentReviewsList({ reviews, className }: RecentReviewsListProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Recent reviews</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="rounded-xl border border-border bg-surface-hover/40 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary-light"
                  aria-label="Patient initials"
                >
                  {review.initials}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StarRow rating={review.rating} />
                    {review.daysAgo <= 7 && (
                      <Badge variant="success" className="text-[10px]">
                        New
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {review.treatment} · {review.platform} · {review.daysAgo}d ago
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary line-clamp-3">
              {review.text}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
