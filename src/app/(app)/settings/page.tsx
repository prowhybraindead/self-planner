"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Info,
  Loader2,
  LogOut,
  Orbit,
  RefreshCcw,
  Save,
  Shield,
  Sparkles,
  Smartphone,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppSelect, type AppSelectOption } from "@/components/ui/app-select";
import { useAuth } from "@/components/providers/auth-provider";
import { getCurrentUserId, getCurrentUserPayments, supabase } from "@/lib/supabase";
import type { UserSettings } from "@/lib/types";
import {
  getUIPreferencesFromStorage,
  saveUIPreferences,
  type ParallaxMode,
  type StarDensityMode,
} from "@/lib/ui-preferences";
import {
  publishWidgetSnapshot,
  readWidgetSnapshot,
  requestWidgetRefresh,
  WIDGET_SNAPSHOT_EVENT,
  type WidgetSnapshot,
} from "@/lib/widget-bridge";
import {
  getLocalNotificationPermissionState,
  requestLocalNotificationPermission,
  syncRecurringPaymentReminders,
} from "@/lib/native-notifications";
import { isCapacitorNativeRuntime } from "@/lib/platform";
import { formatMoney } from "@/lib/utils";

const notifyOptions = [1, 3, 5, 7, 14];
const notifySelectOptions: AppSelectOption[] = notifyOptions.map((option) => ({
  value: String(option),
  label: formatNotifyOption(option),
}));

function formatNotifyOption(value: number): string {
  if (value === 1) return "1 day";
  if (value === 7) return "1 week";
  if (value === 14) return "2 weeks";
  return `${value} days`;
}

type SchemaHealthStatus = "idle" | "checking" | "healthy" | "degraded";

