from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


PaymentMethod = str
TimelineStatus = str


class APIMessage(BaseModel):
    message: str


class UserContext(BaseModel):
    user_id: str
    email: str | None = None


class RecurringPaymentBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    amount: Decimal = Field(ge=0)
    payment_method: PaymentMethod = "visa"
    currency: str = "VND"
    day_of_month: int = Field(ge=1, le=31)
    description: str | None = None
    is_active: bool = True
    next_due_date: date | None = None


class RecurringPaymentCreate(RecurringPaymentBase):
    pass


class RecurringPaymentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    amount: Decimal | None = Field(default=None, ge=0)
    payment_method: PaymentMethod | None = None
    currency: str | None = None
    day_of_month: int | None = Field(default=None, ge=1, le=31)
    description: str | None = None
    is_active: bool | None = None
    next_due_date: date | None = None


class RecurringPaymentOut(RecurringPaymentBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime


class CalendarEventBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    start_date: datetime
    end_date: datetime | None = None
    is_recurring: bool = False
    recurrence_rule: str | None = None
    color: str = "#38bdf8"


class CalendarEventCreate(CalendarEventBase):
    pass


class CalendarEventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    is_recurring: bool | None = None
    recurrence_rule: str | None = None
    color: str | None = None


class CalendarEventOut(CalendarEventBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime


class TimelineEventBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    date: date
    status: TimelineStatus = "pending"
    category: str | None = None


class TimelineEventCreate(TimelineEventBase):
    pass


class TimelineEventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    date: date | None = None
    status: TimelineStatus | None = None
    category: str | None = None


class TimelineEventOut(TimelineEventBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime


class RegisterFCMRequest(BaseModel):
    fcm_token: str = Field(min_length=20)
