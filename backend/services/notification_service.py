from decimal import Decimal
import logging
from pathlib import Path
import firebase_admin
from firebase_admin import credentials, messaging
from config import get_settings

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.enabled = False
        self.last_error: str | None = None
        self.initialized = bool(firebase_admin._apps)
        self._init_firebase()

    def _init_firebase(self) -> None:
        credentials_path = self.settings.FIREBASE_CREDENTIALS_PATH
        if not credentials_path:
            self.enabled = False
            self.last_error = "FIREBASE_CREDENTIALS_PATH is not set"
            return

        path = Path(credentials_path)
        if not path.exists():
            self.enabled = False
            self.last_error = f"Credentials file not found: {path}"
            return

        try:
            if not firebase_admin._apps:
                cred = credentials.Certificate(str(path))
                firebase_admin.initialize_app(cred)
            self.initialized = True
            self.enabled = True
            self.last_error = None
        except Exception:
            self.enabled = False
            self.last_error = "Firebase initialization failed"
            logger.exception("Failed to initialize Firebase Admin SDK")

    def get_status(self) -> dict:
        return {
            "enabled": self.enabled,
            "initialized": self.initialized,
            "project_id": self.settings.FCM_PROJECT_ID,
            "credentials_path": self.settings.FIREBASE_CREDENTIALS_PATH,
            "last_error": self.last_error,
        }

    def send_payment_due_notification(
        self,
        fcm_token: str,
        payment_name: str,
        amount: Decimal,
        currency: str,
    ) -> bool:
        if not self.enabled:
            return False

        try:
            payload = messaging.Message(
                token=fcm_token,
                notification=messaging.Notification(
                    title="Đến hạn thanh toán",
                    body=f"{payment_name} • {amount} {currency}",
                ),
                data={
                    "type": "payment_due",
                    "payment_name": payment_name,
                    "amount": str(amount),
                    "currency": currency,
                },
            )
            messaging.send(payload)
            return True
        except Exception:
            logger.exception("Failed to send payment due notification")
            return False
