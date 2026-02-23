import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[9px] border border-transparent px-6 py-3 text-[0.85rem] font-bold uppercase tracking-[0.05em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-50 font-display [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "btn-primary bg-primary text-primary-foreground hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[0_0_18px_rgba(232,255,71,0.35)]",
        destructive:
          "btn-danger border border-destructive/40 bg-destructive/10 text-destructive hover:-translate-y-0.5 hover:bg-destructive/20 hover:shadow-[0_0_16px_rgba(255,92,92,0.3)]",
        outline: "btn-outline border-[1.5px] border-border2 bg-transparent text-muted-foreground hover:border-muted hover:text-foreground",
        secondary:
          "btn-success bg-success text-primary-foreground hover:-translate-y-0.5 hover:bg-success/90 hover:shadow-[0_0_18px_rgba(71,255,176,0.3)]",
        ghost: "btn-ghost border border-border bg-transparent text-muted-foreground hover:border-border2 hover:text-foreground",
        link: "h-auto border-none p-0 normal-case tracking-normal font-medium font-sans text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6 py-3",
        sm: "btn-sm h-9 px-4 py-2 text-[0.75rem]",
        lg: "h-12 px-8 py-3 text-[0.9rem]",
        icon: "btn-icon h-8 w-8 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
