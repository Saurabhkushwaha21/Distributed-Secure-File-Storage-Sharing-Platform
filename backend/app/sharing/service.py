import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.files.chunk_upload import read_decrypted_version
from app.files.models import File, FileVersion
from app.security.password import hash_password, verify_password
from app.security.rate_limit import check_and_increment, reset, RateLimitExceeded
from app.sharing.models import ShareLink, SharePermission
from app.users.models import User

settings = get_settings()


def create_share_link(db: Session, user: User, file_id: str, permission: str,
                       password: str | None, expires_in_hours: int | None, max_downloads: int | None) -> ShareLink:
    file_row = db.query(File).filter(File.id == file_id, File.owner_id == user.id, File.is_deleted.is_(False)).first()
    if not file_row:
        raise HTTPException(status_code=404, detail="File not found")

    if permission not in (SharePermission.VIEW, SharePermission.DOWNLOAD, SharePermission.EDIT):
        raise HTTPException(status_code=400, detail="Invalid permission")

    link = ShareLink(
        token=secrets.token_urlsafe(24),
        file_id=file_id,
        created_by=user.id,
        permission=permission,
        is_password_protected=password is not None,
        password_hash=hash_password(password) if password else None,
        expires_at=(datetime.utcnow() + timedelta(hours=expires_in_hours)) if expires_in_hours else None,
        max_downloads=max_downloads,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


def _validate_link(db: Session, token: str, password: str | None) -> ShareLink:
    rate_key = f"share-link:{token}"
    try:
        check_and_increment(rate_key, settings.RATE_LIMIT_OTP_ATTEMPTS, settings.RATE_LIMIT_OTP_WINDOW_SECONDS)
    except RateLimitExceeded as e:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))

    link = db.query(ShareLink).filter(ShareLink.token == token).first()
    if not link or link.is_revoked:
        raise HTTPException(status_code=404, detail="Share link not found or revoked")
    if link.expires_at and link.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Share link expired")
    if link.max_downloads is not None and link.download_count >= link.max_downloads:
        raise HTTPException(status_code=410, detail="Share link download limit reached")

    file_row = db.query(File).filter(File.id == link.file_id).first()
    if not file_row or file_row.is_deleted:
        raise HTTPException(status_code=404, detail="Share link not found or revoked")

    if link.is_password_protected:
        if not password or not verify_password(password, link.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Password required or incorrect")

    reset(rate_key)
    return link


def view_shared_file_metadata(db: Session, token: str, password: str | None) -> dict:
    link = _validate_link(db, token, password)
    file_row = db.query(File).filter(File.id == link.file_id).first()
    return {
        "file_name": file_row.name,
        "mime_type": file_row.mime_type,
        "size_bytes": file_row.size_bytes,
        "permission": link.permission,
    }


def download_shared_file(db: Session, token: str, password: str | None) -> tuple[bytes, str, str]:
    link = _validate_link(db, token, password)
    if link.permission not in (SharePermission.DOWNLOAD, SharePermission.EDIT):
        raise HTTPException(status_code=403, detail="This link does not allow downloading")

    file_row = db.query(File).filter(File.id == link.file_id).first()
    version = db.query(FileVersion).filter(FileVersion.id == file_row.current_version_id).first()
    content = read_decrypted_version(version)

    link.download_count += 1
    db.commit()

    return content, file_row.name, file_row.mime_type


def revoke_share_link(db: Session, user: User, link_id: str) -> None:
    link = db.query(ShareLink).filter(ShareLink.id == link_id, ShareLink.created_by == user.id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")
    link.is_revoked = True
    db.commit()


def list_my_share_links(db: Session, user: User) -> list[ShareLink]:
    return db.query(ShareLink).filter(ShareLink.created_by == user.id).order_by(ShareLink.created_at.desc()).all()
