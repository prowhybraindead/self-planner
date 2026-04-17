import logging

from services.payment_service import PaymentService


logger = logging.getLogger(__name__)


def run_payment_reminder_job() -> None:
    logger.info("Running recurring payment reminder job.")
    summary = PaymentService().process_payment_reminders()
    logger.info("Recurring payment reminder job completed: %s", summary)
