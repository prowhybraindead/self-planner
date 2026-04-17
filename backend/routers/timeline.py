from fastapi import APIRouter, Depends, HTTPException, status

from auth import get_current_user
from database import get_supabase_admin
from models import (
    APIMessage,
    TimelineEventCreate,
    TimelineEventOut,
    TimelineEventUpdate,
    UserContext,
)


router = APIRouter(prefix="/timeline", tags=["timeline"])


@router.get("", response_model=list[TimelineEventOut])
def list_timeline_events(user: UserContext = Depends(get_current_user)):
    db = get_supabase_admin()
    result = (
        db.table("timeline_events")
        .select("*")
        .eq("user_id", user.user_id)
        .order("date", desc=True)
        .order("time_of_day", desc=True)
        .execute()
    )
    return result.data or []


@router.post("", response_model=TimelineEventOut, status_code=status.HTTP_201_CREATED)
def create_timeline_event(
    payload: TimelineEventCreate,
    user: UserContext = Depends(get_current_user),
):
    db = get_supabase_admin()
    data = payload.model_dump()
    data["user_id"] = user.user_id
    result = db.table("timeline_events").insert(data).execute()
    created = (result.data or [None])[0]
    if not created:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Create timeline event failed")
    return created


@router.put("/{event_id}", response_model=TimelineEventOut)
def update_timeline_event(
    event_id: str,
    payload: TimelineEventUpdate,
    user: UserContext = Depends(get_current_user),
):
    db = get_supabase_admin()
    updates = payload.model_dump(exclude_unset=True)
    result = (
        db.table("timeline_events")
        .update(updates)
        .eq("id", event_id)
        .eq("user_id", user.user_id)
        .execute()
    )
    updated = (result.data or [None])[0]
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timeline event not found")
    return updated


@router.delete("/{event_id}", response_model=APIMessage)
def delete_timeline_event(event_id: str, user: UserContext = Depends(get_current_user)):
    db = get_supabase_admin()
    result = (
        db.table("timeline_events")
        .delete()
        .eq("id", event_id)
        .eq("user_id", user.user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timeline event not found")
    return APIMessage(message="Timeline event deleted")
