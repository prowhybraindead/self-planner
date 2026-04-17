import logging

from services.payment_service import PaymentService


logger = logging.getLogger(__name__)


def run_daily_payment_job() -> None:
    logger.info("Running daily recurring payment job.")
    summary = PaymentService().process_daily_recurring_payments()
    logger.info("Daily recurring payment job completed: %s", summary)
