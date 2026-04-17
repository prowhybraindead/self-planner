import React from "react";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
  compact?: boolean;
}

export function BrandMark({ className, compact = false }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 220 220"
      role="img"
      aria-label="SelfPlanner Brand Mark"
      className={cn("h-10 w-10", className)}
    >
      <defs>
        <linearGradient id="brandNebula" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="45%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
        <radialGradient id="brandGlow" cx="50%" cy="42%" r="58%">
          <stop offset="0%" stopColor="#DBEEFF" stopOpacity="0.95" />
          <stop offset="70%" stopColor="#60A5FA" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="8" y="8" width="204" height="204" rx="54" fill="#050A16" />
      <circle cx="110" cy="108" r="70" fill="url(#brandGlow)" />
      <path
        d="M35 123c14-31 45-49 81-49 28 0 54 9 74 25-14 31-45 49-81 49-28 0-54-9-74-25Z"
        fill="url(#brandNebula)"
        opacity="0.95"
      />
      <circle cx="92" cy="108" r="18" fill="#E9F6FF" />
      <circle cx="92" cy="108" r="11" fill="#A7D7FF" />
      <circle cx="92" cy="108" r="6" fill="#38BDF8" />
      <circle cx="156" cy="74" r="4" fill="#E8F4FF" />
      <circle cx="168" cy="86" r="2.8" fill="#CDE7FF" />
      <circle cx="58" cy="74" r="3.4" fill="#CBE6FF" />
      {!compact ? (
        <path
          d="M45 167c20 12 42 18 65 18 23 0 44-6 65-18"
          fill="none"
          stroke="#60A5FA"
          strokeWidth="7"
          strokeLinecap="round"
          opacity="0.9"
        />
      ) : null}
    </svg>
  );
}
