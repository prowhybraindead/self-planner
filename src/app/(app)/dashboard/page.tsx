"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  addMonths,
  format as fnsFormat,
  getDate,
  isAfter,
  isBefore,
} from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  BarChart3,
  CalendarClock,
  Clock3,
  CreditCard,
  Loader2,
  PlusCircle,
  RefreshCcw,
  Sparkles,
  SquarePen,
  Wallet,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackendStatusCard } from "@/components/backend/backend-status";
import { useLanguage } from "@/lib/language";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate, formatMoney } from "@/lib/utils";
import {
  getCurrentUserId,
  getCurrentUserPayments,
  getRecentTimelineEvents,
  subscribeToPayments,
  subscribeToTimeline,
  supabase,
} from "@/lib/supabase";
import {
  publishWidgetSnapshot,
  type WidgetSnapshot,
} from "@/lib/widget-bridge";
import {
  calendarEventSchema,
  timelineEventSchema,
  type CalendarEventFormValues,
  type CalendarEventValues,
  type RecurringPayment,
  type TimelineEvent,
  type TimelineEventFormValues,
  type TimelineEventValues,
} from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────

type UpcomingPayment = RecurringPayment & {
  dueDate: Date;
  daysLeft: number;
};

type FxHistoryPoint = {
  at: string;
  rates: Record<string, number>;
};

const fxTrackedCurrencies = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "SGD",
  "AUD",
] as const;

// ─── Date helpers (using date-fns) ───────────────────────────

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function computeDueDate(payment: RecurringPayment): Date {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Prefer stored next_due_date if still in the future
  if (payment.next_due_date) {
    const nextDueDate = new Date(`${payment.next_due_date}T00:00:00`);
    if (
      isAfter(nextDueDate, today) ||
      getDate(nextDueDate) === getDate(today)
    ) {
      return nextDueDate;
    }
  }

  const year = now.getFullYear();
  const month = now.getMonth();

  // Try this month
  const thisMonthDay = Math.min(
    payment.day_of_month,
    getLastDayOfMonth(year, month)
  );
  const thisMonthDate = new Date(year, month, thisMonthDay);
  if (
    isAfter(thisMonthDate, today) ||
    getDate(thisMonthDate) === getDate(today)
  ) {
    return thisMonthDate;
  }

  // Fallback: next month
  const next = addMonths(now, 1);
  const adjustedYear = next.getFullYear();
  const adjustedMonth = next.getMonth();
  const nextMonthDay = Math.min(
    payment.day_of_month,
    getLastDayOfMonth(adjustedYear, adjustedMonth)
  );

  return new Date(adjustedYear, adjustedMonth, nextMonthDay);
}

function toDaysLeft(target: Date): number {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const diffMs = target.getTime() - startOfToday.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function dateInputToIso(value: string, isEnd = false): string {
  const time = isEnd ? "T18:00:00" : "T09:00:00";
  return new Date(`${value}${time}`).toISOString();
}

function todayInputValue(): string {
  return fnsFormat(new Date(), "yyyy-MM-dd");
}

// ─── Form error helper ───────────────────────────────────────

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-300">{message}</p>;
}

// ─── Sparkline builder ───────────────────────────────────────

