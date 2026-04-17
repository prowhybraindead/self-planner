import { LocalNotifications } from "@capacitor/local-notifications";
import type { RecurringPayment } from "@/lib/types";
import { isCapacitorNativeRuntime } from "@/lib/platform";
import { addBillingInterval, computeNextDueDateFromSchedule } from "@/lib/payment-schedule";

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

function computeInitialDueDate(payment: RecurringPayment): Date {
  const due = computeNextDueDateFromSchedule(payment, new Date());
  return new Date(due.getFullYear(), due.getMonth(), due.getDate(), 9, 0, 0, 0);
}

function hashToNotificationId(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) + 1;
}

function buildNotificationId(paymentId: string, dueDate: Date, leadMinutes: number): number {
  const dateToken = `${dueDate.getFullYear()}-${dueDate.getMonth() + 1}-${dueDate.getDate()}`;
  return hashToNotificationId(`${paymentId}:${dateToken}:${leadMinutes}`);
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
  reminderOffsetsMinutes: number[]
): Promise<ReminderSyncResult> {
  if (!isCapacitorNativeRuntime()) {
    return { ok: false, reason: "unsupported" };
  }

  const hasPermission = await requestLocalNotificationPermission();
  if (!hasPermission) {
    return { ok: false, reason: "permission_denied" };
  }

  const cancelled = await clearScheduledPaymentReminders();
  const offsets = Array.from(
    new Set(
      reminderOffsetsMinutes
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value >= 0)
        .map((value) => Math.floor(value))
    )
  ).sort((a, b) => a - b);
  if (offsets.length === 0) {
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
    let dueDate = computeInitialDueDate(payment);
    let guard = 0;
    while (dueDate <= horizon && guard < 300) {
      if (dueDate >= now) {
        for (const offsetMinutes of offsets) {
          const notifyAt = new Date(dueDate.getTime() - offsetMinutes * 60 * 1000);
          notifyAt.setSeconds(0, 0);

          if (notifyAt.getTime() > now.getTime() + 60 * 1000) {
            const id = buildNotificationId(payment.id, dueDate, offsetMinutes);
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
      }

      dueDate = addBillingInterval(
        dueDate,
        payment.billing_interval_unit ?? "month",
        payment.billing_interval_count ?? 1
      );
      dueDate.setHours(9, 0, 0, 0);
      guard += 1;
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
