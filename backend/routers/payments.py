from fastapi import APIRouter, Depends, HTTPException, status

from auth import get_current_user
from models import (
    APIMessage,
    RecurringPaymentCreate,
    RecurringPaymentOut,
    RecurringPaymentUpdate,
    UserContext,
)
from services.payment_service import PaymentService


router = APIRouter(prefix="/payments", tags=["payments"])
service = PaymentService()


@router.get("", response_model=list[RecurringPaymentOut])
def list_payments(user: UserContext = Depends(get_current_user)):
    return service.list_by_user(user.user_id)


@router.post("", response_model=RecurringPaymentOut, status_code=status.HTTP_201_CREATED)
def create_payment(
    payload: RecurringPaymentCreate,
    user: UserContext = Depends(get_current_user),
):
    created = service.create(user.user_id, payload)
    if not created:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Create payment failed")
    return created


@router.put("/{payment_id}", response_model=RecurringPaymentOut)
def update_payment(
    payment_id: str,
    payload: RecurringPaymentUpdate,
    user: UserContext = Depends(get_current_user),
):
    updated = service.update(user.user_id, payment_id, payload)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    return updated


@router.delete("/{payment_id}", response_model=APIMessage)
def delete_payment(payment_id: str, user: UserContext = Depends(get_current_user)):
    deleted = service.delete(user.user_id, payment_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    return APIMessage(message="Payment deleted")
