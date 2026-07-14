import json
from datetime import datetime

from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.tasks.process_uploaded_file", bind=True, max_retries=3)
def process_uploaded_file(self, file_id: str, version_id: str):
    """
    Orchestrates all post-upload background work. Chained rather than run
    inline in the request path so an upload's HTTP response returns as soon
    as bytes are durably stored, not after thumbnailing/scanning finish.
    """
    from app.database.session import SessionLocal
    from app.files.models import File, ActivityLog

    db = SessionLocal()
    try:
        file_row = db.query(File).filter(File.id == file_id).first()
        if not file_row:
            return {"status": "skipped", "reason": "file not found"}

        generate_thumbnail.delay(file_id, version_id)
        scan_for_malware.delay(file_id, version_id)

        db.add(ActivityLog(
            user_id=file_row.owner_id, action="UPLOAD", resource_type="FILE",
            resource_id=file_id, metadata_json=json.dumps({"version_id": version_id}),
        ))
        db.commit()
        return {"status": "processed", "file_id": file_id}
    finally:
        db.close()


@celery_app.task(name="app.workers.tasks.generate_thumbnail")
def generate_thumbnail(file_id: str, version_id: str):
    """
    Thumbnail generation for image/video/PDF mime types. Implementation
    would use Pillow for images and ffmpeg for video frame extraction;
    left as an architectural stub here since it's orthogonal to the core
    storage/auth/versioning system this project demonstrates.
    """
    return {"status": "stub", "file_id": file_id, "note": "Pillow/ffmpeg thumbnail pipeline goes here"}


@celery_app.task(name="app.workers.tasks.scan_for_malware")
def scan_for_malware(file_id: str, version_id: str):
    """
    Architecture: this task would call out to ClamAV (via clamd socket) or
    a cloud AV API, then flag the FileVersion as quarantined on a positive
    hit. Left as a stub - wire in a real scanner before handling untrusted
    uploads in production.
    """
    return {"status": "stub", "file_id": file_id, "note": "ClamAV/clamd integration goes here"}


@celery_app.task(name="app.workers.tasks.recompute_analytics")
def recompute_analytics():
    """Nightly job (schedule via Celery beat) to snapshot per-user storage usage."""
    from app.database.session import SessionLocal
    from app.users.models import User
    from app.files.models import File
    from app.analytics.models import StorageUsageSnapshot
    from sqlalchemy import func

    db = SessionLocal()
    try:
        users = db.query(User).all()
        for user in users:
            file_count = db.query(func.count(File.id)).filter(File.owner_id == user.id, File.is_deleted.is_(False)).scalar()
            db.add(StorageUsageSnapshot(
                user_id=user.id, used_bytes=user.storage_used_bytes,
                file_count=file_count, snapshot_date=datetime.utcnow(),
            ))
        db.commit()
        return {"status": "ok", "users_processed": len(users)}
    finally:
        db.close()


@celery_app.task(name="app.workers.tasks.purge_expired_trash")
def purge_expired_trash():
    """
    Nightly job (schedule via Celery beat) that actually reclaims storage
    for files sitting in trash longer than settings.TRASH_RETENTION_DAYS.
    Soft-delete (files/service.delete_file) only flips is_deleted and stops
    counting the bytes against quota - the encrypted blobs stay on disk
    until this runs (or the owner explicitly calls permanently_delete_file).
    """
    from datetime import timedelta

    from app.config import get_settings
    from app.database.session import SessionLocal
    from app.files.models import File
    from app.files.service import _hard_delete_file

    settings = get_settings()
    cutoff = datetime.utcnow() - timedelta(days=settings.TRASH_RETENTION_DAYS)

    db = SessionLocal()
    try:
        expired = db.query(File).filter(File.is_deleted.is_(True), File.updated_at < cutoff).all()
        for file_row in expired:
            _hard_delete_file(db, file_row, action="AUTO_PURGE")
        return {"status": "ok", "purged": len(expired)}
    finally:
        db.close()
