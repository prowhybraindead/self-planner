from fastapi import APIRouter

from routers.calendar import router as calendar_router
from routers.payments import router as payments_router
from routers.timeline import router as timeline_router


api_router = APIRouter(prefix="/api")
api_router.include_router(payments_router)
api_router.include_router(calendar_router)
api_router.include_router(timeline_router)
