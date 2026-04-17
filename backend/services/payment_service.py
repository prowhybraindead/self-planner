from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from dateutil.relativedelta import relativedelta

from config import get_settings
from database import get_supabase_admin
from models import RecurringPaymentCreate, RecurringPaymentUpdate
from services.email_service import EmailService
from services.notification_service import NotificationService


def _safe_date(year: int, month: int, day: int) -> date:
    base = date(year, month, 1)
    last_day = (base + relativedelta(months=1) - timedelta(days=1)).day
    return date(year, month, min(day, last_day))


def _normalize_unit(unit: str | None) -> str:
    if unit in {"day", "month", "year"}:
        return unit
    return "month"


def _add_interval(base: date, unit: str, count: int) -> date:
    safe_count = max(1, int(count or 1))
    normalized_unit = _normalize_unit(unit)

    if normalized_unit == "day":
        return base + relativedelta(days=safe_count)
    if normalized_unit == "year":
        return base + relativedelta(years=safe_count)
    return base + relativedelta(months=safe_count)


def _to_date(value: str | date | None) -> date | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        return None


def compute_next_due_date(
    billing_anchor_date: date,
    billing_interval_unit: str,
    billing_interval_count: int,
    today: date | None = None,
) -> date:
    anchor = today or date.today()
    cursor = billing_anchor_date
    guard = 0
    while cursor < anchor and guard < 5000:
        cursor = _add_interval(cursor, billing_interval_unit, billing_interval_count)
        guard += 1
    return cursor


