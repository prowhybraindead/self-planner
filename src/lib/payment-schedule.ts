import type { BillingIntervalUnit, RecurringPayment } from "@/lib/types";

function toStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function toDateFromYmd(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function addBillingInterval(
  date: Date,
  unit: BillingIntervalUnit,
  count: number
): Date {
  const safeCount = Math.max(1, Math.floor(count || 1));
  if (unit === "day") {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + safeCount, 0, 0, 0, 0);
  }

  if (unit === "year") {
    const targetYear = date.getFullYear() + safeCount;
    const targetMonth = date.getMonth();
    const day = Math.min(date.getDate(), getLastDayOfMonth(targetYear, targetMonth));
    return new Date(targetYear, targetMonth, day, 0, 0, 0, 0);
  }

  const totalMonths = date.getMonth() + safeCount;
  const targetYear = date.getFullYear() + Math.floor(totalMonths / 12);
  const targetMonth = totalMonths % 12;
  const day = Math.min(date.getDate(), getLastDayOfMonth(targetYear, targetMonth));
  return new Date(targetYear, targetMonth, day, 0, 0, 0, 0);
}

export function getPaymentAnchorDate(payment: RecurringPayment): Date {
  const anchor = toDateFromYmd(payment.billing_anchor_date);
  if (anchor) return toStartOfDay(anchor);

  const nextDue = toDateFromYmd(payment.next_due_date);
  if (nextDue) return toStartOfDay(nextDue);

  const now = new Date();
  const day = Math.min(payment.day_of_month || 1, getLastDayOfMonth(now.getFullYear(), now.getMonth()));
  return new Date(now.getFullYear(), now.getMonth(), day, 0, 0, 0, 0);
}

export function computeNextDueDateFromSchedule(
  payment: Pick<
    RecurringPayment,
    | "billing_anchor_date"
    | "billing_interval_unit"
    | "billing_interval_count"
    | "day_of_month"
    | "next_due_date"
  >,
  fromDate: Date = new Date()
): Date {
  const from = toStartOfDay(fromDate);
  const unit = payment.billing_interval_unit ?? "month";
  const interval = Math.max(1, Math.floor(payment.billing_interval_count || 1));

  const nextDueCandidate = toDateFromYmd(payment.next_due_date);
  if (nextDueCandidate && toStartOfDay(nextDueCandidate) >= from) {
    return toStartOfDay(nextDueCandidate);
  }

  let cursor = (() => {
    const anchor = toDateFromYmd(payment.billing_anchor_date);
    if (anchor) return toStartOfDay(anchor);

    if (nextDueCandidate) return toStartOfDay(nextDueCandidate);

    const day = Math.max(1, Math.min(payment.day_of_month || 1, 31));
    const year = from.getFullYear();
    const month = from.getMonth();
    const clampedDay = Math.min(day, getLastDayOfMonth(year, month));
    return new Date(year, month, clampedDay, 0, 0, 0, 0);
  })();

  let guard = 0;
  while (cursor < from && guard < 5000) {
    cursor = addBillingInterval(cursor, unit, interval);
    guard += 1;
  }

  return cursor;
}

export function computeNextDueDateIsoFromForm(input: {
  billing_anchor_date: string;
  billing_interval_unit: BillingIntervalUnit;
  billing_interval_count: number;
  day_of_month: number;
}): string {
  const due = computeNextDueDateFromSchedule(
    {
      ...input,
      next_due_date: null,
    },
    new Date()
  );
  return toYmd(due);
}

export function toYmdString(date: Date): string {
  return toYmd(date);
}