function buildSparkline(
  values: number[],
  width: number,
  height: number,
  padding: number
) {
  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step =
    values.length === 1 ? 0 : (width - padding * 2) / (values.length - 1);

  const points = values.map((value, index) => {
    const x = padding + index * step;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const linePath = points
    .map((point, index) =>
      index === 0
        ? `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
        : `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    )
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const areaPath = [
    `M ${first.x.toFixed(2)} ${(height - padding).toFixed(2)}`,
    ...points.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`),
    `L ${last.x.toFixed(2)} ${(height - padding).toFixed(2)}`,
    "Z",
  ].join(" ");

  return {
    linePath,
    areaPath,
    lastPoint: last,
    min,
    max,
  };
}

// ─── Dashboard page ──────────────────────────────────────────

export default function DashboardPage() {
  const { labels } = useLanguage();
  const lastWidgetPayloadRef = useRef<string>("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [quickSaving, setQuickSaving] = useState<
    "timeline" | "calendar" | null
  >(null);
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [payments, setPayments] = useState<RecurringPayment[]>([]);
  const [recentActivities, setRecentActivities] = useState<TimelineEvent[]>([]);
  const [exchangeRatesVnd, setExchangeRatesVnd] = useState<
    Record<string, number>
  >({ VND: 1 });
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string | null>(null);
  const [ratesHistory, setRatesHistory] = useState<FxHistoryPoint[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<
    (typeof fxTrackedCurrencies)[number]
  >("USD");

  // ─── Forms ───────────────────────────────────────────────

  const {
    register: registerTimeline,
    handleSubmit: handleSubmitTimeline,
    reset: resetTimelineForm,
    formState: { errors: timelineErrors },
  } = useForm<TimelineEventFormValues, unknown, TimelineEventValues>({
    resolver: zodResolver(timelineEventSchema),
    defaultValues: {
      title: "",
      description: "",
      date: todayInputValue(),
      status: "pending",
      category: "personal",
    },
  });

  const {
    register: registerCalendar,
    handleSubmit: handleSubmitCalendar,
    reset: resetCalendarForm,
    formState: { errors: calendarErrors },
  } = useForm<CalendarEventFormValues, unknown, CalendarEventValues>({
    resolver: zodResolver(calendarEventSchema),
    defaultValues: {
      title: "",
      description: "",
      start_date: todayInputValue(),
      end_date: "",
      is_recurring: false,
      recurrence_rule: "",
      color: "#38bdf8",
    },
  });

  // ─── Load initial data ───────────────────────────────────

  const fetchPayments = useCallback(async () => {
    try {
      const data = await getCurrentUserPayments({ activeOnly: true });
      setPayments(data);
    } catch (error) {
      toast.error("Không thể tải payments", {
        description:
          error instanceof Error ? error.message : "Vui lòng thử lại",
      });
    }
  }, []);

  const fetchActivities = useCallback(async () => {
    try {
      const data = await getRecentTimelineEvents(5);
      setRecentActivities(data);
    } catch {
      // Silent: activities are secondary data
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setLoading(true);

      try {
        const uid = await getCurrentUserId();
        if (!mounted) return;
        setUserId(uid);

        await Promise.all([fetchPayments(), fetchActivities()]);
      } catch (error) {
        if (!mounted) return;

        toast.error("Không thể tải dashboard", {
          description:
            error instanceof Error
              ? error.message
              : "Vui lòng thử lại",
        });
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, [fetchPayments, fetchActivities]);

  // ─── Realtime subscriptions ──────────────────────────────

  useEffect(() => {
    if (!userId) return;

    const paymentsChannel = subscribeToPayments(userId, () => {
      void fetchPayments();
    });

    const timelineChannel = subscribeToTimeline(userId, () => {
      void fetchActivities();
    });

    return () => {
      void supabase.removeChannel(paymentsChannel);
      void supabase.removeChannel(timelineChannel);
    };
  }, [fetchPayments, fetchActivities, userId]);

  // ─── Dialog helpers ──────────────────────────────────────

  const openTimelineDialog = () => {
    resetTimelineForm({
      title: "",
      description: "",
      date: todayInputValue(),
      status: "pending",
      category: "personal",
    });
    setTimelineDialogOpen(true);
  };

  const openCalendarDialog = () => {
    resetCalendarForm({
      title: "",
      description: "",
      start_date: todayInputValue(),
      end_date: "",
      is_recurring: false,
      recurrence_rule: "",
      color: "#38bdf8",
    });
    setCalendarDialogOpen(true);
  };

  // ─── Quick create handlers ───────────────────────────────

  const createTimelineQuick = async (values: TimelineEventValues) => {
    if (!userId) {
      toast.error("Không tìm thấy user", {
        description: "Vui lòng đăng nhập lại",
      });
      return;
    }

    setQuickSaving("timeline");

    const { data, error } = await supabase
      .from("timeline_events")
      .insert({
        user_id: userId,
        title: values.title.trim(),
        description: values.description?.trim() || null,
        date: values.date,
        status: values.status,
        category: values.category?.trim().toLowerCase() || null,
      })
      .select("*")
      .single();

    if (error) {
      toast.error("Không thể tạo timeline event", {
        description: error.message,
      });
      setQuickSaving(null);
      return;
    }

    setRecentActivities((prev) =>
      [data as TimelineEvent, ...prev].slice(0, 5)
    );
    setTimelineDialogOpen(false);
    setQuickSaving(null);
    toast.success("Đã tạo timeline event");
  };

  const createCalendarQuick = async (values: CalendarEventValues) => {
    if (!userId) {
      toast.error("Không tìm thấy user", {
        description: "Vui lòng đăng nhập lại",
      });
      return;
    }

    setQuickSaving("calendar");

    const { error } = await supabase.from("calendar_events").insert({
      user_id: userId,
      title: values.title.trim(),
      description: values.description?.trim() || null,
      start_date: dateInputToIso(values.start_date),
      end_date: values.end_date
        ? dateInputToIso(values.end_date, true)
        : null,
      is_recurring: values.is_recurring,
      recurrence_rule: values.is_recurring
        ? values.recurrence_rule?.trim() || null
        : null,
      color: values.color,
    });

    if (error) {
      toast.error("Không thể tạo calendar event", {
        description: error.message,
      });
      setQuickSaving(null);
      return;
    }

    setCalendarDialogOpen(false);
    setQuickSaving(null);
    toast.success("Đã tạo calendar event");
  };

  // ─── FX rates ────────────────────────────────────────────

  const fetchRates = useCallback(async (silent = false) => {
    setRatesLoading(true);
    try {
      const response = await fetch(
        "https://open.er-api.com/v6/latest/VND"
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as {
        result?: string;
        time_last_update_utc?: string;
        rates?: Record<string, number>;
      };

      if (payload.result !== "success" || !payload.rates) {
        throw new Error("Invalid exchange payload");
      }

      const map: Record<string, number> = { VND: 1 };
      for (const currency of fxTrackedCurrencies) {
        const unitPerVnd = payload.rates[currency];
        if (typeof unitPerVnd === "number" && unitPerVnd > 0) {
          map[currency] = 1 / unitPerVnd;
        }
      }

      setExchangeRatesVnd(map);
      const updatedAt =
        payload.time_last_update_utc ?? new Date().toISOString();
      setRatesUpdatedAt(updatedAt);
      setRatesHistory((previous) =>
        [...previous, { at: updatedAt, rates: map }].slice(-120)
      );
    } catch (error) {
      if (!silent) {
        toast.error("Không thể cập nhật tỷ giá", {
          description:
            error instanceof Error ? error.message : "Sử dụng giá trị mặc định",
        });
      }
      setExchangeRatesVnd({ VND: 1 });
    } finally {
      setRatesLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRates(false);

    const intervalId = window.setInterval(() => {
      void fetchRates(true);
    }, 60 * 1000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchRates(true);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchRates]);

  // ─── Computed values ─────────────────────────────────────

  const upcomingIn30Days = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 30);

    const list: UpcomingPayment[] = payments
      .map((payment) => {
        const dueDate = computeDueDate(payment);
        return {
          ...payment,
          dueDate,
          daysLeft: toDaysLeft(dueDate),
        };
      })
      .filter(
        (payment) =>
          (isAfter(payment.dueDate, today) ||
            getDate(payment.dueDate) === getDate(today)) &&
          isBefore(payment.dueDate, horizon)
      )
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    return list;
  }, [payments]);

  const nextPayment = upcomingIn30Days[0] ?? null;

  const upcomingTotalsByCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    for (const payment of upcomingIn30Days) {
      const currency = (payment.currency || "VND").toUpperCase();
      totals.set(currency, (totals.get(currency) ?? 0) + Number(payment.amount));
    }
    return Array.from(totals.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [upcomingIn30Days]);

  const upcomingAmountLabel = useMemo(() => {
    if (upcomingTotalsByCurrency.length === 0) return "No amount";
    if (upcomingTotalsByCurrency.length === 1) {
      const [currency, total] = upcomingTotalsByCurrency[0];
      return formatMoney(total, currency);
    }
    return `${upcomingTotalsByCurrency.length} currencies`;
  }, [upcomingTotalsByCurrency]);

  const totalThisMonth = useMemo(() => {
    // Also include active payments NOT in the 30-day window
    const notUpcoming = payments.filter(
      (p) => !upcomingIn30Days.find((u) => u.id === p.id)
    );

    const otherTotals = new Map<string, number>();
    for (const payment of notUpcoming) {
      const currency = (payment.currency || "VND").toUpperCase();
      otherTotals.set(
        currency,
        (otherTotals.get(currency) ?? 0) + Number(payment.amount)
      );
    }

    const allTotals = new Map(upcomingTotalsByCurrency);
    for (const [currency, total] of otherTotals) {
      allTotals.set(currency, (allTotals.get(currency) ?? 0) + total);
    }

    const entries = Array.from(allTotals.entries());
    if (entries.length === 0) return { label: "0 ₫", entries: [] };
    if (entries.length === 1) {
      const [currency, total] = entries[0];
      return { label: formatMoney(total, currency), entries };
    }
    return {
      label: entries
        .slice(0, 2)
        .map(([c, t]) => formatMoney(t, c))
        .join(" + "),
      entries,
    };
  }, [payments, upcomingIn30Days, upcomingTotalsByCurrency]);

  const fxSnapshots = useMemo(() => {
    return fxTrackedCurrencies
      .map(
        (currency) => [currency, exchangeRatesVnd[currency]] as const
      )
      .filter(([, rate]) => typeof rate === "number" && rate > 0);
  }, [exchangeRatesVnd]);

  const fxRows = useMemo(() => {
    return fxSnapshots.map(([currency, current]) => {
      const previous =
        ratesHistory.length > 1
          ? ratesHistory[ratesHistory.length - 2]?.rates[currency]
          : undefined;
      const delta = typeof previous === "number" ? current - previous : null;
      const deltaPct =
        typeof previous === "number" && previous !== 0
          ? ((current - previous) / previous) * 100
          : null;
      return {
        currency,
        current,
        previous: typeof previous === "number" ? previous : null,
        delta,
        deltaPct,
      };
    });
  }, [fxSnapshots, ratesHistory]);

  const selectedRow = useMemo(
    () => fxRows.find((row) => row.currency === selectedCurrency) ?? null,
    [fxRows, selectedCurrency]
  );

  const selectedSeries = useMemo(() => {
    const values = ratesHistory
      .map((point) => point.rates[selectedCurrency])
      .filter((rate): rate is number => typeof rate === "number" && rate > 0);

    if (values.length === 0 && selectedRow) {
      return [selectedRow.current];
    }
    return values;
  }, [ratesHistory, selectedCurrency, selectedRow]);

  const chart = useMemo(
    () => buildSparkline(selectedSeries, 360, 120, 12),
    [selectedSeries]
  );

  // ─── Widget snapshot ─────────────────────────────────────

  const widgetSnapshot = useMemo<WidgetSnapshot>(() => {
    const nextDueDate = nextPayment
      ? formatDate(nextPayment.dueDate)
      : null;
    const nextAmount = nextPayment
      ? formatMoney(Number(nextPayment.amount), nextPayment.currency)
      : null;
    const primaryPair = selectedRow
      ? `${selectedRow.currency}/VND`
      : null;

    return {
      version: 1,
      generated_at: new Date().toISOString(),
      active_recurring_count: payments.length,
      upcoming_30d_count: upcomingIn30Days.length,
      next_payment_name: nextPayment?.name ?? null,
      next_payment_amount_label: nextAmount,
      next_payment_due_date: nextDueDate,
      primary_fx_pair: primaryPair,
      primary_fx_value: selectedRow?.current ?? null,
      notes: "Generated by dashboard sync",
    };
  }, [nextPayment, payments.length, selectedRow, upcomingIn30Days.length]);

  useEffect(() => {
    const serialized = JSON.stringify({
      ...widgetSnapshot,
      generated_at: "stable",
    });

    if (serialized === lastWidgetPayloadRef.current) return;
    lastWidgetPayloadRef.current = serialized;

    void publishWidgetSnapshot(widgetSnapshot);
  }, [widgetSnapshot]);

  // ─── Render ──────────────────────────────────────────────

  return (
    <div className="relative space-y-6 overflow-hidden">
      {/* ─── Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative"
      >
        <div className="pointer-events-none absolute -top-8 right-0 h-28 w-28 rounded-full bg-accent-navy/20 blur-2xl" />
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          {labels.dashboard}
        </h1>
        <p className="mt-1 text-sm text-dark-300">
          {labels.managePersonalEvents}
        </p>
      </motion.div>

      <BackendStatusCard />

      {/* ─── Summary cards ─── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Upcoming count */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
        >
          <Card className="h-full">
            <CardContent className="space-y-2 p-5">
              <div className="flex items-center gap-2 text-dark-400">
                <Wallet className="h-4 w-4" />
                <p className="text-xs uppercase tracking-wide">
                  {labels.upcoming30Days}
                </p>
              </div>
              <p className="text-2xl font-semibold text-white">
                {loading ? "..." : `${upcomingIn30Days.length} ${labels.payment}`}
              </p>
              <p className="text-sm text-dark-300">
                {loading ? "..." : upcomingAmountLabel}
              </p>
              {!loading && upcomingTotalsByCurrency.length > 1 ? (
                <p className="line-clamp-2 text-xs text-dark-400">
                  {upcomingTotalsByCurrency
                    .slice(0, 3)
                    .map(([currency, total]) => formatMoney(total, currency))
                    .join(" • ")}
                </p>
              ) : (
                <p className="text-xs text-dark-400">
                  {labels.groupedByOriginalCurrency}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Total this month */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          <Card className="h-full">
            <CardContent className="space-y-2 p-5">
              <div className="flex items-center gap-2 text-dark-400">
                <TrendingUp className="h-4 w-4" />
                <p className="text-xs uppercase tracking-wide">
                  {labels.totalThisMonth}
                </p>
              </div>
              <p className="text-2xl font-semibold text-white">
                {loading ? "..." : totalThisMonth.label}
              </p>
              <p className="text-xs text-dark-400">
                {labels.activeRecurring} - {labels.subscriptionsCurrentlyActive}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Next payment */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.09 }}
        >
          <Card className="h-full">
            <CardContent className="space-y-2 p-5">
              <div className="flex items-center gap-2 text-dark-400">
                <CalendarClock className="h-4 w-4" />
                <p className="text-xs uppercase tracking-wide">
                  {labels.nextPayment}
                </p>
              </div>
              {loading ? (
                <p className="text-sm text-dark-300">{labels.loading}</p>
              ) : nextPayment ? (
                <>
                  <p className="truncate text-lg font-semibold text-white">
                    {nextPayment.name}
                  </p>
                  <p className="text-sm text-dark-300">
                    {formatMoney(
                      Number(nextPayment.amount),
                      nextPayment.currency
                    )}
                  </p>
                  <p className="text-xs text-dark-400">
                    {nextPayment.daysLeft} {labels.daysLeft}
                  </p>
                </>
              ) : (
                <p className="text-sm text-dark-300">
                  {labels.noUpcomingPayment}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Active count */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <Card className="h-full">
            <CardContent className="space-y-2 p-5">
              <div className="flex items-center gap-2 text-dark-400">
                <CreditCard className="h-4 w-4" />
                <p className="text-xs uppercase tracking-wide">
                  {labels.activeRecurring}
                </p>
              </div>
              <p className="text-2xl font-semibold text-white">
                {loading ? "..." : payments.length}
              </p>
              <p className="text-xs text-dark-400">
                {labels.subscriptionsCurrentlyActive}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── Quick actions ─── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card>
          <CardContent className="space-y-4 p-5">
            <p className="text-xs uppercase tracking-wide text-dark-400">
              {labels.quickActions}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/payments">
                <Button className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  {labels.addPayment}
                </Button>
              </Link>
              <Button
                variant="outline"
                className="gap-2"
                onClick={openTimelineDialog}
              >
                <SquarePen className="h-4 w-4" />
                {labels.timeline}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={openCalendarDialog}
              >
                <PlusCircle className="h-4 w-4" />
                {labels.calendar}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── FX rates ─── */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-dark-400">
              {labels.currentExchangeRates}
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {ratesLoading ? labels.refreshing : labels.realtime60s}
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => {
                  void fetchRates(false);
                }}
                disabled={ratesLoading}
              >
                {ratesLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCcw className="h-3.5 w-3.5" />
                )}
                {labels.refresh}
              </Button>
            </div>
          </div>
          {fxSnapshots.length === 0 ? (
            <p className="text-sm text-dark-300">
              {labels.couldNotLoadExchangeRates}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {fxRows.map((row) => {
                  const isSelected = row.currency === selectedCurrency;
                  return (
                    <Button
                      key={row.currency}
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      className="min-w-16"
                      onClick={() =>
                        setSelectedCurrency(
                          row.currency as (typeof fxTrackedCurrencies)[number]
                        )
                      }
                    >
                      {row.currency}
                    </Button>
                  );
                })}
              </div>

              {selectedRow ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-dark-400">
                        {labels.selectedPair}
                      </p>
                      <p className="text-lg font-semibold text-white">
                        1 {selectedRow.currency} ={" "}
                        {formatCurrency(selectedRow.current)}
                      </p>
                    </div>
                    {selectedRow.delta !== null ? (
                      <Badge
                        variant={
                          selectedRow.delta > 0
                            ? "danger"
                            : selectedRow.delta < 0
                              ? "success"
                              : "outline"
                        }
                        className="gap-1"
                      >
                        {selectedRow.delta > 0 ? (
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        ) : null}
                        {selectedRow.delta < 0 ? (
                          <ArrowDownRight className="h-3.5 w-3.5" />
                        ) : null}
                        {selectedRow.delta > 0 ? "+" : ""}
                        {selectedRow.delta.toFixed(2)} VND
                        {selectedRow.deltaPct !== null
                          ? ` (${selectedRow.deltaPct > 0 ? "+" : ""}${selectedRow.deltaPct.toFixed(2)}%)`
                          : ""}
                      </Badge>
                    ) : (
                        <Badge variant="outline">
                          {labels.noPreviousSnapshot}
                        </Badge>
                    )}
                  </div>

                  {chart ? (
                    <div className="rounded-xl border border-white/10 bg-dark-900/40 p-2">
                      <div className="mb-1 flex items-center justify-between px-2 text-[11px] text-dark-400">
                        <span className="inline-flex items-center gap-1">
                          <BarChart3 className="h-3.5 w-3.5" />
                          {labels.trend} ({selectedSeries.length} {labels.latestPoints})
                        </span>
                        <span>
                        {labels.range}: {formatCurrency(chart.min)} -{" "}
                        {formatCurrency(chart.max)}
                        </span>
                      </div>
                      <svg
                        viewBox="0 0 360 120"
                        className="h-28 w-full"
                      >
                        <defs>
                          <linearGradient
                            id="fxArea"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="rgba(56,189,248,0.45)"
                            />
                            <stop
                              offset="100%"
                              stopColor="rgba(56,189,248,0.02)"
                            />
                          </linearGradient>
                        </defs>
                        <path d={chart.areaPath} fill="url(#fxArea)" />
                        <path
                          d={chart.linePath}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        <circle
                          cx={chart.lastPoint.x}
                          cy={chart.lastPoint.y}
                          r="3.8"
                          fill="#e2f4ff"
                        />
                      </svg>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {fxRows.map((row) => (
                  <div
                    key={row.currency}
                    className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white">
                        {row.currency}/VND
                      </p>
                      {row.delta !== null ? (
                        <span
                          className={`text-xs ${
                            row.delta > 0
                              ? "text-rose-300"
                              : row.delta < 0
                                ? "text-emerald-300"
                                : "text-dark-300"
                          }`}
                        >
                          {row.delta > 0 ? "+" : ""}
                          {row.delta.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-xs text-dark-400">-</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-dark-300">
                      1 {row.currency} = {formatCurrency(row.current)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {ratesUpdatedAt ? (
            <p className="text-xs text-dark-400">
              Last update:{" "}
              {new Date(ratesUpdatedAt).toLocaleString("vi-VN")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* ─── Recent Activity ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-accent-green" />
                Recent Activity
              </CardTitle>
              <Link href="/timeline">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                >
                  Open Timeline
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-2">
                <div className="h-10 animate-pulse rounded-xl bg-white/10" />
                <div className="h-10 animate-pulse rounded-xl bg-white/10" />
                <div className="h-10 animate-pulse rounded-xl bg-white/10" />
              </div>
            ) : recentActivities.length === 0 ? (
              <p className="text-sm text-dark-300">
                No activity yet. Create one from Quick Actions above.
              </p>
            ) : (
              recentActivities.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {event.title}
                    </p>
                    <p className="line-clamp-1 text-xs text-dark-400">
                      {event.description ?? "No description"}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        event.status === "done"
                          ? "success"
                          : event.status === "cancelled"
                            ? "danger"
                            : "outline"
                      }
                      className="capitalize"
                    >
                      {event.status}
                    </Badge>
                    <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-dark-400">
                      <Clock3 className="h-3 w-3" />
                      {formatDate(event.date)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Timeline dialog ─── */}
      <Dialog
        open={timelineDialogOpen}
        onOpenChange={setTimelineDialogOpen}
      >
        <DialogContent>
          <DialogClose onClose={() => setTimelineDialogOpen(false)} />
          <DialogHeader>
        <DialogTitle>{labels.quickTimelineEvent}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={handleSubmitTimeline(createTimelineQuick)}
          >
            <div>
              <label
                htmlFor="quick_timeline_title"
                className="mb-1.5 block text-sm font-medium text-dark-300"
              >
                {labels.title}
              </label>
              <Input
                id="quick_timeline_title"
                placeholder="Prepare weekly review"
                {...registerTimeline("title")}
              />
              <FormError message={timelineErrors.title?.message} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="quick_timeline_date"
                  className="mb-1.5 block text-sm font-medium text-dark-300"
                >
                  {labels.date}
                </label>
                <Input
                  id="quick_timeline_date"
                  type="date"
                  {...registerTimeline("date")}
                />
                <FormError message={timelineErrors.date?.message} />
              </div>
              <div>
                <label
                  htmlFor="quick_timeline_category"
                  className="mb-1.5 block text-sm font-medium text-dark-300"
                >
                  {labels.category}
                </label>
                <Input
                  id="quick_timeline_category"
                  placeholder="personal"
                  {...registerTimeline("category")}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="quick_timeline_description"
                className="mb-1.5 block text-sm font-medium text-dark-300"
              >
                {labels.description}
              </label>
              <textarea
                id="quick_timeline_description"
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-dark-400"
                placeholder={labels.descriptionOptional}
                {...registerTimeline("description")}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTimelineDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={quickSaving === "timeline"}
                className="gap-2"
              >
                {quickSaving === "timeline" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {labels.saving}
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Calendar dialog ─── */}
      <Dialog
        open={calendarDialogOpen}
        onOpenChange={setCalendarDialogOpen}
      >
        <DialogContent>
          <DialogClose onClose={() => setCalendarDialogOpen(false)} />
          <DialogHeader>
        <DialogTitle>{labels.quickCalendarEvent}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={handleSubmitCalendar(createCalendarQuick)}
          >
            <div>
              <label
                htmlFor="quick_calendar_title"
                className="mb-1.5 block text-sm font-medium text-dark-300"
              >
                {labels.title}
              </label>
              <Input
                id="quick_calendar_title"
                placeholder="Book doctor appointment"
                {...registerCalendar("title")}
              />
              <FormError message={calendarErrors.title?.message} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="quick_calendar_start"
                  className="mb-1.5 block text-sm font-medium text-dark-300"
                >
                  Start date
                </label>
                <Input
                  id="quick_calendar_start"
                  type="date"
                  {...registerCalendar("start_date")}
                />
                <FormError message={calendarErrors.start_date?.message} />
              </div>
              <div>
                <label
                  htmlFor="quick_calendar_color"
                  className="mb-1.5 block text-sm font-medium text-dark-300"
                >
                  Color
                </label>
                <Input
                  id="quick_calendar_color"
                  type="color"
                  className="h-11 w-full rounded-xl px-2"
                  {...registerCalendar("color")}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="quick_calendar_description"
                className="mb-1.5 block text-sm font-medium text-dark-300"
              >
                {labels.description}
              </label>
              <textarea
                id="quick_calendar_description"
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-dark-400"
                placeholder={labels.descriptionOptional}
                {...registerCalendar("description")}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCalendarDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={quickSaving === "calendar"}
                className="gap-2"
              >
                {quickSaving === "calendar" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {labels.saving}
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
