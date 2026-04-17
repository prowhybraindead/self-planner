"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-950 disabled:pointer-events-none disabled:opacity-55 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-accent-navy to-accent-purple text-white hover:-translate-y-0.5 hover:brightness-110 shadow-lg shadow-accent-navy/30",
        destructive: "bg-red-500/90 text-white hover:bg-red-600 hover:-translate-y-0.5",
        outline:
          "border border-sky-200/20 bg-sky-200/[0.07] text-white hover:border-sky-200/35 hover:bg-sky-200/[0.14]",
        secondary: "bg-white/10 text-white hover:bg-white/15 hover:-translate-y-0.5",
        ghost: "text-white/70 hover:bg-white/5 hover:text-white hover:-translate-y-0.5",
        link: "text-accent-purple underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
