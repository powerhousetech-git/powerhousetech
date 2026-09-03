import { Badge } from "@/components/ui/badge";
import { SENTIMENT_BADGE_CLASSES } from "@/lib/constants";
import type { EmailSentiment } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SentimentBadgeProps {
  sentiment: EmailSentiment;
  className?: string;
}

const labels: Record<EmailSentiment, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

export function SentimentBadge({ sentiment, className }: SentimentBadgeProps) {
  const colorClass =
    SENTIMENT_BADGE_CLASSES[sentiment] ?? "bg-gray-100 text-gray-700";

  return (
    <Badge
      variant="outline"
      className={cn("border font-medium capitalize", colorClass, className)}
    >
      {labels[sentiment]}
    </Badge>
  );
}
