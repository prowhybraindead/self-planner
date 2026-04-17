"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  format as fnsFormat,
} from "date-fns";
import {
  CalendarDays,
  Check,
  CreditCard,
  Loader2,
  Pause,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AppSelect,
  type AppSelectGroup,
  type AppSelectOption,
} from "@/components/ui/app-select";
import {
  paymentSchema,
  type PaymentFormValues,
  type PaymentValues,
  type RecurringPayment,
} from "@/lib/types";
import { formatDate, formatMoney, formatRelative } from "@/lib/utils";
import {
  getCurrentUserId,
  getCurrentUserPayments,
  subscribeToPayments,
  supabase,
  upsertPayment,
  deletePayment as deletePaymentHelper,
} from "@/lib/supabase";

// ─── Static option sets ──────────────────────────────────────

const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);
const daySelectOptions: AppSelectOption[] = dayOptions.map((day) => ({
  value: String(day),
  label: String(day),
}));

const paymentMethodOptions = [
  { value: "visa", label: "VISA" },
  { value: "mastercard", label: "Mastercard" },
  { value: "paypal", label: "PayPal" },
  { value: "momo", label: "MoMo" },
  { value: "google_play", label: "Google Play" },
  { value: "bank_transfer", label: "Bank Transfer" },
] as const;

const paymentMethodSelectOptions: AppSelectOption[] = paymentMethodOptions.map(
  (method) => ({
    value: method.value,
    label: method.label,
  })
);

const domesticCurrencies = ["VND"] as const;
const internationalCurrencies = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "SGD",
  "AUD",
] as const;

const currencySelectGroups: AppSelectGroup[] = [
  {
    label: "Trong nước",
    options: domesticCurrencies.map((c) => ({ value: c, label: c })),
  },
  {
    label: "Quốc tế",
    options: internationalCurrencies.map((c) => ({ value: c, label: c })),
  },
];

// ─── Date helpers (using date-fns) ───────────────────────────

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Compute the next due date for a given day_of_month using date-fns */
function computeNextDueDateISO(dayOfMonth: number): string {
  const now = new Date();
  const todayDate = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const maxDayThisMonth = getLastDayOfMonth(currentYear, currentMonth);
  const targetDayThisMonth = Math.min(dayOfMonth, maxDayThisMonth);

  if (targetDayThisMonth >= todayDate) {
    const d = new Date(currentYear, currentMonth, targetDayThisMonth);
    return fnsFormat(d, "yyyy-MM-dd");
  }

  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
  const maxDayNextMonth = getLastDayOfMonth(nextYear, nextMonth);
  const targetDayNextMonth = Math.min(dayOfMonth, maxDayNextMonth);
  const d = new Date(nextYear, nextMonth, targetDayNextMonth);

  return fnsFormat(d, "yyyy-MM-dd");
}

/** Get display due date for a payment, fallback to computed */
function getDisplayDueDate(payment: RecurringPayment): string {
  if (payment.next_due_date) {
    return payment.next_due_date;
  }
  return computeNextDueDateISO(payment.day_of_month);
}

/** Format payment method label */
function formatPaymentMethod(
  method: RecurringPayment["payment_method"] | string | null | undefined
): string {
  const target = (method ?? "visa").toLowerCase();
  const matched = paymentMethodOptions.find((o) => o.value === target);
  return matched?.label ?? "VISA";
}

// ─── Small UI components ─────────────────────────────────────

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-300">{message}</p>;
}

function PaymentSkeletonCard() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="animate-pulse space-y-4 p-5">
        <div className="h-4 w-32 rounded bg-white/10" />
        <div className="h-8 w-40 rounded bg-white/10" />
        <div className="h-4 w-44 rounded bg-white/10" />
        <div className="h-9 w-full rounded-xl bg-white/10" />
      </CardContent>
    </Card>
  );
}

// ─── Main page ───────────────────────────────────────────────

