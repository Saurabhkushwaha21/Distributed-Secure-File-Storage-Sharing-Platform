from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.security.jwt_handler import get_current_user, CurrentUser
from app.users import schemas
from app.users.models import User

router = APIRouter(prefix="/users", tags=["Users"])


def _get_user_or_404(db: Session, user_id: str) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/me", response_model=schemas.UserProfile)
def get_my_profile(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return _get_user_or_404(db, current_user.id)


@router.patch("/me", response_model=schemas.UserProfile)
def update_my_profile(
    payload: schemas.UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    user = _get_user_or_404(db, current_user.id)
    if payload.full_name is not None:
        user.full_name = payload.full_name
    db.commit()
    db.refresh(user)
    return user


@router.get("/me/quota", response_model=schemas.StorageQuotaResponse)
def get_my_quota(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    user = _get_user_or_404(db, current_user.id)
    available = max(user.storage_quota_bytes - user.storage_used_bytes, 0)
    percent = (user.storage_used_bytes / user.storage_quota_bytes * 100) if user.storage_quota_bytes else 0.0
    return schemas.StorageQuotaResponse(
        quota_bytes=user.storage_quota_bytes,
        used_bytes=user.storage_used_bytes,
        available_bytes=available,
        percent_used=round(percent, 2),
    )
