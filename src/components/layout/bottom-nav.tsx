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
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/calendar", icon: Calendar, label: "Calendar" },
  { href: "/timeline", icon: Clock, label: "Timeline" },
  { href: "/payments", icon: CreditCard, label: "Payments" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-2 left-0 right-0 z-50 px-3 lg:hidden safe-area-bottom">
      <div className="mx-auto flex max-w-xl items-center justify-around rounded-2xl border border-white/10 bg-dark-900/85 px-2 py-1 backdrop-blur-2xl">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center gap-0.5 px-3 py-2"
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
                {item.label}
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
      </div>
    </nav>
  );
}
