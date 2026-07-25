import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background lg:pl-60">
      <div className="border-b border-border px-6 py-4">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-2 h-4 w-32" />
      </div>
      <div className="space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
