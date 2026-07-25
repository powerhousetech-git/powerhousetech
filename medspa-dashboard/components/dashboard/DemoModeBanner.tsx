import { Button } from "@/components/ui/button";

export function DemoModeBanner({ bookingUrl }: { bookingUrl?: string }) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return null;

  const href = bookingUrl || process.env.NEXT_PUBLIC_BOOKING_URL || "#";

  return (
    <div className="relative z-50 flex items-center justify-between gap-3 bg-primary px-4 py-2 text-xs text-white sm:text-sm">
      <p className="min-w-0 truncate font-medium">
        Demo Mode — Showing sample data for Luxe Glow Med Spa | Powerhouse Tech
      </p>
      <Button
        asChild
        size="sm"
        variant="secondary"
        className="h-7 shrink-0 bg-white/15 text-white hover:bg-white/25"
      >
        <a href={href} target="_blank" rel="noopener noreferrer">
          Book a Call
        </a>
      </Button>
    </div>
  );
}
