import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/20 text-primary-light",
        secondary: "border-border bg-surface-hover text-text-secondary",
        success: "border-transparent bg-accent-green/15 text-accent-green",
        danger: "border-transparent bg-accent-red/15 text-accent-red",
        warning: "border-transparent bg-accent-amber/15 text-accent-amber",
        outline: "border-border text-text-secondary",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
