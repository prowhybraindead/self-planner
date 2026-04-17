import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isAfter, isBefore, addMonths, setDate, getDate } from "date-fns";
import { vi } from "date-fns/locale/vi";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(amount: number, currency = "VND", locale = "vi-VN"): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "VND" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatCurrency(amount: number): string {
  return formatMoney(amount, "VND");
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Format a date like "Thứ Hai, 17/04" */
export function formatDateShort(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "EEE, dd/MM", { locale: vi });
}

/** Relative time like "3 ngày nữa" */
export function formatRelative(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: vi });
}

/**
 * Calculate the next due date for a recurring payment.
 * If day_of_month has passed this month, use next month.
 */
export function getNextDueDate(dayOfMonth: number): Date {
  const now = new Date();
  const thisMonth = setDate(now, Math.min(dayOfMonth, 28)); // safe for Feb
  if (isAfter(thisMonth, now) || getDate(thisMonth) === getDate(now)) {
    return thisMonth;
  }
  return setDate(addMonths(now, 1), Math.min(dayOfMonth, 28));
}

/** Is the date within the next N days? */
export function isWithinNextDays(date: Date, days: number): boolean {
  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + days);
  return (isAfter(date, now) || getDate(date) === getDate(now)) && isBefore(date, future);
}
