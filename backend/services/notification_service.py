from decimal import Decimal
from pathlib import Path
import firebase_admin
from firebase_admin import credentials, messaging
from config import get_settings


class NotificationService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.enabled = False
        self._init_firebase()

    def _init_firebase(self) -> None:
        credentials_path = self.settings.FIREBASE_CREDENTIALS_PATH
        if not credentials_path:
            self.enabled = False
            return

        path = Path(credentials_path)
        if not path.exists():
            self.enabled = False
            return

        try:
            if not firebase_admin._apps:
                cred = credentials.Certificate(str(path))
                firebase_admin.initialize_app(cred)
            self.enabled = True
        except Exception:
            self.enabled = False

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
            return False
