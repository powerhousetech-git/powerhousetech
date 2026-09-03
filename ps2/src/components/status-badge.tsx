import { Badge } from "@/components/ui/badge";
import { LEAD_STATUSES, STATUS_BADGE_CLASSES } from "@/lib/constants";
import type { LeadStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: LeadStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = LEAD_STATUSES[status] ?? status;
  const colorClass = STATUS_BADGE_CLASSES[status] ?? "bg-gray-100 text-gray-700";

  return (
    <Badge
      variant="outline"
      className={cn("border font-medium", colorClass, className)}
    >
      {label}
    </Badge>
  );
}
