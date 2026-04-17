import logging
import smtplib
from email.message import EmailMessage
from decimal import Decimal

from config import get_settings


logger = logging.getLogger(__name__)


class EmailService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.last_error: str | None = None

    def is_enabled(self) -> bool:
        return bool(
            self.settings.SMTP_HOST
            and self.settings.SMTP_FROM_EMAIL
            and self.settings.SMTP_USERNAME
            and self.settings.SMTP_PASSWORD
        )

    def get_status(self) -> dict:
        return {
            "enabled": self.is_enabled(),
            "host": self.settings.SMTP_HOST,
            "port": self.settings.SMTP_PORT,
            "from_email": self.settings.SMTP_FROM_EMAIL,
            "use_tls": self.settings.SMTP_USE_TLS,
            "last_error": self.last_error,
        }

    def send_payment_due_email(
        self,
        to_email: str,
        payment_name: str,
        amount: Decimal | str | float,
        currency: str,
    ) -> bool:
        if not self.is_enabled():
            self.last_error = "SMTP is not configured"
            return False

        try:
            message = EmailMessage()
            message["Subject"] = f"[SelfPlanner] Den han thanh toan: {payment_name}"
            message["From"] = self.settings.SMTP_FROM_EMAIL
            message["To"] = to_email
            message.set_content(
                "\n".join(
                    [
                        "Xin chao anh,",
                        "",
                        "Khoan thanh toan cua anh da den han.",
                        f"- Ten: {payment_name}",
                        f"- So tien: {amount} {currency}",
                        "",
                        "Mo SelfPlanner de cap nhat trang thai.",
                    ]
                )
            )

            with smtplib.SMTP(self.settings.SMTP_HOST, self.settings.SMTP_PORT, timeout=15) as smtp:
                if self.settings.SMTP_USE_TLS:
                    smtp.starttls()
                smtp.login(self.settings.SMTP_USERNAME, self.settings.SMTP_PASSWORD)
                smtp.send_message(message)

            self.last_error = None
            return True
        except Exception:
            self.last_error = "Failed to send email"
            logger.exception("Failed to send payment due email")
            return False

    def send_timeline_reminder_email(
        self,
        to_email: str,
        title: str,
        date_label: str,
    ) -> bool:
        if not self.is_enabled():
            self.last_error = "SMTP is not configured"
            return False

        try:
            message = EmailMessage()
            message["Subject"] = f"[SelfPlanner] Nhac timeline: {title}"
            message["From"] = self.settings.SMTP_FROM_EMAIL
            message["To"] = to_email
            message.set_content(
                "\n".join(
                    [
                        "Xin chao anh,",
                        "",
                        "Anh co mot timeline event sap den han.",
                        f"- Tieu de: {title}",
                        f"- Thoi gian: {date_label}",
                        "",
                        "Mo SelfPlanner de cap nhat trang thai.",
                    ]
                )
            )

            with smtplib.SMTP(self.settings.SMTP_HOST, self.settings.SMTP_PORT, timeout=15) as smtp:
                if self.settings.SMTP_USE_TLS:
                    smtp.starttls()
                smtp.login(self.settings.SMTP_USERNAME, self.settings.SMTP_PASSWORD)
                smtp.send_message(message)

            self.last_error = None
            return True
        except Exception:
            self.last_error = "Failed to send timeline email"
            logger.exception("Failed to send timeline reminder email")
            return False
