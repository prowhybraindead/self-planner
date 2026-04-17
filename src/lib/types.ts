import { z } from "zod";

export const billingIntervalUnitSchema = z.enum(["day", "month", "year"]);
export type BillingIntervalUnit = z.infer<typeof billingIntervalUnitSchema>;

// ─── Auth ───
export const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
});

export type LoginValues = z.infer<typeof loginSchema>;

// ─── User Profile ───
export interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  avatar_url?: string;
  full_name?: string;
}

// ─── Recurring Payments ───
// Matches: public.recurring_payments table
export const paymentSchema = z.object({
  name: z.string().min(1, "Tên không được để trống").max(100),
  amount: z.coerce.number().min(0, "Số tiền phải lớn hơn hoặc bằng 0"),
  payment_method: z.enum(["visa", "mastercard", "paypal", "momo", "google_play", "bank_transfer"]),
  billing_anchor_date: z.string().min(1, "Ngày bắt đầu là bắt buộc"),
  billing_interval_unit: billingIntervalUnitSchema.default("month"),
  billing_interval_count: z.coerce.number().int().min(1, "Chu kỳ tối thiểu là 1").max(3650, "Chu kỳ quá lớn"),
  reminder_offsets_minutes: z.array(z.number().int().min(0)).default([1440]),
  day_of_month: z.coerce.number().min(1, "Ngày từ 1-31").max(31, "Ngày từ 1-31"),
  currency: z.enum(["VND", "USD", "EUR", "GBP", "JPY", "SGD", "AUD"]).default("VND"),
  description: z.string().max(500).optional(),
  is_active: z.boolean().default(true),
});

export type PaymentValues = z.output<typeof paymentSchema>;
export type PaymentFormValues = z.input<typeof paymentSchema>;

export interface RecurringPayment {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  payment_method: "visa" | "mastercard" | "paypal" | "momo" | "google_play" | "bank_transfer";
  currency: "VND" | "USD" | "EUR" | "GBP" | "JPY" | "SGD" | "AUD";
  billing_anchor_date: string;
  billing_interval_unit: BillingIntervalUnit;
  billing_interval_count: number;
  reminder_offsets_minutes: number[];
  day_of_month: number;
  description: string | null;
  is_active: boolean;
  next_due_date: string | null;
  created_at: string;
  updated_at: string;
}

/** @deprecated Use RecurringPayment instead */
export type Payment = RecurringPayment;

// ─── Timeline Events ───
// Matches: public.timeline_events table
export type TimelineEventStatus = "pending" | "done" | "cancelled";

export const timelineEventSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được để trống").max(200),
  description: z.string().max(1000).optional(),
  date: z.string().min(1, "Ngày không được để trống"),
  time_of_day: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Giờ không hợp lệ")
    .or(z.literal(""))
    .optional(),
  reminder_offsets_minutes: z.array(z.number().int().min(0)).default([]),
  status: z.enum(["pending", "done", "cancelled"]).default("pending"),
  category: z.string().max(50).optional(),
});

export type TimelineEventValues = z.output<typeof timelineEventSchema>;
export type TimelineEventFormValues = z.input<typeof timelineEventSchema>;

export interface TimelineEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  date: string;
  time_of_day: string | null;
  reminder_offsets_minutes: number[];
  status: TimelineEventStatus;
  category: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Calendar Events ───
// Matches: public.calendar_events table
export const calendarEventSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được để trống").max(200),
  description: z.string().max(1000).optional(),
  start_date: z.string().min(1, "Ngày bắt đầu là bắt buộc"),
  end_date: z.string().optional(),
  is_recurring: z.boolean().default(false),
  recurrence_rule: z.string().optional(),
  color: z.string().min(1).default("#38bdf8"),
});

export type CalendarEventValues = z.output<typeof calendarEventSchema>;
export type CalendarEventFormValues = z.input<typeof calendarEventSchema>;

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

// ─── User Settings ───
// Matches: public.user_settings table
export interface UserSettings {
  user_id: string;
  notify_before_days: number;
  fcm_token: string | null;
  notification_email: string | null;
  reminder_offsets_minutes: number[] | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

// ─── FullCalendar event shape (UI only) ───
export interface FullCalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  backgroundColor?: string;
  borderColor?: string;
  allDay?: boolean;
  extendedProps?: {
    type: string;
    description?: string;
    source?: "calendar" | "payment";
    calendar_event_id?: string;
  };
}
