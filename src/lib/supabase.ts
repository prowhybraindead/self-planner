import { createClient } from "@supabase/supabase-js";
import type { RecurringPayment, TimelineEvent } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

// ─── Helper utilities ───────────────────────────────────────

function getMissingSchemaColumn(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code !== "PGRST204" || typeof message !== "string") return null;

  const match = message.match(/'([^']+)' column/);
  return match?.[1] ?? null;
}

function normalizeRecurringPayment(
  row: Record<string, unknown>
): RecurringPayment {
  return {
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    name: String(row.name ?? ""),
    amount: Number(row.amount ?? 0),
    payment_method:
      typeof row.payment_method === "string"
        ? (row.payment_method as RecurringPayment["payment_method"])
        : "visa",
    currency:
      typeof row.currency === "string"
        ? (row.currency as RecurringPayment["currency"])
        : "VND",
    billing_anchor_date:
      typeof row.billing_anchor_date === "string"
        ? row.billing_anchor_date
        : typeof row.next_due_date === "string"
          ? row.next_due_date
          : new Date().toISOString().slice(0, 10),
    billing_interval_unit:
      row.billing_interval_unit === "day" || row.billing_interval_unit === "year"
        ? row.billing_interval_unit
        : "month",
    billing_interval_count: Number(row.billing_interval_count ?? 1) || 1,
    reminder_offsets_minutes: Array.isArray(row.reminder_offsets_minutes)
      ? row.reminder_offsets_minutes
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value >= 0)
          .map((value) => Math.floor(value))
      : [1440],
    day_of_month: Number(row.day_of_month ?? 1),
    description:
      typeof row.description === "string" ? row.description : null,
    is_active: Boolean(row.is_active),
    next_due_date:
      typeof row.next_due_date === "string" ? row.next_due_date : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

async function runRecurringPaymentsMutation(
  operation: "insert" | "update",
  execute: (
    row: Record<string, unknown>
  ) => Promise<{ data: unknown; error: unknown }>,
  baseRow: Record<string, unknown>
) {
  const mutableRow = { ...baseRow };
  const strippedColumns = new Set<string>();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await execute(mutableRow);
    if (!error) {
      return {
        data: (data ?? {}) as Record<string, unknown>,
        strippedColumns,
      };
    }

    const missingColumn = getMissingSchemaColumn(error);
    if (!missingColumn || !(missingColumn in mutableRow)) {
      throw error;
    }

    delete mutableRow[missingColumn];
    strippedColumns.add(missingColumn);
    console.warn(
      `[upsertPayment] recurring_payments.${missingColumn} is missing from schema cache during ${operation}. Retrying without this column.`
    );
  }

  throw new Error(
    `[upsertPayment] Too many schema fallback attempts while trying to ${operation} recurring payment.`
  );
}

function applyRecurringPaymentFallbacks(
  row: Record<string, unknown>,
  strippedColumns: Set<string>,
  payload: {
    payment_method: string;
    currency: string;
    billing_anchor_date: string;
    billing_interval_unit: string;
    billing_interval_count: number;
    reminder_offsets_minutes: number[];
    next_due_date?: string | null;
  }
) {
  const merged = { ...row };
  if (strippedColumns.has("payment_method")) {
    merged.payment_method = payload.payment_method;
  }
  if (strippedColumns.has("currency")) {
    merged.currency = payload.currency;
  }
  if (strippedColumns.has("billing_anchor_date")) {
    merged.billing_anchor_date = payload.billing_anchor_date;
  }
  if (strippedColumns.has("billing_interval_unit")) {
    merged.billing_interval_unit = payload.billing_interval_unit;
  }
  if (strippedColumns.has("billing_interval_count")) {
    merged.billing_interval_count = payload.billing_interval_count;
  }
  if (strippedColumns.has("reminder_offsets_minutes")) {
    merged.reminder_offsets_minutes = payload.reminder_offsets_minutes;
  }
  if (strippedColumns.has("next_due_date")) {
    merged.next_due_date = payload.next_due_date ?? null;
  }
  return merged;
}

/** Get current user ID or throw */
export async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

/** Shorthand: select all rows from a table for the current user */
export async function fetchUserRows<T extends Record<string, unknown>>(
  table: string,
  options?: {
    order?: { column: string; ascending?: boolean };
    filter?: Record<string, unknown>;
    limit?: number;
  }
): Promise<T[]> {
  const userId = await getCurrentUserId();

  let query = supabase.from(table).select("*").eq("user_id", userId);

  if (options?.filter) {
    for (const [key, value] of Object.entries(options.filter)) {
      query = query.eq(key, value);
    }
  }

  if (options?.order) {
    query = query.order(options.order.column, {
      ascending: options.order.ascending ?? true,
    });
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as T[];
}

/** Shorthand: insert a row with user_id auto-filled */
export async function insertRow<T extends Record<string, unknown>>(
  table: string,
  row: Omit<T, "id" | "user_id" | "created_at" | "updated_at">
): Promise<T> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from(table)
    .insert({ ...row, user_id: userId } as Record<string, unknown>)
    .select()
    .single();

  if (error) throw error;
  return data as T;
}

