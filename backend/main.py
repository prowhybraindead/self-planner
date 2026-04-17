import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import get_current_user
from config import get_settings
from cron.daily_job import run_daily_payment_job
from database import get_supabase_admin
from models import APIMessage, RegisterFCMRequest, UserContext
from routers import api_router


logger = logging.getLogger(__name__)
settings = get_settings()
scheduler = AsyncIOScheduler(timezone=settings.APP_TIMEZONE)


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not scheduler.running:
        scheduler.add_job(
            run_daily_payment_job,
            trigger=CronTrigger(hour=0, minute=5),
            id="daily-recurring-payment-job",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=1800,
        )
        scheduler.start()
        logger.info("Scheduler started with daily job at 00:05 (%s).", settings.APP_TIMEZONE)

    yield

    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped.")


app = FastAPI(
    title=settings.APP_NAME,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_origin_regex=settings.CORS_ALLOW_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health", response_model=APIMessage)
def health() -> APIMessage:
    return APIMessage(message="ok")


@app.get("/api/health", response_model=APIMessage)
def api_health() -> APIMessage:
    return APIMessage(message="ok")


@app.post("/api/notifications/register-fcm", response_model=APIMessage)
def register_fcm(
    payload: RegisterFCMRequest,
    user: UserContext = Depends(get_current_user),
) -> APIMessage:
    db = get_supabase_admin()
    db.table("user_settings").upsert(
        {
            "user_id": user.user_id,
            "fcm_token": payload.fcm_token,
        },
        on_conflict="user_id",
    ).execute()
    return APIMessage(message="FCM token registered")