class PaymentService:
    TABLE = "recurring_payments"

    def __init__(self) -> None:
        self.settings = get_settings()
        self.timezone = ZoneInfo(self.settings.APP_TIMEZONE)
        self.db = get_supabase_admin()
        self.notification_service = NotificationService()
        self.email_service = EmailService()

    def list_by_user(self, user_id: str):
        result = (
            self.db.table(self.TABLE)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []

    def create(self, user_id: str, payload: RecurringPaymentCreate):
        next_due_date = payload.next_due_date or compute_next_due_date(
            payload.billing_anchor_date,
            payload.billing_interval_unit,
            payload.billing_interval_count,
        )
        data = payload.model_dump()
        data["user_id"] = user_id
        data["day_of_month"] = payload.billing_anchor_date.day
        data["next_due_date"] = next_due_date.isoformat()

        result = self.db.table(self.TABLE).insert(data).execute()
        return (result.data or [None])[0]

    def update(self, user_id: str, payment_id: str, payload: RecurringPaymentUpdate):
        current_result = (
            self.db.table(self.TABLE)
            .select("*")
            .eq("id", payment_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        current = current_result.data or {}
        updates = payload.model_dump(exclude_unset=True)
        anchor_date = _to_date(updates.get("billing_anchor_date")) or _to_date(current.get("billing_anchor_date"))
        interval_unit = str(updates.get("billing_interval_unit") or current.get("billing_interval_unit") or "month")
        interval_count = int(updates.get("billing_interval_count") or current.get("billing_interval_count") or 1)

        if anchor_date:
            updates["day_of_month"] = anchor_date.day

        should_recompute_due = any(
            key in updates for key in {"billing_anchor_date", "billing_interval_unit", "billing_interval_count", "day_of_month"}
        )
        if should_recompute_due and "next_due_date" not in updates and anchor_date:
            updates["next_due_date"] = compute_next_due_date(anchor_date, interval_unit, interval_count).isoformat()

        result = (
            self.db.table(self.TABLE)
            .update(updates)
            .eq("id", payment_id)
            .eq("user_id", user_id)
            .execute()
        )
        return (result.data or [None])[0]

    def delete(self, user_id: str, payment_id: str) -> bool:
        result = (
            self.db.table(self.TABLE)
            .delete()
            .eq("id", payment_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(result.data)

    def _parse_offsets_minutes(self, value: object) -> list[int]:
        if isinstance(value, list):
            items = value
        elif isinstance(value, tuple):
            items = list(value)
        else:
            items = [1440]

        parsed: list[int] = []
        for item in items:
            try:
                offset = int(item)
            except (TypeError, ValueError):
                continue
            if offset < 0:
                continue
            parsed.append(offset)

        if not parsed:
            parsed = [1440]
        return sorted(set(parsed))

    def _resolve_notification_email(self, user_id: str, configured_email: str | None) -> str | None:
        if configured_email and configured_email.strip():
            return configured_email.strip()
        try:
            user_response = self.db.auth.admin.get_user_by_id(user_id)
            user_obj = getattr(user_response, "user", None)
            email = getattr(user_obj, "email", None)
            if isinstance(email, str) and email.strip():
                return email.strip()
        except Exception:
            return None
        return None

    def _resolve_timezone(self, value: str | None) -> ZoneInfo:
        if value:
            try:
                return ZoneInfo(value)
            except Exception:
                pass
        return self.timezone

    def process_payment_reminders(self) -> dict:
        now = datetime.now(self.timezone).replace(second=0, microsecond=0)
        today = now.date()
        active_result = (
            self.db.table(self.TABLE)
            .select("*")
            .eq("is_active", True)
            .execute()
        )
        active_payments = active_result.data or []

        notified = 0
        emailed = 0
        updated = 0
        due_processed = 0
        settings_cache: dict[str, dict] = {}

        for payment in active_payments:
            user_id = payment["user_id"]
            if user_id in settings_cache:
                settings_row = settings_cache[user_id]
            else:
                settings_result = (
                    self.db.table("user_settings")
                    .select("fcm_token,notification_email,reminder_offsets_minutes,timezone")
                    .eq("user_id", user_id)
                    .maybe_single()
                    .execute()
                )
                settings_row = settings_result.data or {}
                settings_cache[user_id] = settings_row

            user_timezone = self._resolve_timezone(settings_row.get("timezone"))
            user_now = datetime.now(user_timezone).replace(second=0, microsecond=0)
            today = user_now.date()

            interval_unit = _normalize_unit(payment.get("billing_interval_unit"))
            interval_count = int(payment.get("billing_interval_count") or 1)
            stored_next_due = _to_date(payment.get("next_due_date"))
            anchor_date = _to_date(payment.get("billing_anchor_date"))
            if anchor_date is None:
                day_of_month = int(payment.get("day_of_month") or 1)
                anchor_date = _safe_date(today.year, today.month, day_of_month)

            resolved_due = stored_next_due or compute_next_due_date(
                anchor_date,
                interval_unit,
                interval_count,
                today,
            )
            if resolved_due < today:
                resolved_due = compute_next_due_date(anchor_date, interval_unit, interval_count, today)

            (
                self.db.table(self.TABLE)
                .update({"next_due_date": resolved_due.isoformat()})
                .eq("id", payment["id"])
                .execute()
            )
            updated += 1

            offsets_minutes = self._parse_offsets_minutes(settings_row.get("reminder_offsets_minutes"))
            due_datetime = datetime.combine(resolved_due, datetime.min.time(), tzinfo=user_timezone).replace(hour=9)

            should_send_now = False
            for offset in offsets_minutes:
                trigger_at = due_datetime - timedelta(minutes=offset)
                if trigger_at <= user_now < trigger_at + timedelta(minutes=59):
                    should_send_now = True
                    break

            due_reached = resolved_due == today and user_now >= due_datetime
            if not should_send_now and not due_reached:
                continue

            fcm_token = settings_row.get("fcm_token")
            if fcm_token:
                sent = self.notification_service.send_payment_due_notification(
                    fcm_token=fcm_token,
                    payment_name=payment["name"],
                    amount=payment["amount"],
                    currency=payment.get("currency", "VND"),
                )
                if sent:
                    notified += 1

            notification_email = self._resolve_notification_email(
                user_id=user_id,
                configured_email=settings_row.get("notification_email"),
            )
            if notification_email:
                sent_email = self.email_service.send_payment_due_email(
                    to_email=notification_email,
                    payment_name=payment["name"],
                    amount=payment["amount"],
                    currency=payment.get("currency", "VND"),
                )
                if sent_email:
                    emailed += 1

            if due_reached:
                next_due_after_due = _add_interval(resolved_due, interval_unit, interval_count).isoformat()
                (
                    self.db.table(self.TABLE)
                    .update({"next_due_date": next_due_after_due})
                    .eq("id", payment["id"])
                    .execute()
                )
                due_processed += 1

        return {
            "checked": len(active_payments),
            "updated_next_due_date": updated,
            "due_processed": due_processed,
            "notifications_sent": notified,
            "emails_sent": emailed,
        }