function extractMissingSchemaColumn(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code !== "PGRST204" || typeof message !== "string") return null;

  const match = message.match(/'([^']+)' column/);
  return match?.[1] ?? null;
}

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function computeNextDueDate(dayOfMonth: number, candidate?: string | null): Date {
  if (candidate) {
    const candidateDate = new Date(`${candidate}T09:00:00`);
    if (!Number.isNaN(candidateDate.getTime())) return candidateDate;
  }

  const now = new Date();
  const currentDay = Math.min(dayOfMonth, getLastDayOfMonth(now.getFullYear(), now.getMonth()));
  const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), currentDay, 9, 0, 0, 0);
  if (currentMonthDate >= now) return currentMonthDate;

  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 9, 0, 0, 0);
  const nextDay = Math.min(dayOfMonth, getLastDayOfMonth(nextMonth.getFullYear(), nextMonth.getMonth()));
  return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), nextDay, 9, 0, 0, 0);
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notifyBeforeDays, setNotifyBeforeDays] = useState(3);
  const [fcmToken, setFcmToken] = useState("");
  const [starDensity, setStarDensity] = useState<StarDensityMode>(() => getUIPreferencesFromStorage().starDensity);
  const [parallaxMode, setParallaxMode] = useState<ParallaxMode>(() => getUIPreferencesFromStorage().parallax);
  const [widgetSnapshot, setWidgetSnapshot] = useState<WidgetSnapshot | null>(null);
  const [schemaStatus, setSchemaStatus] = useState<SchemaHealthStatus>("idle");
  const [schemaMessage, setSchemaMessage] = useState("");
  const [schemaMissingColumns, setSchemaMissingColumns] = useState<string[]>([]);
  const [notificationPermission, setNotificationPermission] = useState("unknown");
  const [syncingReminders, setSyncingReminders] = useState(false);
  const [reminderSyncMessage, setReminderSyncMessage] = useState("");

  const isNativeRuntime = isCapacitorNativeRuntime();

  const loadSettings = useCallback(async (id: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", id)
      .maybeSingle();

    if (error) {
      toast.error("Khong the tai settings", { description: error.message });
      setLoading(false);
      return;
    }

    const row = data as UserSettings | null;
    if (!row) {
      const { error: insertError } = await supabase.from("user_settings").insert({ user_id: id });
      if (insertError) {
        toast.error("Khong the khoi tao settings", { description: insertError.message });
        setLoading(false);
        return;
      }
      setNotificationsEnabled(true);
      setNotifyBeforeDays(3);
      setFcmToken("");
      setLoading(false);
      return;
    }

    setNotificationsEnabled(row.notify_before_days > 0);
    setNotifyBeforeDays(row.notify_before_days > 0 ? row.notify_before_days : 3);
    setFcmToken(row.fcm_token ?? "");
    setLoading(false);
  }, []);

  const checkSchemaHealth = useCallback(async (targetUserId: string) => {
    setSchemaStatus("checking");
    setSchemaMessage("Checking recurring_payments schema...");
    setSchemaMissingColumns([]);

    const requiredColumns = ["payment_method", "currency", "next_due_date"] as const;
    const missingColumns: string[] = [];

    for (const column of requiredColumns) {
      const { error } = await supabase
        .from("recurring_payments")
        .select(`id,${column}`)
        .eq("user_id", targetUserId)
        .limit(1);

      if (!error) continue;

      const missing = extractMissingSchemaColumn(error);
      if (missing) {
        missingColumns.push(missing);
        continue;
      }

      setSchemaStatus("degraded");
      setSchemaMessage(error.message || "Could not verify schema health.");
      return;
    }

    if (missingColumns.length > 0) {
      setSchemaStatus("degraded");
      setSchemaMissingColumns(Array.from(new Set(missingColumns)));
      setSchemaMessage("Schema mismatch detected. Migration is required.");
      return;
    }

    setSchemaStatus("healthy");
    setSchemaMessage("Schema looks good for recurring payments.");
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const id = await getCurrentUserId();
        if (!mounted) return;
        setUserId(id);
        await loadSettings(id);
        await checkSchemaHealth(id);
        const permission = await getLocalNotificationPermissionState();
        if (mounted) {
          setNotificationPermission(permission);
        }
      } catch (error) {
        if (!mounted) return;
        toast.error("Khong the xac thuc nguoi dung", {
          description: error instanceof Error ? error.message : "Vui long dang nhap lai",
        });
        setLoading(false);
      }
    }

    void init();

    return () => {
      mounted = false;
    };
  }, [checkSchemaHealth, loadSettings]);

  useEffect(() => {
    const applySnapshot = () => {
      setWidgetSnapshot(readWidgetSnapshot());
    };

    applySnapshot();
    window.addEventListener(WIDGET_SNAPSHOT_EVENT, applySnapshot);
    window.addEventListener("storage", applySnapshot);

    return () => {
      window.removeEventListener(WIDGET_SNAPSHOT_EVENT, applySnapshot);
      window.removeEventListener("storage", applySnapshot);
    };
  }, []);

  const updateVisualPreferences = useCallback(
    (next: { starDensity?: StarDensityMode; parallax?: ParallaxMode }) => {
      const resolved = {
        starDensity: next.starDensity ?? starDensity,
        parallax: next.parallax ?? parallaxMode,
      };
      setStarDensity(resolved.starDensity);
      setParallaxMode(resolved.parallax);
      saveUIPreferences(resolved);
    },
    [parallaxMode, starDensity],
  );

  const syncPaymentReminders = useCallback(
    async (targetUserId: string, leadDays: number, options?: { silentSuccess?: boolean }) => {
      setSyncingReminders(true);
      setReminderSyncMessage("Syncing payment reminders...");

      try {
        const payments = await getCurrentUserPayments({
          activeOnly: true,
          order: { column: "day_of_month", ascending: true },
        });

        const result = await syncRecurringPaymentReminders(payments, leadDays);
        if (!result.ok) {
          if (result.reason === "unsupported") {
            setReminderSyncMessage("Reminder sync is available on native app only.");
          } else if (result.reason === "permission_denied") {
            setReminderSyncMessage("Notification permission denied.");
            setNotificationPermission("denied");
          } else {
            setReminderSyncMessage(result.message ?? "Could not sync reminders.");
          }
          return;
        }

        const message = `Synced ${result.scheduled} reminders${result.cancelled > 0 ? ` (${result.cancelled} replaced)` : ""}.`;
        setReminderSyncMessage(message);
        if (!options?.silentSuccess) {
          toast.success(message);
        }
      } catch (error) {
        setReminderSyncMessage(error instanceof Error ? error.message : "Could not sync reminders.");
      } finally {
        setSyncingReminders(false);
      }
    },
    []
  );

  const generateWidgetSnapshot = useCallback(async () => {
    if (!userId) return;
    try {
      const payments = await getCurrentUserPayments({
        activeOnly: true,
        order: { column: "day_of_month", ascending: true },
      });

      const nextPayment = payments
        .map((payment) => ({
          ...payment,
          dueDate: computeNextDueDate(payment.day_of_month, payment.next_due_date),
        }))
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

      const upcoming30d = payments
        .map((payment) => computeNextDueDate(payment.day_of_month, payment.next_due_date))
        .filter((dueDate) => {
          const diffDays = (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          return diffDays >= 0 && diffDays <= 30;
        }).length;

      const snapshot: WidgetSnapshot = {
        version: 1,
        generated_at: new Date().toISOString(),
        active_recurring_count: payments.length,
        upcoming_30d_count: upcoming30d,
        next_payment_name: nextPayment?.name ?? null,
        next_payment_amount_label: nextPayment
          ? formatMoney(Number(nextPayment.amount), nextPayment.currency)
          : null,
        next_payment_due_date: nextPayment
          ? `${nextPayment.dueDate.getFullYear()}-${String(nextPayment.dueDate.getMonth() + 1).padStart(2, "0")}-${String(nextPayment.dueDate.getDate()).padStart(2, "0")}`
          : null,
        primary_fx_pair: null,
        primary_fx_value: null,
      };

      await publishWidgetSnapshot(snapshot);
      setWidgetSnapshot(snapshot);
      toast.success("Widget snapshot generated");
    } catch (error) {
      toast.error("Could not generate widget snapshot", {
        description: error instanceof Error ? error.message : "Please try again",
      });
    }
  }, [userId]);

  const saveSettings = async () => {
    if (!userId) return;
    setSaving(true);

    const payload = {
      notify_before_days: notificationsEnabled ? notifyBeforeDays : 0,
      fcm_token: fcmToken.trim() || null,
    };

    const { error } = await supabase
      .from("user_settings")
      .update(payload)
      .eq("user_id", userId);

    if (error) {
      toast.error("Luu settings that bai", { description: error.message });
      setSaving(false);
      return;
    }

    toast.success("Da luu settings");
    if (isNativeRuntime) {
      await syncPaymentReminders(userId, notificationsEnabled ? notifyBeforeDays : 0, {
        silentSuccess: true,
      });
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Da dang xuat");
  };

  const profileInitial = useMemo(() => {
    const email = user?.email ?? "U";
    return email.charAt(0).toUpperCase();
  }, [user?.email]);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">Settings</h1>
          <p className="mt-1 text-sm text-dark-300">Control your account and notification preferences.</p>
        </div>
        <Button onClick={saveSettings} disabled={loading || saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </Button>
      </motion.div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16 text-dark-300">
            <Loader2 className="h-5 w-5 animate-spin" />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/20 text-xl font-semibold text-sky-200 ring-1 ring-sky-400/30">
                  {profileInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-white">{user?.email ?? "Personal User"}</h2>
                  <p className="truncate text-sm text-dark-400">Single-user private workspace</p>
                </div>
                <Badge variant="success">Active</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4 text-amber-300" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div>
                  <p className="text-sm font-medium text-white">Payment reminders</p>
                  <p className="text-xs text-dark-400">Enable push reminders before due dates</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNotificationsEnabled((prev) => !prev)}
                  className={`relative h-7 w-12 rounded-full transition ${
                    notificationsEnabled ? "bg-accent-green" : "bg-dark-600"
                  }`}
                  aria-label="Toggle notifications"
                  aria-pressed={notificationsEnabled}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                      notificationsEnabled ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-sm font-medium text-white">Notify me before</p>
                  <p className="text-xs text-dark-400">Choose lead time for reminder notifications</p>
                </div>
                <AppSelect
                  id="notify_before_days"
                  value={String(notifyBeforeDays)}
                  disabled={!notificationsEnabled}
                  onValueChange={(next) => setNotifyBeforeDays(Number(next))}
                  options={notifySelectOptions}
                  className="min-w-40"
                  searchPlaceholder="Type reminder days..."
                />
              </div>

              <div>
                <label htmlFor="fcm_token" className="mb-1.5 block text-sm font-medium text-dark-300">
                  FCM token (optional)
                </label>
                <input
                  id="fcm_token"
                  value={fcmToken}
                  onChange={(event) => setFcmToken(event.target.value)}
                  placeholder="Paste device push token"
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-dark-400"
                />
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-sm font-medium text-white">Native reminder sync</p>
                <p className="mt-1 text-xs text-dark-400">
                  Permission: {notificationPermission}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={async () => {
                      const granted = await requestLocalNotificationPermission();
                      const permission = await getLocalNotificationPermissionState();
                      setNotificationPermission(permission);
                      if (granted) {
                        toast.success("Notification permission granted");
                      } else {
                        toast.error("Notification permission denied");
                      }
                    }}
                    disabled={!isNativeRuntime}
                  >
                    <Bell className="h-4 w-4" />
                    Allow Notifications
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      if (!userId) return;
                      void syncPaymentReminders(
                        userId,
                        notificationsEnabled ? notifyBeforeDays : 0
                      );
                    }}
                    disabled={!userId || syncingReminders || !isNativeRuntime}
                  >
                    {syncingReminders ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="h-4 w-4" />
                    )}
                    Sync Reminders
                  </Button>
                </div>
                <p className="mt-2 text-xs text-dark-400">
                  {reminderSyncMessage || "Sync local reminders from active recurring payments."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-sky-300" />
                Space Visual FX
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-sm font-medium text-white">Star density</p>
                  <p className="text-xs text-dark-400">Strong = denser stars + more comet bursts</p>
                </div>
                <div className="inline-flex rounded-xl border border-white/12 bg-white/[0.03] p-1">
                  <button
                    type="button"
                    onClick={() => updateVisualPreferences({ starDensity: "light" })}
                    className={`h-9 rounded-lg px-4 text-sm transition ${
                      starDensity === "light"
                        ? "bg-white/12 text-white"
                        : "text-dark-300 hover:text-white"
                    }`}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={() => updateVisualPreferences({ starDensity: "strong" })}
                    className={`h-9 rounded-lg px-4 text-sm transition ${
                      starDensity === "strong"
                        ? "bg-sky-500/25 text-sky-100 ring-1 ring-sky-400/35"
                        : "text-dark-300 hover:text-white"
                    }`}
                  >
                    Strong
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-sm font-medium text-white">Parallax intensity</p>
                  <p className="text-xs text-dark-400">Move stars with pointer and device tilt</p>
                </div>
                <div className="inline-flex rounded-xl border border-white/12 bg-white/[0.03] p-1">
                  <button
                    type="button"
                    onClick={() => updateVisualPreferences({ parallax: "light" })}
                    className={`h-9 rounded-lg px-4 text-sm transition ${
                      parallaxMode === "light"
                        ? "bg-white/12 text-white"
                        : "text-dark-300 hover:text-white"
                    }`}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={() => updateVisualPreferences({ parallax: "strong" })}
                    className={`h-9 rounded-lg px-4 text-sm transition ${
                      parallaxMode === "strong"
                        ? "bg-sky-500/25 text-sky-100 ring-1 ring-sky-400/35"
                        : "text-dark-300 hover:text-white"
                    }`}
                  >
                    Strong
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-sky-400/20 bg-sky-500/5 p-3">
                <p className="flex items-center gap-2 text-xs text-sky-100">
                  <Orbit className="h-3.5 w-3.5" />
                  Applied instantly and saved on this device.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Smartphone className="h-4 w-4 text-emerald-300" />
                Android Widget (Ready)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                {widgetSnapshot ? (
                  <div className="space-y-1.5 text-sm">
                    <p className="text-white">
                      Active recurring:{" "}
                      <span className="font-semibold">{widgetSnapshot.active_recurring_count}</span>
                    </p>
                    <p className="text-dark-300">
                      Upcoming 30d: {widgetSnapshot.upcoming_30d_count}
                    </p>
                    <p className="text-dark-300">
                      Next payment: {widgetSnapshot.next_payment_name ?? "N/A"}
                    </p>
                    <p className="text-xs text-dark-400">
                      Snapshot at {new Date(widgetSnapshot.generated_at).toLocaleString("vi-VN")}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-dark-300">
                    Widget snapshot chưa có. Mở Dashboard để app tạo snapshot đầu tiên.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    void generateWidgetSnapshot();
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                  Generate Snapshot
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    void requestWidgetRefresh();
                    toast.success("Widget refresh request sent");
                  }}
                >
                  <RefreshCcw className="h-4 w-4" />
                  Request Widget Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-sky-300" />
                Schema Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      schemaStatus === "healthy"
                        ? "success"
                        : schemaStatus === "degraded"
                          ? "danger"
                          : "outline"
                    }
                  >
                    {schemaStatus === "checking"
                      ? "Checking"
                      : schemaStatus === "healthy"
                        ? "Healthy"
                        : schemaStatus === "degraded"
                          ? "Mismatch"
                          : "Unknown"}
                  </Badge>
                  <p className="text-xs text-dark-300">{schemaMessage || "Not checked yet."}</p>
                </div>
                {schemaMissingColumns.length > 0 ? (
                  <p className="mt-2 text-xs text-red-300">
                    Missing columns: {schemaMissingColumns.join(", ")}
                  </p>
                ) : null}
              </div>

              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  if (!userId) return;
                  void checkSchemaHealth(userId);
                }}
                disabled={schemaStatus === "checking" || !userId}
              >
                {schemaStatus === "checking" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                Re-check Schema
              </Button>

              {schemaStatus === "degraded" ? (
                <p className="text-xs text-dark-400">
                  Run <span className="text-white">supabase-schema.sql</span> in Supabase SQL Editor, then re-check.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4 text-sky-300" />
                About
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "App Version", value: "1.1.0" },
                { label: "Framework", value: "Next.js 16" },
                { label: "Platform", value: "Web + Capacitor Android" },
                { label: "Theme", value: "Deep Black Starfield" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between border-b border-white/5 py-2 last:border-b-0"
                >
                  <span className="text-sm text-dark-300">{item.label}</span>
                  <span className="text-sm font-medium text-white">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-3">
              {[
                { icon: Shield, label: "Privacy & Security", desc: "Data protected by Supabase RLS" },
                { icon: Smartphone, label: "Android Ready", desc: "FCM token supported for push notifications" },
                { icon: User, label: "Single User Workspace", desc: "Optimized for personal planning flow" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-white/5 p-2">
                      <item.icon className="h-4 w-4 text-dark-300" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <p className="text-xs text-dark-400">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Button
            variant="outline"
            className="w-full gap-2 border-red-400/30 text-red-300 hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-200"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </>
      )}
    </div>
  );
}