export default function PaymentsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [userId, setUserId] = useState<string | null>(null);
  const [payments, setPayments] = useState<RecurringPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] =
    useState<RecurringPayment | null>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PaymentFormValues, unknown, PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      name: "",
      amount: 0,
      payment_method: "visa",
      day_of_month: 1,
      currency: "VND",
      description: "",
      is_active: true,
    },
  });

  const isActiveField = useWatch({ control, name: "is_active" }) ?? true;
  const dayOfMonthField = useWatch({ control, name: "day_of_month" }) ?? 1;
  const paymentMethodField =
    useWatch({ control, name: "payment_method" }) ?? "visa";
  const currencyField = useWatch({ control, name: "currency" }) ?? "VND";
  const editFromQuery = searchParams.get("edit");

  // ─── Fetch ───────────────────────────────────────────────

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCurrentUserPayments({
        order: { column: "created_at", ascending: false },
      });
      setPayments(data);
    } catch (error) {
      toast.error("Không thể tải danh sách payment", {
        description:
          error instanceof Error ? error.message : "Vui lòng thử lại",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Init auth + load ────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const id = await getCurrentUserId();
        if (!mounted) return;
        setUserId(id);
        await fetchPayments();
      } catch (error) {
        if (!mounted) return;
        toast.error("Không thể xác thực người dùng", {
          description:
            error instanceof Error
              ? error.message
              : "Vui lòng đăng nhập lại",
        });
        setLoading(false);
      }
    }

    void init();

    return () => {
      mounted = false;
    };
  }, [fetchPayments]);

  // ─── Realtime subscription ───────────────────────────────

  useEffect(() => {
    if (!userId) return;

    const channel = subscribeToPayments(userId, () => {
      void fetchPayments();
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchPayments, userId]);

  // ─── Dialog helpers ──────────────────────────────────────

  const openCreateDialog = useCallback(() => {
    setEditingPayment(null);
    reset({
      name: "",
      amount: 0,
      payment_method: "visa",
      day_of_month: 1,
      currency: "VND",
      description: "",
      is_active: true,
    });
    setDialogOpen(true);
  }, [reset]);

  const openEditDialog = useCallback(
    (payment: RecurringPayment) => {
      setEditingPayment(payment);
      reset({
        name: payment.name,
        amount: payment.amount,
        payment_method: payment.payment_method ?? "visa",
        day_of_month: payment.day_of_month,
        currency: payment.currency ?? "VND",
        description: payment.description ?? "",
        is_active: payment.is_active,
      });
      setDialogOpen(true);
    },
    [reset]
  );

  // Handle ?edit=<id> query param to pre-open edit dialog
  useEffect(() => {
    if (loading) return;
    if (!editFromQuery) return;

    const targetPayment = payments.find((p) => p.id === editFromQuery);
    if (!targetPayment) return;

    const timer = window.setTimeout(() => {
      openEditDialog(targetPayment);
    }, 0);

    const nextQuery = new URLSearchParams(searchParams.toString());
    nextQuery.delete("edit");
    const next = nextQuery.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, {
      scroll: false,
    });

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    editFromQuery,
    loading,
    openEditDialog,
    pathname,
    payments,
    router,
    searchParams,
  ]);

  // ─── CRUD handlers ───────────────────────────────────────

  const onSubmit = async (values: PaymentValues) => {
    if (!userId) {
      toast.error("Không tìm thấy user", {
        description: "Vui lòng đăng nhập lại",
      });
      return;
    }

    setSaving(true);

    const nextDueDate = computeNextDueDateISO(values.day_of_month);
    const amount = typeof values.amount === "number" && !isNaN(values.amount)
      ? values.amount
      : 0;

    const payload = {
      name: values.name.trim(),
      amount,
      payment_method: values.payment_method,
      day_of_month: values.day_of_month,
      description: values.description?.trim() || null,
      is_active: values.is_active,
      currency: values.currency,
      next_due_date: nextDueDate,   // always a "YYYY-MM-DD" string, never null
    };

    try {
      await upsertPayment(
        payload,
        editingPayment?.id
      );
      await fetchPayments();
      toast.success(
        editingPayment
          ? "Cập nhật payment thành công ✓"
          : "Thêm payment thành công ✓"
      );
      setDialogOpen(false);
    } catch (error) {
      toast.error(
        editingPayment
          ? "Cập nhật payment thất bại"
          : "Thêm payment thất bại",
        {
          description:
            error instanceof Error ? error.message : "Vui lòng thử lại",
        }
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (payment: RecurringPayment) => {
    if (!userId) return;

    const { error } = await supabase
      .from("recurring_payments")
      .update({ is_active: !payment.is_active })
      .eq("id", payment.id)
      .eq("user_id", userId);

    if (error) {
      toast.error("Không thể đổi trạng thái", {
        description: error.message,
      });
      return;
    }

    toast.success(
      payment.is_active ? "Đã tắt payment" : "Đã kích hoạt payment"
    );
  };

  const handleDeletePayment = async (payment: RecurringPayment) => {
    if (!userId) return;
    if (!window.confirm(`Xoá recurring payment "${payment.name}"?`)) return;

    try {
      await deletePaymentHelper(payment.id);
      await fetchPayments();
      toast.success("Đã xoá recurring payment");
    } catch (error) {
      toast.error("Không thể xoá payment", {
        description:
          error instanceof Error ? error.message : "Vui lòng thử lại",
      });
    }
  };

  // ─── Computed values ──────────────────────────────────────

  const activeCount = useMemo(
    () => payments.filter((item) => item.is_active).length,
    [payments]
  );
  const inactiveCount = payments.length - activeCount;

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">
            Recurring Payments
          </h1>
          <p className="mt-1 text-sm text-dark-300">
            {activeCount} active
            {inactiveCount > 0 && ` · ${inactiveCount} paused`} — quản lý các
            khoản thanh toán định kỳ
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Payment
        </Button>
      </motion.div>

      {/* ─── Loading skeleton ─── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <PaymentSkeletonCard key={i} />
          ))}
        </div>
      ) : payments.length === 0 ? (
        /* ─── Empty state ─── */
        <Card>
          <CardContent className="py-16 text-center">
            <CreditCard className="mx-auto mb-3 h-10 w-10 text-dark-400" />
            <p className="text-sm text-dark-300">
              Chưa có recurring payment nào
            </p>
            <Button
              onClick={openCreateDialog}
              variant="outline"
              className="mt-4"
            >
              Tạo payment đầu tiên
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* ─── Grid cards ─── */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {payments.map((payment, index) => {
            const displayDate = getDisplayDueDate(payment);
            const relativeLabel = formatRelative(displayDate);

            return (
              <motion.div
                key={payment.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.25 }}
              >
                <Card className="h-full overflow-hidden">
                  <CardContent className="space-y-4 p-5">
                    {/* ─ Top row ─ */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-medium text-white">
                          {payment.name}
                        </p>
                        <p className="mt-1 text-sm text-dark-300">
                          {formatMoney(
                            Number(payment.amount),
                            payment.currency
                          )}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge variant="outline">
                            {formatPaymentMethod(payment.payment_method)}
                          </Badge>
                          <Badge variant="outline">{payment.currency}</Badge>
                        </div>
                      </div>
                      <Badge
                        variant={payment.is_active ? "success" : "outline"}
                      >
                        {payment.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    {/* ─ Due date section ─ */}
                    <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs text-dark-300">Day of month</p>
                      <p className="text-sm font-semibold text-white">
                        {payment.day_of_month}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-dark-400">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>
                          Next due: {formatDate(displayDate)}
                          <span className="ml-1.5 text-dark-300">
                            ({relativeLabel})
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* ─ Description ─ */}
                    {payment.description ? (
                      <p className="line-clamp-2 text-xs text-dark-300">
                        {payment.description}
                      </p>
                    ) : (
                      <p className="text-xs text-dark-400">No description</p>
                    )}

                    {/* ─ Actions ─ */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openEditDialog(payment)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant={payment.is_active ? "secondary" : "default"}
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => void toggleActive(payment)}
                      >
                        {payment.is_active ? (
                          <>
                            <Pause className="h-3.5 w-3.5" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5" />
                            Resume
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 border-red-400/30 text-red-300 hover:bg-red-500/10"
                        onClick={() => void handleDeletePayment(payment)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─── Add / Edit dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogClose onClose={() => setDialogOpen(false)} />
          <DialogHeader>
            <DialogTitle>
              {editingPayment ? "Edit Payment" : "Add Payment"}
            </DialogTitle>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-medium text-dark-300"
              >
                Name
              </label>
              <Input
                id="name"
                placeholder="Netflix, Spotify..."
                {...register("name")}
              />
              <FormError message={errors.name?.message} />
            </div>

            {/* Amount + Day of month */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="amount"
                  className="mb-1.5 block text-sm font-medium text-dark-300"
                >
                  Amount
                </label>
                <Input
                  id="amount"
                  type="number"
                  min={0}
                  step={1000}
                  {...register("amount", { valueAsNumber: true })}
                />
                <FormError message={errors.amount?.message} />
              </div>

              <div>
                <label
                  htmlFor="day_of_month"
                  className="mb-1.5 block text-sm font-medium text-dark-300"
                >
                  Day of month
                </label>
                <AppSelect
                  id="day_of_month"
                  value={String(dayOfMonthField)}
                  onValueChange={(next) => {
                    setValue("day_of_month", Number(next), {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                  options={daySelectOptions}
                  searchPlaceholder="Type day (1-31)..."
                />
                <FormError message={errors.day_of_month?.message} />
              </div>
            </div>

            {/* Payment method + Currency */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="payment_method"
                  className="mb-1.5 block text-sm font-medium text-dark-300"
                >
                  Pay via
                </label>
                <AppSelect
                  id="payment_method"
                  value={paymentMethodField}
                  onValueChange={(next) => {
                    setValue(
                      "payment_method",
                      next as PaymentValues["payment_method"],
                      { shouldDirty: true, shouldValidate: true }
                    );
                  }}
                  options={paymentMethodSelectOptions}
                  searchPlaceholder="Type payment method..."
                />
                <FormError message={errors.payment_method?.message} />
              </div>

              <div>
                <label
                  htmlFor="currency"
                  className="mb-1.5 block text-sm font-medium text-dark-300"
                >
                  Currency
                </label>
                <AppSelect
                  id="currency"
                  value={currencyField}
                  onValueChange={(next) => {
                    setValue(
                      "currency",
                      next as PaymentValues["currency"],
                      { shouldDirty: true, shouldValidate: true }
                    );
                  }}
                  groups={currencySelectGroups}
                  searchPlaceholder="Type currency..."
                />
                <FormError message={errors.currency?.message} />
              </div>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="mb-1.5 block text-sm font-medium text-dark-300"
              >
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-dark-400"
                placeholder="Optional note"
                {...register("description")}
              />
              <FormError message={errors.description?.message} />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div>
                <p className="text-sm font-medium text-white">Active status</p>
                <p className="text-xs text-dark-400">
                  Bật/tắt nhắc nhở thanh toán
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setValue("is_active", !isActiveField, {
                    shouldDirty: true,
                  })
                }
                className={`relative h-7 w-12 rounded-full transition ${
                  isActiveField ? "bg-accent-green" : "bg-dark-600"
                }`}
                aria-label="Toggle active status"
                aria-pressed={isActiveField}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                    isActiveField ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {editingPayment ? "Update" : "Create"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
