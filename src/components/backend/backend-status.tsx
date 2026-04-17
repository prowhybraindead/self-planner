"use client";

import * as React from "react";
import { Activity, AlertTriangle, RefreshCcw, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { API_URL, isBackendApiEnabled } from "@/lib/api";
import { useLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";

type BackendHealthState = "checking" | "healthy" | "offline";

type BackendHealthResult = {
  ok: boolean;
  checkedAt: string;
  message?: string;
};

function getHealthEndpoint(): string {
  return `${API_URL.replace(/\/api$/, "")}/health`;
}

async function checkBackendHealth(signal?: AbortSignal): Promise<BackendHealthResult> {
  const response = await fetch(getHealthEndpoint(), {
    method: "GET",
    cache: "no-store",
    signal,
  });

  let message = "Backend is reachable";
  try {
    const data = (await response.json()) as { message?: string };
    if (typeof data.message === "string" && data.message.trim()) {
      message = data.message;
    }
  } catch {
    // Ignore JSON parse errors and fall back to defaults.
  }

  return {
    ok: response.ok,
    checkedAt: new Date().toISOString(),
    message,
  };
}

export function BackendStatusBadge({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [state, setState] = React.useState<BackendHealthState>("checking");
  const [checkedAt, setCheckedAt] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string>("Checking backend...");
  const { labels } = useLanguage();

  const refresh = React.useCallback(async () => {
    if (!isBackendApiEnabled) {
      setState("healthy");
      setCheckedAt(new Date().toISOString());
      setMessage(labels.backendUsingSupabase);
      return;
    }

    setState("checking");
    setMessage(labels.backendChecking);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4500);

    try {
      const result = await checkBackendHealth(controller.signal);
      setState(result.ok ? "healthy" : "offline");
      setCheckedAt(result.checkedAt);
      setMessage(result.ok ? result.message ?? labels.backendOnline : labels.backendOffline);
    } catch {
      setState("offline");
      setCheckedAt(new Date().toISOString());
      setMessage(labels.backendOffline);
    } finally {
      window.clearTimeout(timeout);
    }
  }, [labels.backendChecking, labels.backendOffline, labels.backendOnline, labels.backendUsingSupabase]);

  React.useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 60000);

    return () => window.clearInterval(interval);
  }, [refresh]);

  const statusClasses =
    state === "healthy"
      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
      : state === "offline"
        ? "border-rose-400/25 bg-rose-500/10 text-rose-100"
        : "border-amber-400/25 bg-amber-500/10 text-amber-100";

  const label =
    state === "healthy" ? labels.backendOnline : state === "offline" ? labels.backendOffline : labels.backendChecking;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
          statusClasses
        )}
      >
        {state === "checking" ? (
          <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
        ) : state === "healthy" ? (
          <Activity className="h-3.5 w-3.5" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5" />
        )}
        {label}
      </span>

      {!compact ? (
        <span className="hidden text-xs text-dark-300 sm:inline">{message}</span>
      ) : null}

      {checkedAt ? (
        <span className="hidden text-[11px] text-dark-400 md:inline">
          {new Date(checkedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
        </span>
      ) : null}
    </div>
  );
}

export function BackendStatusCard() {
  const [state, setState] = React.useState<BackendHealthState>("checking");
  const [checkedAt, setCheckedAt] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string>("Checking backend...");
  const { language, labels } = useLanguage();

  const refresh = React.useCallback(async () => {
    if (!isBackendApiEnabled) {
      setState("healthy");
      setCheckedAt(new Date().toISOString());
      setMessage("Frontend is using Supabase directly");
      return;
    }

    setState("checking");
    setMessage("Checking backend...");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4500);

    try {
      const result = await checkBackendHealth(controller.signal);
      setState(result.ok ? "healthy" : "offline");
      setCheckedAt(result.checkedAt);
      setMessage(result.ok ? result.message ?? "Backend online" : "Backend responded with an error");
    } catch {
      setState("offline");
      setCheckedAt(new Date().toISOString());
      setMessage("Backend offline or unreachable");
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const badgeClasses =
    state === "healthy"
      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
      : state === "offline"
        ? "border-rose-400/25 bg-rose-500/10 text-rose-100"
        : "border-amber-400/25 bg-amber-500/10 text-amber-100";

  return (
    <Card className="border-white/10 bg-white/[0.03] p-0">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-2xl border",
              badgeClasses
            )}
          >
            <Server className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">{labels.backendServer}</p>
            <p className="text-sm text-dark-300">{message}</p>
            <p className="text-[11px] text-dark-400">{labels.mainServer1}</p>
            {checkedAt ? (
              <p className="text-[11px] text-dark-400">
                {labels.lastCheck}: {new Date(checkedAt).toLocaleString(language === "vi" ? "vi-VN" : "en-US")}
              </p>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="self-start border-white/10 bg-white/[0.03]"
          onClick={() => void refresh()}
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          {labels.refresh}
        </Button>
      </CardContent>
    </Card>
  );
}
