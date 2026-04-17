"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Calendar,
  Clock,
  CreditCard,
  Settings,
} from "lucide-react";
import { useLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";
import { LanguageToggle } from "@/components/ui/language-toggle";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, key: "dashboard" as const },
  { href: "/calendar", icon: Calendar, key: "calendar" as const },
  { href: "/timeline", icon: Clock, key: "timeline" as const },
  { href: "/payments", icon: CreditCard, key: "payments" as const },
  { href: "/settings", icon: Settings, key: "settings" as const },
];

export function BottomNav() {
  const pathname = usePathname();
  const { labels } = useLanguage();

  return (
    <nav className="fixed bottom-2 left-0 right-0 z-50 px-3 lg:hidden safe-area-bottom">
      <div className="mx-auto flex max-w-xl items-center gap-1 rounded-2xl border border-white/10 bg-dark-900/85 px-2 py-1 backdrop-blur-2xl">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-1 flex-col items-center gap-0.5 px-2 py-2"
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
                  isActive ? "bg-sky-400/20" : ""
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 transition-colors",
                    isActive ? "text-sky-300" : "text-dark-400"
                  )}
                />
              </motion.div>
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors",
                  isActive ? "text-sky-300" : "text-dark-400"
                )}
              >
                {labels[item.key]}
              </span>
              {isActive && (
                <motion.div
                  layoutId="bottomnav-active"
                  className="absolute -top-1 h-0.5 w-8 rounded-full bg-sky-300"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
        <LanguageToggle
          compact
          variant="ghost"
          className="h-12 min-w-12 rounded-xl px-2 text-xs text-dark-300 hover:bg-white/5 hover:text-white"
        />
      </div>
    </nav>
  );
}
