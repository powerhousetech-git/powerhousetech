import { cn } from "@/lib/utils";
import type { FollowUpBucket, MessageStatus } from "@/lib/types";

const msg: Record<MessageStatus, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  sent: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

export function MessageStatusBadge({ status }: { status: MessageStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize", msg[status])}>
      {status}
    </span>
  );
}

const bucket: Record<FollowUpBucket, { label: string; cls: string }> = {
  overdue: { label: "Overdue", cls: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  due_today: { label: "Due Today", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  upcoming: { label: "Upcoming", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  none: { label: "—", cls: "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400" },
};

export function FollowUpBadge({ value }: { value: FollowUpBucket }) {
  const b = bucket[value];
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", b.cls)}>
      {b.label}
    </span>
  );
}
