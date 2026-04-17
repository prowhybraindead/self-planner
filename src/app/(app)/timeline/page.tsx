"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  CreditCard,
  Edit3,
  FileText,
  Loader2,
  Plus,
  Target,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/language";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AppSelect, type AppSelectOption } from "@/components/ui/app-select";
import { formatDate } from "@/lib/utils";
import { getCurrentUserId, supabase } from "@/lib/supabase";
import {
  type TimelineEventFormValues,
  timelineEventSchema,
  type TimelineEvent,
  type TimelineEventStatus,
  type TimelineEventValues,
} from "@/lib/types";

const statusFilters = ["all", "pending", "done", "cancelled"] as const;
const categoryPresets = ["finance", "work", "personal", "health", "learning", "other"] as const;
const timelineReminderPresets = [15, 30, 60, 180, 360, 720, 1440];

function normalizeOffsets(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const parsed = value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item >= 0)
    .map((item) => Math.floor(item));
  return Array.from(new Set(parsed)).sort((a, b) => a - b);
}

function formatOffsetLabel(minutes: number): string {
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "Trước 1 ngày" : `Trước ${days} ngày`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "Trước 1 giờ" : `Trước ${hours} giờ`;
  }
  return `Trước ${minutes} phút`;
}

function normalizeCategory(value: string | null | undefined): string {
  return (value ?? "other").trim().toLowerCase() || "other";
}

function getStatusLabel(
  labels: ReturnType<typeof useLanguage>["labels"],
  status: (typeof statusFilters)[number]
): string {
  if (status === "all") return labels.statusAll;
  if (status === "pending") return labels.statusPending;
  if (status === "done") return labels.statusDone;
  return labels.statusCancelled;
}

function getCategoryLabel(
  labels: ReturnType<typeof useLanguage>["labels"],
  category: string
): string {
  switch (normalizeCategory(category)) {
    case "finance":
      return labels.categoryFinance;
    case "work":
      return labels.categoryWork;
    case "personal":
      return labels.categoryPersonal;
    case "health":
      return labels.categoryHealth;
    case "learning":
      return labels.categoryLearning;
    default:
      return labels.categoryOther;
  }
}

function getCategoryMeta(category: string | null) {
  const normalized = normalizeCategory(category);

  if (normalized.includes("finance") || normalized.includes("payment")) {
    return { icon: CreditCard, colorClass: "text-emerald-300 bg-emerald-500/20 ring-emerald-400/30" };
  }
  if (normalized.includes("work") || normalized.includes("project")) {
    return { icon: Target, colorClass: "text-sky-300 bg-sky-500/20 ring-sky-400/30" };
  }
  if (normalized.includes("personal") || normalized.includes("life")) {
    return { icon: Bell, colorClass: "text-indigo-300 bg-indigo-500/20 ring-indigo-400/30" };
  }
  if (normalized.includes("health")) {
    return { icon: CalendarClock, colorClass: "text-fuchsia-300 bg-fuchsia-500/20 ring-fuchsia-400/30" };
  }

  return { icon: FileText, colorClass: "text-slate-300 bg-slate-500/20 ring-slate-400/30" };
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-300">{message}</p>;
}

function getTodayDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentTimeInputValue(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export default function TimelinePage() {
  const { labels } = useLanguage();
  const [userId, setUserId] = useState<string | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<TimelineEventFormValues, unknown, TimelineEventValues>({
    resolver: zodResolver(timelineEventSchema),
    defaultValues: {
      title: "",
      description: "",
      date: getTodayDateInputValue(),
      time_of_day: getCurrentTimeInputValue(),
      reminder_offsets_minutes: [],
      status: "pending",
      category: "personal",
    },
  });
  const formStatusField = useWatch({ control, name: "status" }) ?? "pending";
  const formReminderOffsets = normalizeOffsets(useWatch({ control, name: "reminder_offsets_minutes" }));
  const [customReminderValue, setCustomReminderValue] = useState("30");
  const [customReminderUnit, setCustomReminderUnit] = useState<"minute" | "hour" | "day">("minute");
  const timelineStatusOptions = useMemo<AppSelectOption[]>(
    () => [
      { value: "pending", label: labels.statusPending },
      { value: "done", label: labels.statusDone },
      { value: "cancelled", label: labels.statusCancelled },
    ],
    [labels]
  );

  const fetchTimelineEvents = useCallback(async (id: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("timeline_events")
      .select("*")
      .eq("user_id", id)
      .order("date", { ascending: false })
      .order("time_of_day", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Khong the tai timeline", { description: error.message });
      setLoading(false);
      return;
    }

    setEvents((data ?? []) as TimelineEvent[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const id = await getCurrentUserId();
        if (!mounted) return;
        setUserId(id);
        await fetchTimelineEvents(id);
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
  }, [fetchTimelineEvents]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`timeline-events-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "timeline_events",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchTimelineEvents(userId);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchTimelineEvents, userId]);

  const categories = useMemo(() => {
    const fromDb = events
      .map((event) => event.category)
      .filter((value): value is string => Boolean(value))
      .map((value) => normalizeCategory(value));

    return Array.from(new Set([...categoryPresets, ...fromDb]));
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const byStatus = statusFilter === "all" || event.status === statusFilter;
      const byCategory = categoryFilter === "all" || normalizeCategory(event.category) === categoryFilter;
      return byStatus && byCategory;
    });
  }, [categoryFilter, events, statusFilter]);

  const doneCount = useMemo(() => events.filter((event) => event.status === "done").length, [events]);

  const cycleStatusFilter = useCallback(
    (direction: 1 | -1) => {
      const currentIndex = statusFilters.indexOf(statusFilter);
      const nextIndex =
        (currentIndex + direction + statusFilters.length) % statusFilters.length;
      setStatusFilter(statusFilters[nextIndex]);
    },
    [statusFilter]
  );

  const openCreateDialog = () => {
    setEditingEvent(null);
    reset({
      title: "",
      description: "",
      date: getTodayDateInputValue(),
      time_of_day: getCurrentTimeInputValue(),
      reminder_offsets_minutes: [],
      status: "pending",
      category: "personal",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (event: TimelineEvent) => {
    setEditingEvent(event);
    reset({
      title: event.title,
      description: event.description ?? "",
      date: event.date,
      time_of_day: event.time_of_day ?? getCurrentTimeInputValue(),
      reminder_offsets_minutes: normalizeOffsets(event.reminder_offsets_minutes),
      status: event.status,
      category: event.category ?? "personal",
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: TimelineEventValues) => {
    if (!userId) {
      toast.error("Khong tim thay user", { description: "Vui long dang nhap lai" });
      return;
    }

    setSaving(true);
    const payload = {
      title: values.title.trim(),
      description: values.description?.trim() || null,
      date: values.date,
      time_of_day: values.time_of_day?.trim() || null,
      reminder_offsets_minutes: normalizeOffsets(values.reminder_offsets_minutes),
      status: values.status,
      category: values.category?.trim().toLowerCase() || null,
    };

    if (editingEvent) {
      const { error } = await supabase
        .from("timeline_events")
        .update(payload)
        .eq("id", editingEvent.id)
        .eq("user_id", userId);

      if (error) {
        toast.error("Cap nhat su kien that bai", { description: error.message });
        setSaving(false);
        return;
      }

      await fetchTimelineEvents(userId);
      toast.success("Cap nhat su kien thanh cong");
      setDialogOpen(false);
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("timeline_events").insert({
      ...payload,
      user_id: userId,
    });

    if (error) {
      toast.error("Tao su kien that bai", { description: error.message });
      setSaving(false);
      return;
    }

    await fetchTimelineEvents(userId);
    toast.success("Da them su kien moi");
    setDialogOpen(false);
    setSaving(false);
  };

  const setStatus = async (event: TimelineEvent, nextStatus: TimelineEventStatus) => {
    if (!userId) return;

    const { error } = await supabase
      .from("timeline_events")
      .update({ status: nextStatus })
      .eq("id", event.id)
      .eq("user_id", userId);

    if (error) {
      toast.error("Khong the cap nhat trang thai", { description: error.message });
      return;
    }

    toast.success("Trang thai da duoc cap nhat");
  };

  const deleteEvent = async (event: TimelineEvent) => {
    if (!userId) return;
    if (!window.confirm(`Xoa su kien "${event.title}"?`)) return;

    const { error } = await supabase
      .from("timeline_events")
      .delete()
      .eq("id", event.id)
      .eq("user_id", userId);

    if (error) {
      toast.error("Xoa su kien that bai", { description: error.message });
      return;
    }

    await fetchTimelineEvents(userId);
    toast.success("Da xoa su kien");
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.changedTouches[0]?.clientX ?? null);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX;
    const diff = endX - touchStartX;
    setTouchStartX(null);

    if (Math.abs(diff) < 55) return;
    cycleStatusFilter(diff < 0 ? 1 : -1);
  };

  return (
    <div className="space-y-6 pb-28 md:pb-0">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">{labels.timeline}</h1>
          <p className="mt-1 text-sm text-dark-300">
            {events.length} {labels.eventsTotal}, {doneCount} {labels.completed}
          </p>
          <p className="mt-1 text-xs text-dark-400 md:hidden">
            {labels.swipeToFilter}
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          {labels.addEvent}
        </Button>
      </motion.div>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => (
              <Button
                key={filter}
                size="sm"
                variant={statusFilter === filter ? "default" : "outline"}
                className="capitalize"
                onClick={() => setStatusFilter(filter)}
              >
                {getStatusLabel(labels, filter)}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={categoryFilter === "all" ? "default" : "outline"}
              onClick={() => setCategoryFilter("all")}
            >
              {labels.categories}
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                size="sm"
                variant={categoryFilter === category ? "default" : "outline"}
                className="capitalize"
                onClick={() => setCategoryFilter(category)}
              >
                {getCategoryLabel(labels, category)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16 text-dark-300">
            <Loader2 className="h-5 w-5 animate-spin" />
          </CardContent>
        </Card>
      ) : filteredEvents.length === 0 ? (
        <Card onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <CardContent className="py-16 text-center">
            <Clock className="mx-auto mb-3 h-10 w-10 text-dark-400" />
            <p className="text-sm text-dark-300">{labels.noEventsMatch}</p>
            <Button onClick={openCreateDialog} variant="outline" className="mt-4">
              {labels.createFirstEvent}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {filteredEvents.map((event, index) => {
            const meta = getCategoryMeta(event.category);
            const Icon = meta.icon;
            const isDone = event.status === "done";
            const isCancelled = event.status === "cancelled";

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02, duration: 0.2 }}
              >
                <Card className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ${meta.colorClass}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                          ) : (
                            <Circle className="h-4 w-4 shrink-0 text-dark-400" />
                          )}
                          <p
                            className={`min-w-0 truncate text-sm font-medium ${
                              isDone || isCancelled ? "text-dark-400 line-through" : "text-white"
                            }`}
                          >
                            {event.title}
                          </p>

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
                            {getStatusLabel(labels, event.status)}
                          </Badge>

                          <Badge variant="outline" className="capitalize">
                            {getCategoryLabel(labels, normalizeCategory(event.category))}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-dark-400">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDate(event.date)}
                            {event.time_of_day ? ` ${event.time_of_day}` : ""}
                          </span>
                          {event.reminder_offsets_minutes?.length > 0 ? (
                            <span>
                              Nhắc: {normalizeOffsets(event.reminder_offsets_minutes).map((item) => formatOffsetLabel(item)).join(", ")}
                            </span>
                          ) : null}
                        </div>

                        {event.description ? (
                          <p className="text-xs text-dark-300">{event.description}</p>
                        ) : null}

                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            size="sm"
                            variant={isDone ? "outline" : "secondary"}
                            onClick={() => {
                              void setStatus(event, isDone ? "pending" : "done");
                            }}
                          >
                            {isDone ? labels.markPending : labels.markDone}
                          </Button>

                          {event.status !== "cancelled" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => {
                                void setStatus(event, "cancelled");
                              }}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              {labels.cancel}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                void setStatus(event, "pending");
                              }}
                            >
                              {labels.reopen}
                            </Button>
                          )}

                          <Button size="sm" variant="outline" className="gap-1" onClick={() => openEditDialog(event)}>
                            <Edit3 className="h-3.5 w-3.5" />
                            {labels.edit}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 border-red-400/30 text-red-300 hover:bg-red-500/10"
                            onClick={() => {
                              void deleteEvent(event);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {labels.delete}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-16 z-30 px-4 md:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-2 rounded-2xl border border-sky-200/20 bg-dark-900/80 p-2 shadow-xl backdrop-blur-xl">
          <Button size="sm" className="flex-1 gap-1" onClick={openCreateDialog}>
            <Plus className="h-3.5 w-3.5" />
            {labels.add}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 capitalize"
            onClick={() => cycleStatusFilter(1)}
          >
            {labels.statusFilter}: {getStatusLabel(labels, statusFilter)}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => {
              setStatusFilter("all");
              setCategoryFilter("all");
            }}
          >
            {labels.resetFilters}
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogClose onClose={() => setDialogOpen(false)} />
          <DialogHeader>
            <DialogTitle>{editingEvent ? labels.editEvent : labels.addEvent}</DialogTitle>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-dark-300">
                {labels.title}
              </label>
              <Input id="title" placeholder={labels.quickTimelineEvent} {...register("title")} />
              <FormError message={errors.title?.message} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="date" className="mb-1.5 block text-sm font-medium text-dark-300">
                  {labels.date}
                </label>
                <Input id="date" type="date" {...register("date")} />
                <FormError message={errors.date?.message} />
              </div>

              <div>
                <label htmlFor="time_of_day" className="mb-1.5 block text-sm font-medium text-dark-300">
                  Giờ phút
                </label>
                <Input id="time_of_day" type="time" {...register("time_of_day")} />
                <FormError message={errors.time_of_day?.message} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="status" className="mb-1.5 block text-sm font-medium text-dark-300">
                  {labels.statusFilter}
                </label>
                <AppSelect
                  id="status"
                  value={formStatusField}
                  placeholder={labels.statusFilter}
                  onValueChange={(next) => {
                    setValue("status", next as TimelineEventValues["status"], {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                  options={timelineStatusOptions}
                  searchPlaceholder={labels.typeStatus}
                  emptyLabel={labels.noMatchingOptions}
                />
                <FormError message={errors.status?.message} />
              </div>
            </div>

            <div>
              <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-dark-300">
                {labels.category}
              </label>
              <Input id="category" list="timeline-categories" placeholder={labels.typeCategory} {...register("category")} />
              <datalist id="timeline-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
              <FormError message={errors.category?.message} />
            </div>

            <div>
              <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-dark-300">
                {labels.description}
              </label>
              <textarea
                id="description"
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-dark-400"
                placeholder={labels.descriptionOptional}
                {...register("description")}
              />
              <FormError message={errors.description?.message} />
            </div>

            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-sm font-medium text-white">Mốc nhắc cho event này</p>
              <div className="flex flex-wrap gap-2">
                {timelineReminderPresets.map((offset) => {
                  const active = formReminderOffsets.includes(offset);
                  return (
                    <Button
                      key={offset}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() => {
                        const next = active
                          ? formReminderOffsets.filter((value) => value !== offset)
                          : [...formReminderOffsets, offset];
                        setValue("reminder_offsets_minutes", normalizeOffsets(next), {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }}
                    >
                      {formatOffsetLabel(offset)}
                    </Button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={customReminderValue}
                  onChange={(event) => setCustomReminderValue(event.target.value)}
                  className="h-10 w-20 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white"
                />
                <select
                  value={customReminderUnit}
                  onChange={(event) => setCustomReminderUnit(event.target.value as "minute" | "hour" | "day")}
                  className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white"
                >
                  <option value="minute">Phút</option>
                  <option value="hour">Giờ</option>
                  <option value="day">Ngày</option>
                </select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const parsed = Number(customReminderValue);
                    if (!Number.isFinite(parsed) || parsed <= 0) {
                      toast.error("Offset không hợp lệ");
                      return;
                    }
                    const minutes =
                      customReminderUnit === "day"
                        ? Math.floor(parsed * 1440)
                        : customReminderUnit === "hour"
                          ? Math.floor(parsed * 60)
                          : Math.floor(parsed);
                    const next = [...formReminderOffsets, minutes];
                    setValue("reminder_offsets_minutes", normalizeOffsets(next), {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                >
                  Thêm mốc
                </Button>
              </div>
              <p className="text-xs text-dark-400">
                Đang chọn: {formReminderOffsets.length > 0 ? formReminderOffsets.map((item) => formatOffsetLabel(item)).join(", ") : "Không nhắc"}
              </p>
              <FormError message={errors.reminder_offsets_minutes?.message as string | undefined} />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {labels.cancel}
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {labels.saving}
                  </>
                ) : (
                  <>{editingEvent ? labels.updateEvent : labels.createEvent}</>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
