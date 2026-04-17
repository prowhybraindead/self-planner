"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, ...props }, ref) => {
    if (icon) {
      return (
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400">
            {icon}
          </div>
          <input
            type={type}
            className={cn(
              "flex h-11 w-full rounded-xl border border-slate-300/15 bg-slate-200/[0.04] px-4 py-2 pl-10 text-sm text-white placeholder:text-dark-400 transition-all duration-200",
              "focus:border-sky-300/50 focus:bg-slate-200/[0.08] focus:outline-none focus:ring-2 focus:ring-sky-300/20 focus:ring-offset-2 focus:ring-offset-dark-950",
              "disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
            ref={ref}
            {...props}
          />
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-slate-300/15 bg-slate-200/[0.04] px-4 py-2 text-sm text-white placeholder:text-dark-400 transition-all duration-200",
          "focus:border-sky-300/50 focus:bg-slate-200/[0.08] focus:outline-none focus:ring-2 focus:ring-sky-300/20 focus:ring-offset-2 focus:ring-offset-dark-950",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