/** Shorthand: update a row by id (must belong to current user) */
export async function updateRow<T extends Record<string, unknown>>(
  table: string,
  id: string,
  updates: Partial<Omit<T, "id" | "user_id" | "created_at" | "updated_at">>
): Promise<T> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from(table)
    .update(updates as Record<string, unknown>)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as T;
}

/** Shorthand: delete a row by id (must belong to current user) */
export async function deleteRow(
  table: string,
  id: string
): Promise<void> {
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}

// ─── Recurring Payments helpers ──────────────────────────────

/** Fetch all recurring payments for the current user */
export async function getCurrentUserPayments(options?: {
  activeOnly?: boolean;
  order?: { column: string; ascending?: boolean };
}): Promise<RecurringPayment[]> {
  const userId = await getCurrentUserId();

  let query = supabase
    .from("recurring_payments")
    .select("*")
    .eq("user_id", userId);

  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  query = query.order(options?.order?.column ?? "created_at", {
    ascending: options?.order?.ascending ?? false,
  });

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []).map((row) =>
    normalizeRecurringPayment(row as Record<string, unknown>)
  );
}

/** Insert or update a recurring payment for the current user */
export async function upsertPayment(
  payload: {
    name: string;
    amount: number;
    payment_method: string;
    billing_anchor_date: string;
    billing_interval_unit: "day" | "month" | "year";
    billing_interval_count: number;
    reminder_offsets_minutes: number[];
    day_of_month: number;
    currency: string;
    description?: string | null;
    is_active: boolean;
    next_due_date?: string | null;
  },
  existingId?: string
): Promise<RecurringPayment> {
  const userId = await getCurrentUserId();

  const row: Record<string, unknown> = {
    name: payload.name,
    amount: payload.amount,
    payment_method: payload.payment_method,
    billing_anchor_date: payload.billing_anchor_date,
    billing_interval_unit: payload.billing_interval_unit,
    billing_interval_count: payload.billing_interval_count,
    reminder_offsets_minutes: payload.reminder_offsets_minutes,
    day_of_month: payload.day_of_month,
    currency: payload.currency,
    description: payload.description ?? null,
    is_active: payload.is_active,
    next_due_date: payload.next_due_date ?? null,
  };

  if (existingId) {
    const result = await runRecurringPaymentsMutation(
      "update",
      async (candidateRow) =>
        supabase
          .from("recurring_payments")
          .update(candidateRow)
          .eq("id", existingId)
          .eq("user_id", userId)
          .select()
          .single(),
      row
    );

    return normalizeRecurringPayment(
      applyRecurringPaymentFallbacks(result.data, result.strippedColumns, {
        payment_method: payload.payment_method,
        currency: payload.currency,
        billing_anchor_date: payload.billing_anchor_date,
        billing_interval_unit: payload.billing_interval_unit,
        billing_interval_count: payload.billing_interval_count,
        reminder_offsets_minutes: payload.reminder_offsets_minutes,
        next_due_date: payload.next_due_date,
      })
    );
  }

  row.user_id = userId;

  if (process.env.NODE_ENV === "development") {
    console.log("[upsertPayment] insert row:", JSON.stringify(row, null, 2));
  }

  const result = await runRecurringPaymentsMutation(
    "insert",
    async (candidateRow) =>
      supabase
        .from("recurring_payments")
        .insert(candidateRow)
        .select()
        .single(),
    row
  );

  return normalizeRecurringPayment(
    applyRecurringPaymentFallbacks(result.data, result.strippedColumns, {
      payment_method: payload.payment_method,
      currency: payload.currency,
      billing_anchor_date: payload.billing_anchor_date,
      billing_interval_unit: payload.billing_interval_unit,
      billing_interval_count: payload.billing_interval_count,
      reminder_offsets_minutes: payload.reminder_offsets_minutes,
      next_due_date: payload.next_due_date,
    })
  );
}

/** Delete a recurring payment by id */
export async function deletePayment(id: string): Promise<void> {
  await deleteRow("recurring_payments", id);
}

/** Toggle the is_active status of a recurring payment */
export async function togglePaymentActive(
  id: string,
  isActive: boolean
): Promise<RecurringPayment> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("recurring_payments")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as RecurringPayment;
}

// ─── Timeline helpers ────────────────────────────────────────

/** Fetch recent timeline events for the current user */
export async function getRecentTimelineEvents(
  limit = 5
): Promise<TimelineEvent[]> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("timeline_events")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as TimelineEvent[];
}

// ─── Realtime subscription helpers ───────────────────────────

export type RealtimeCallback = () => void;

/** Subscribe to realtime changes on recurring_payments for current user */
export function subscribeToPayments(
  userId: string,
  callback: RealtimeCallback
) {
  const channel = supabase
    .channel(`recurring-payments-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "recurring_payments",
        filter: `user_id=eq.${userId}`,
      },
      callback
    )
    .subscribe();

  return channel;
}

/** Subscribe to realtime changes on timeline_events for current user */
export function subscribeToTimeline(
  userId: string,
  callback: RealtimeCallback
) {
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
      callback
    )
    .subscribe();

  return channel;
}
