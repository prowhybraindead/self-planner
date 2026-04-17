"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import {
  type DatesSetArg,
  type EventClickArg,
  type EventDropArg,
  type EventInput,
} from "@fullcalendar/core";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/language";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/utils";
import { addBillingInterval, computeNextDueDateFromSchedule, toYmdString } from "@/lib/payment-schedule";
import { getCurrentUserId, supabase } from "@/lib/supabase";
import {
  type CalendarEventFormValues,
  calendarEventSchema,
  type CalendarEvent,
  type CalendarEventValues,
  type RecurringPayment,
} from "@/lib/types";

function toLocalYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  return toLocalYmd(new Date(value));
}

function dateInputToIso(value: string, isEnd = false): string {
  const time = isEnd ? "T18:00:00" : "T09:00:00";
  return new Date(`${value}${time}`).toISOString();
}

function eventDateStringToIso(value: string, isEnd = false): string {
  if (value.includes("T")) {
    return new Date(value).toISOString();
  }
  return dateInputToIso(value, isEnd);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function buildPaymentEvents(
  payments: RecurringPayment[],
  rangeStart: Date,
  rangeEnd: Date
): EventInput[] {
  return payments.flatMap((payment) => {
    const events: EventInput[] = [];
    let due = computeNextDueDateFromSchedule(payment, rangeStart);
    let guard = 0;

    while (due <= rangeEnd && guard < 500) {
      events.push({
        id: `payment-${payment.id}-${toYmdString(due)}`,
        title: `${payment.name} • ${formatMoney(Number(payment.amount), payment.currency)}`,
        start: toLocalYmd(due),
        allDay: true,
        editable: false,
        backgroundColor: "#0ea5e9",
        borderColor: "#0ea5e9",
        textColor: "#f8fafc",
        extendedProps: {
          source: "payment",
          payment_id: payment.id,
        },
      } satisfies EventInput);

      due = addBillingInterval(
        due,
        payment.billing_interval_unit ?? "month",
        payment.billing_interval_count ?? 1
      );
      guard += 1;
    }

    return events;
  });
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-300">{message}</p>;
}

export default function CalendarPage() {
  const { labels } = useLanguage();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [currentRange, setCurrentRange] = useState(() => {
    const now = new Date();
    return {
      start: addMonths(startOfMonth(now), -1),
      end: addMonths(startOfMonth(now), 2),
    };
  });

  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<CalendarEventFormValues, unknown, CalendarEventValues>({
    resolver: zodResolver(calendarEventSchema),
    defaultValues: {
      title: "",
      description: "",
      start_date: toLocalYmd(new Date()),
      end_date: "",
      is_recurring: false,
      recurrence_rule: "",
      color: "#38bdf8",
    },
  });

  const isRecurring = useWatch({ control, name: "is_recurring" });

  const fetchCalendarData = useCallback(async (id: string) => {
    setLoading(true);

    const [eventsRes, paymentsRes] = await Promise.all([
      supabase
        .from("calendar_events")
        .select("*")
        .eq("user_id", id)
        .order("start_date", { ascending: true }),
      supabase
        .from("recurring_payments")
        .select("*")
        .eq("user_id", id)
        .eq("is_active", true)
        .order("next_due_date", { ascending: true }),
    ]);

    if (eventsRes.error) {
      toast.error("Khong the tai calendar events", { description: eventsRes.error.message });
      setLoading(false);
      return;
    }

    if (paymentsRes.error) {
      toast.error("Khong the tai recurring payments", { description: paymentsRes.error.message });
      setLoading(false);
      return;
    }

    setCalendarEvents((eventsRes.data ?? []) as CalendarEvent[]);
    setRecurringPayments((paymentsRes.data ?? []) as RecurringPayment[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const id = await getCurrentUserId();
        if (!mounted) return;
        setUserId(id);
        await fetchCalendarData(id);
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
  }, [fetchCalendarData]);

  useEffect(() => {
    if (!userId) return;

    const calendarChannel = supabase
      .channel(`calendar-events-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "calendar_events",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchCalendarData(userId);
        }
      )
      .subscribe();

    const paymentChannel = supabase
      .channel(`calendar-payments-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "recurring_payments",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchCalendarData(userId);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(calendarChannel);
      void supabase.removeChannel(paymentChannel);
    };
  }, [fetchCalendarData, userId]);

  const userEvents = useMemo(() => {
    return calendarEvents.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start_date,
      end: event.end_date ?? undefined,
      backgroundColor: event.color,
      borderColor: event.color,
      textColor: "#f8fafc",
      editable: true,
      extendedProps: {
        source: "calendar",
        description: event.description,
        is_recurring: event.is_recurring,
      },
    })) satisfies EventInput[];
  }, [calendarEvents]);

  const paymentEvents = useMemo(() => {
    return buildPaymentEvents(recurringPayments, currentRange.start, currentRange.end);
  }, [currentRange.end, currentRange.start, recurringPayments]);

  const mergedEvents = useMemo(() => [...paymentEvents, ...userEvents], [paymentEvents, userEvents]);

  const openCreateDialog = (dateValue?: string) => {
    setEditingEvent(null);
    reset({
      title: "",
      description: "",
      start_date: dateValue ?? toLocalYmd(new Date()),
      end_date: "",
      is_recurring: false,
      recurrence_rule: "",
      color: "#38bdf8",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    reset({
      title: event.title,
      description: event.description ?? "",
      start_date: getDateInputValue(event.start_date),
      end_date: getDateInputValue(event.end_date),
      is_recurring: event.is_recurring,
      recurrence_rule: event.recurrence_rule ?? "",
      color: event.color,
    });
    setDialogOpen(true);
  };

  const onDateClick = (arg: DateClickArg) => {
    openCreateDialog(arg.dateStr);
  };

  const onDatesSet = (arg: DatesSetArg) => {
    setCurrentRange({
      start: arg.start,
      end: arg.end,
    });
  };

  const onEventClick = (arg: EventClickArg) => {
    const source = String(arg.event.extendedProps?.source ?? "calendar");
    if (source !== "calendar") {
      const paymentId = arg.event.extendedProps?.payment_id;
      if (typeof paymentId !== "string" || paymentId.length === 0) {
        toast.message(labels.paymentEventsManagedInPayments);
        return;
      }
      router.push(`/payments?edit=${encodeURIComponent(paymentId)}`);
      return;
    }

    const selected = calendarEvents.find((event) => event.id === arg.event.id);
    if (!selected) return;
    openEditDialog(selected);
  };

  const onEventDrop = async (arg: EventDropArg) => {
    if (!userId) return;
    const source = String(arg.event.extendedProps?.source ?? "calendar");

    if (source !== "calendar") {
      arg.revert();
      return;
    }

    const startStr = arg.event.startStr;
    if (!startStr) {
      arg.revert();
      return;
    }

    const payload = {
      start_date: eventDateStringToIso(startStr),
      end_date: arg.event.endStr ? eventDateStringToIso(arg.event.endStr, true) : null,
    };

    const { error } = await supabase
      .from("calendar_events")
      .update(payload)
      .eq("id", arg.event.id)
      .eq("user_id", userId);

    if (error) {
      arg.revert();
      toast.error("Khong the cap nhat vi tri event", { description: error.message });
      return;
    }

    await fetchCalendarData(userId);
    toast.success("Da cap nhat ngay su kien");
  };

  const onSubmit = async (values: CalendarEventValues) => {
    if (!userId) {
      toast.error("Khong tim thay user", { description: "Vui long dang nhap lai" });
      return;
    }

    setSaving(true);

    const payload = {
      title: values.title.trim(),
      description: values.description?.trim() || null,
      start_date: dateInputToIso(values.start_date),
      end_date: values.end_date ? dateInputToIso(values.end_date, true) : null,
      is_recurring: values.is_recurring,
      recurrence_rule: values.is_recurring ? values.recurrence_rule?.trim() || null : null,
      color: values.color,
    };

    if (editingEvent) {
      const { error } = await supabase
        .from("calendar_events")
        .update(payload)
        .eq("id", editingEvent.id)
        .eq("user_id", userId);

      if (error) {
        toast.error("Cap nhat event that bai", { description: error.message });
        setSaving(false);
        return;
      }

      await fetchCalendarData(userId);
      toast.success("Cap nhat event thanh cong");
      setDialogOpen(false);
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("calendar_events").insert({
      ...payload,
      user_id: userId,
    });

    if (error) {
      toast.error("Tao event that bai", { description: error.message });
      setSaving(false);
      return;
    }

    await fetchCalendarData(userId);
    toast.success("Da tao event moi");
    setDialogOpen(false);
    setSaving(false);
  };

  const deleteCurrentEvent = async () => {
    if (!editingEvent || !userId) return;
    if (!window.confirm(`Xoa event "${editingEvent.title}"?`)) return;

    setSaving(true);

    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", editingEvent.id)
      .eq("user_id", userId);

    if (error) {
      toast.error("Xoa event that bai", { description: error.message });
      setSaving(false);
      return;
    }

    await fetchCalendarData(userId);
    toast.success("Da xoa event");
    setDialogOpen(false);
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">{labels.calendar}</h1>
          <p className="mt-1 text-sm text-dark-300">{labels.managePersonalEvents}</p>
        </div>
        <Button onClick={() => openCreateDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          {labels.addEvent}
        </Button>
      </motion.div>

      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-6">
          {loading ? (
            <div className="flex h-96 items-center justify-center text-dark-300">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              events={mergedEvents}
              editable={true}
              dateClick={onDateClick}
              eventDrop={onEventDrop}
              eventClick={onEventClick}
              datesSet={onDatesSet}
              eventStartEditable={true}
              dayMaxEvents={3}
              firstDay={1}
              nowIndicator={true}
              height="auto"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,dayGridWeek",
              }}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <Badge variant="outline" className="gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          {calendarEvents.length} {labels.events}
        </Badge>
          <Badge variant="outline">{recurringPayments.length} {labels.recurringSources}</Badge>
        <Badge variant="outline">{labels.clickDateToAddEvent}</Badge>
        <Badge variant="outline">{labels.dragEventToMoveDate}</Badge>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogClose onClose={() => setDialogOpen(false)} />
          <DialogHeader>
          <DialogTitle>{editingEvent ? labels.editEvent : labels.createEvent}</DialogTitle>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-dark-300">
                {labels.title}
              </label>
              <Input id="title" placeholder={labels.teamReviewPlaceholder} {...register("title")} />
              <FormError message={errors.title?.message} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="start_date" className="mb-1.5 block text-sm font-medium text-dark-300">
                  {labels.startDate}
                </label>
                <Input id="start_date" type="date" {...register("start_date")} />
                <FormError message={errors.start_date?.message} />
              </div>

              <div>
                <label htmlFor="end_date" className="mb-1.5 block text-sm font-medium text-dark-300">
                  {labels.endDate} ({labels.optional})
                </label>
                <Input id="end_date" type="date" {...register("end_date")} />
                <FormError message={errors.end_date?.message} />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-dark-300">
                {labels.description}
              </label>
              <textarea
                id="description"
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-dark-400"
                placeholder={labels.optional}
                {...register("description")}
              />
              <FormError message={errors.description?.message} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="color" className="mb-1.5 block text-sm font-medium text-dark-300">
                  {labels.color}
                </label>
                <Input id="color" type="color" className="h-11 w-full rounded-xl px-2" {...register("color")} />
                <FormError message={errors.color?.message} />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div>
                  <p className="text-sm font-medium text-white">{labels.recurringEvent}</p>
                  <p className="text-xs text-dark-400">{labels.storeRrule}</p>
                </div>
                <input type="checkbox" className="h-4 w-4" {...register("is_recurring")} />
              </div>
            </div>

            {isRecurring ? (
              <div>
                <label htmlFor="recurrence_rule" className="mb-1.5 block text-sm font-medium text-dark-300">
                  {labels.rrule}
                </label>
                <Input
                  id="recurrence_rule"
                  placeholder="FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15"
                  {...register("recurrence_rule")}
                />
                <FormError message={errors.recurrence_rule?.message} />
              </div>
            ) : null}

            <div className="flex flex-wrap justify-between gap-2 pt-1">
              <div>
                {editingEvent ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 border-red-400/30 text-red-300 hover:bg-red-500/10"
                    onClick={() => {
                      void deleteCurrentEvent();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    {labels.delete}
                  </Button>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  {labels.cancel}
                </Button>
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {labels.save}
                    </>
                  ) : (
                    <>{editingEvent ? labels.updateEvent : labels.createEvent}</>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
