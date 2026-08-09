from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.files.models import File as FileModel, ActivityLog
from app.security.jwt_handler import require_admin, CurrentUser
from app.users.models import User
from app.utils.activity_log import log_activity

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/users")
def list_users(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    users = db.query(User).order_by(User.created_at.desc()).limit(limit).offset(offset).all()
    return [
        {
            "id": u.id, "email": u.email, "role": u.role, "is_active": u.is_active,
            "storage_used_bytes": u.storage_used_bytes, "storage_quota_bytes": u.storage_quota_bytes,
        }
        for u in users
    ]


@router.patch("/users/{user_id}/deactivate")
def deactivate_user(user_id: str, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    log_activity(db, admin.id, "ADMIN_DEACTIVATE_USER", "USER", resource_id=user_id)
    db.commit()
    return {"message": "User deactivated"}


@router.patch("/users/{user_id}/unlock")
def unlock_user(user_id: str, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.failed_login_attempts = 0
    user.locked_until = None
    log_activity(db, admin.id, "ADMIN_UNLOCK_USER", "USER", resource_id=user_id)
    db.commit()
    return {"message": "Account unlocked"}


@router.patch("/users/{user_id}/quota")
def update_quota(user_id: str, quota_bytes: int = Query(..., ge=0), db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.storage_quota_bytes = quota_bytes
    log_activity(db, admin.id, "ADMIN_UPDATE_QUOTA", "USER", resource_id=user_id, metadata={"new_quota_bytes": quota_bytes})
    db.commit()
    return {"message": "Quota updated", "new_quota_bytes": quota_bytes}


@router.get("/stats")
def system_stats(db: Session = Depends(get_db), _: CurrentUser = Depends(require_admin)):
    total_users = db.query(func.count(User.id)).scalar()
    total_files = db.query(func.count(FileModel.id)).filter(FileModel.is_deleted.is_(False)).scalar()
    total_storage = db.query(func.coalesce(func.sum(User.storage_used_bytes), 0)).scalar()
    return {"total_users": total_users, "total_files": total_files, "total_storage_bytes": total_storage}


@router.get("/activity-logs")
def activity_logs(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    logs = db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(limit).offset(offset).all()
    return [
        {"id": l.id, "user_id": l.user_id, "action": l.action, "resource_type": l.resource_type,
         "resource_id": l.resource_id, "created_at": l.created_at}
        for l in logs
    ]
