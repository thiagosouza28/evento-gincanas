import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "tag-pill inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-[0.07em] transition-colors focus:outline-none focus:ring-2 focus:ring-primary/25",
  {
    variants: {
      variant: {
        default: "pill-accent border-primary/25 bg-primary/10 text-primary",
        secondary: "pill-blue border-accent2/25 bg-accent2/10 text-accent2",
        destructive: "border-destructive/35 bg-destructive/10 text-destructive",
        outline: "pill-purple border-accent3/25 bg-accent3/10 text-accent3",
        success: "pill-success border-success/30 bg-success/10 text-success",
        warning: "pill-warn border-warning/30 bg-warning/10 text-warning",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
