"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { BackendStatusBadge } from "@/components/backend/backend-status";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { CalendarDays } from "lucide-react";
import { useLanguage } from "@/lib/language";

function getPageTitle(pathname: string, labels: ReturnType<typeof useLanguage>["labels"]): string {
  if (pathname.startsWith("/dashboard")) return labels.dashboard;
  if (pathname.startsWith("/calendar")) return labels.calendar;
  if (pathname.startsWith("/timeline")) return labels.timeline;
  if (pathname.startsWith("/payments")) return labels.payments;
  if (pathname.startsWith("/settings")) return labels.settings;
  return "SelfPlanner";
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { labels } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  React.useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-purple border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  const pageTitle = getPageTitle(pathname, labels);

  return (
    <>
      <AnimatedBackground />
      <div className="relative z-10 min-h-screen">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <main
          className={`transition-all duration-300 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 ${
            collapsed ? "lg:pl-[72px]" : "lg:pl-64"
          }`}
        >
          <header className="safe-area-top sticky top-0 z-20 border-b border-white/10 bg-dark-950/65 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-dark-400">{labels.workspace}</p>
                <p className="text-lg font-semibold text-white">{pageTitle}</p>
              </div>
              <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                <BackendStatusBadge compact className="justify-end" />
                <LanguageToggle className="h-9 rounded-full border-white/10 bg-white/[0.03] text-xs" />
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-dark-300">
                  <CalendarDays className="h-3.5 w-3.5 text-sky-300" />
                  {new Date().toLocaleDateString("vi-VN", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>
          </header>
          <div className="safe-area-bottom page-reveal mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
        <BottomNav />
      </div>
    </>
  );
}
