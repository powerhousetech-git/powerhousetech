import { cn } from "@/lib/utils";
import type { FollowUpStatus, MessageStatus } from "@/lib/types";

const messageStyles: Record<MessageStatus, string> = {
  pending: "bg-sand-200 text-ink-700",
  sent: "bg-sky-100 text-sky-700",
  delivered: "bg-success-bg text-success",
  read: "bg-success-bg text-success",
  failed: "bg-danger-bg text-danger",
};

const followUpStyles: Record<FollowUpStatus, string> = {
  pending: "bg-warn-bg text-warn",
  done: "bg-success-bg text-success",
  overdue: "bg-danger-bg text-danger",
};

const followUpLabels: Record<FollowUpStatus, string> = {
  pending: "Pending",
  done: "Done",
  overdue: "Overdue",
};

export function MessageStatusBadge({ status }: { status: MessageStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
        messageStyles[status] || messageStyles.pending,
      )}
    >
      {status}
    </span>
  );
}

export function FollowUpStatusBadge({ status }: { status: FollowUpStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        followUpStyles[status],
      )}
    >
      {followUpLabels[status]}
    </span>
  );
}
