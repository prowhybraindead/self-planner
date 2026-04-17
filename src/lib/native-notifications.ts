import { LocalNotifications } from "@capacitor/local-notifications";
import type { RecurringPayment } from "@/lib/types";
import { isCapacitorNativeRuntime } from "@/lib/platform";

const SCHEDULED_IDS_KEY = "selfplanner.localNotifications.ids.v1";

type LocalPermissionState = "granted" | "denied" | "prompt" | "unknown" | "unsupported";

export type ReminderSyncResult =
  | { ok: true; scheduled: number; cancelled: number }
  | { ok: false; reason: "unsupported" | "permission_denied" | "failed"; message?: string };

function getStoredIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SCHEDULED_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is number => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

function setStoredIds(ids: number[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(ids));
}

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function computeDueDateForMonth(dayOfMonth: number, year: number, month: number): Date {
  const day = Math.min(dayOfMonth, getLastDayOfMonth(year, month));
  return new Date(year, month, day, 9, 0, 0, 0);
}

function computeInitialDueDate(payment: RecurringPayment): Date {
  if (payment.next_due_date) {
    const nextDue = new Date(`${payment.next_due_date}T09:00:00`);
    if (!Number.isNaN(nextDue.getTime())) return nextDue;
  }

  const now = new Date();
  return computeDueDateForMonth(payment.day_of_month, now.getFullYear(), now.getMonth());
}

function hashToNotificationId(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) + 1;
}

function buildNotificationId(paymentId: string, dueDate: Date, leadDays: number): number {
  const dateToken = `${dueDate.getFullYear()}-${dueDate.getMonth() + 1}-${dueDate.getDate()}`;
  return hashToNotificationId(`${paymentId}:${dateToken}:${leadDays}`);
}

export async function getLocalNotificationPermissionState(): Promise<LocalPermissionState> {
  if (!isCapacitorNativeRuntime()) return "unsupported";
  try {
    const permission = await LocalNotifications.checkPermissions();
    return (permission.display ?? "unknown") as LocalPermissionState;
  } catch {
    return "unknown";
  }
}

export async function requestLocalNotificationPermission(): Promise<boolean> {
  if (!isCapacitorNativeRuntime()) return false;
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return true;

    const requested = await LocalNotifications.requestPermissions();
    return requested.display === "granted";
  } catch {
    return false;
  }
}

export async function clearScheduledPaymentReminders(): Promise<number> {
  if (!isCapacitorNativeRuntime()) return 0;
  const ids = getStoredIds();
  if (ids.length === 0) return 0;

  try {
    await LocalNotifications.cancel({
      notifications: ids.map((id) => ({ id })),
    });
    setStoredIds([]);
    return ids.length;
  } catch {
    return 0;
  }
}

export async function syncRecurringPaymentReminders(
  payments: RecurringPayment[],
  notifyBeforeDays: number
): Promise<ReminderSyncResult> {
  if (!isCapacitorNativeRuntime()) {
    return { ok: false, reason: "unsupported" };
  }

  const hasPermission = await requestLocalNotificationPermission();
  if (!hasPermission) {
    return { ok: false, reason: "permission_denied" };
  }

  const cancelled = await clearScheduledPaymentReminders();
  if (notifyBeforeDays <= 0) {
    return { ok: true, scheduled: 0, cancelled };
  }

  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 90);

  const notifications: Array<{
    id: number;
    title: string;
    body: string;
    schedule: { at: Date; allowWhileIdle: boolean };
  }> = [];

  for (const payment of payments.filter((item) => item.is_active)) {
    const initialDue = computeInitialDueDate(payment);

    for (let monthOffset = 0; monthOffset < 4; monthOffset += 1) {
      const dueDate = new Date(
        initialDue.getFullYear(),
        initialDue.getMonth() + monthOffset,
        initialDue.getDate(),
        9,
        0,
        0,
        0
      );

      if (dueDate < now || dueDate > horizon) continue;

      const notifyAt = new Date(dueDate);
      notifyAt.setDate(notifyAt.getDate() - notifyBeforeDays);
      notifyAt.setHours(9, 0, 0, 0);

      if (notifyAt.getTime() <= now.getTime() + 60 * 1000) continue;

      const id = buildNotificationId(payment.id, dueDate, notifyBeforeDays);
      notifications.push({
        id,
        title: "SelfPlanner Payment Reminder",
        body: `${payment.name} is due on ${dueDate.toLocaleDateString("vi-VN")}`,
        schedule: {
          at: notifyAt,
          allowWhileIdle: true,
        },
      });
    }
  }

  if (notifications.length === 0) {
    setStoredIds([]);
    return { ok: true, scheduled: 0, cancelled };
  }

  try {
    await LocalNotifications.schedule({ notifications });
    setStoredIds(notifications.map((item) => item.id));
    return { ok: true, scheduled: notifications.length, cancelled };
  } catch (error) {
    return {
      ok: false,
      reason: "failed",
      message: error instanceof Error ? error.message : "Could not schedule reminders",
    };
  }
}
