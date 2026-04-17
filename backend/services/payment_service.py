from datetime import date, datetime, timedelta
from dateutil.relativedelta import relativedelta
from database import get_supabase_admin
from models import RecurringPaymentCreate, RecurringPaymentUpdate
from services.notification_service import NotificationService


def _safe_date(year: int, month: int, day: int) -> date:
    base = date(year, month, 1)
    last_day = (base + relativedelta(months=1) - timedelta(days=1)).day
    return date(year, month, min(day, last_day))


def compute_next_due_date(day_of_month: int, today: date | None = None) -> date:
    anchor = today or date.today()
    current_month_due = _safe_date(anchor.year, anchor.month, day_of_month)
    if current_month_due >= anchor:
        return current_month_due

    next_month = anchor + relativedelta(months=1)
    return _safe_date(next_month.year, next_month.month, day_of_month)


class PaymentService:
    TABLE = "recurring_payments"

    def __init__(self) -> None:
        self.db = get_supabase_admin()
        self.notification_service = NotificationService()

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
        next_due_date = payload.next_due_date or compute_next_due_date(payload.day_of_month)
        data = payload.model_dump()
        data["user_id"] = user_id
        data["next_due_date"] = next_due_date.isoformat()

        result = self.db.table(self.TABLE).insert(data).execute()
        return (result.data or [None])[0]

    def update(self, user_id: str, payment_id: str, payload: RecurringPaymentUpdate):
        updates = payload.model_dump(exclude_unset=True)
        if "day_of_month" in updates and "next_due_date" not in updates:
            updates["next_due_date"] = compute_next_due_date(updates["day_of_month"]).isoformat()

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

    def process_daily_recurring_payments(self) -> dict:
        today = datetime.now().date()
        active_result = (
            self.db.table(self.TABLE)
            .select("*")
            .eq("is_active", True)
            .execute()
        )
        active_payments = active_result.data or []

        notified = 0
        updated = 0

        for payment in active_payments:
            user_id = payment["user_id"]
            day_of_month = int(payment["day_of_month"])
            due_today = _safe_date(today.year, today.month, day_of_month) == today
            if not due_today:
                continue

            next_month_date = _safe_date(
                (today + relativedelta(months=1)).year,
                (today + relativedelta(months=1)).month,
                day_of_month,
            )

            (
                self.db.table(self.TABLE)
                .update({"next_due_date": next_month_date.isoformat()})
                .eq("id", payment["id"])
                .execute()
            )
            updated += 1

            settings_result = (
                self.db.table("user_settings")
                .select("fcm_token")
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )
            fcm_token = (settings_result.data or {}).get("fcm_token")
            if fcm_token:
                sent = self.notification_service.send_payment_due_notification(
                    fcm_token=fcm_token,
                    payment_name=payment["name"],
                    amount=payment["amount"],
                    currency=payment.get("currency", "VND"),
                )
                if sent:
                    notified += 1

        return {
            "checked": len(active_payments),
            "updated_next_due_date": updated,
            "notifications_sent": notified,
        }
