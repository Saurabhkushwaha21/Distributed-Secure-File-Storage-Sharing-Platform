import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.files.chunk_upload import storage
from app.files.models import File, Folder, FileVersion, UploadStatus
from app.users.models import User
from app.utils.activity_log import log_activity


def create_folder(db: Session, user: User, name: str, parent_id: str | None) -> Folder:
    if parent_id:
        parent = db.query(Folder).filter(Folder.id == parent_id, Folder.owner_id == user.id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent folder not found")
    folder = Folder(owner_id=user.id, parent_id=parent_id, name=name)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder


def list_folder_contents(db: Session, user: User, folder_id: str | None, limit: int = 100, offset: int = 0):
    folders = (
        db.query(Folder)
        .filter(Folder.owner_id == user.id, Folder.parent_id == folder_id, Folder.is_deleted.is_(False))
        .order_by(Folder.name)
        .limit(limit)
        .offset(offset)
        .all()
    )
    files = (
        db.query(File)
        .filter(File.owner_id == user.id, File.folder_id == folder_id, File.is_deleted.is_(False))
        .order_by(File.updated_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return folders, files


def _get_owned_file(db: Session, user: User, file_id: str) -> File:
    file_row = db.query(File).filter(File.id == file_id, File.owner_id == user.id, File.is_deleted.is_(False)).first()
    if not file_row:
        raise HTTPException(status_code=404, detail="File not found")
    return file_row


def rename_file(db: Session, user: User, file_id: str, new_name: str) -> File:
    file_row = _get_owned_file(db, user, file_id)
    file_row.name = new_name
    db.commit()
    db.refresh(file_row)
    return file_row


def move_file(db: Session, user: User, file_id: str, target_folder_id: str | None) -> File:
    file_row = _get_owned_file(db, user, file_id)
    if target_folder_id:
        target = db.query(Folder).filter(Folder.id == target_folder_id, Folder.owner_id == user.id).first()
        if not target:
            raise HTTPException(status_code=404, detail="Target folder not found")
    file_row.folder_id = target_folder_id
    db.commit()
    db.refresh(file_row)
    return file_row


def copy_file(db: Session, user: User, file_id: str, target_folder_id: str | None) -> File:
    """
    Copy is a metadata + storage-object copy of the CURRENT version only
    (does not duplicate full version history) - this mirrors how most
    consumer file-storage products treat "Make a copy".
    """
    original = _get_owned_file(db, user, file_id)
    if not original.current_version_id:
        raise HTTPException(status_code=400, detail="File has no completed version to copy")

    current_version = db.query(FileVersion).filter(FileVersion.id == original.current_version_id).first()

    available = user.storage_quota_bytes - user.storage_used_bytes
    if current_version.size_bytes > available:
        raise HTTPException(status_code=status.HTTP_507_INSUFFICIENT_STORAGE, detail="Storage quota exceeded")

    new_file = File(
        owner_id=user.id,
        folder_id=target_folder_id if target_folder_id is not None else original.folder_id,
        name=f"{original.name[:246]} (copy)",
        mime_type=original.mime_type,
        size_bytes=original.size_bytes,
    )
    db.add(new_file)
    db.flush()

    new_storage_key = f"{user.id}/{new_file.id}/v1"
    storage.write(new_storage_key, storage.read(current_version.storage_key))

    new_version = FileVersion(
        file_id=new_file.id,
        version_number=1,
        storage_key=new_storage_key,
        size_bytes=current_version.size_bytes,
        checksum_sha256=current_version.checksum_sha256,
        wrapped_data_key=current_version.wrapped_data_key,
        upload_status=UploadStatus.COMPLETED,
        total_chunks=1,
        created_by=user.id,
    )
    db.add(new_version)
    db.flush()
    new_file.current_version_id = new_version.id

    user.storage_used_bytes += current_version.size_bytes
    db.commit()
    db.refresh(new_file)
    return new_file


def delete_file(db: Session, user: User, file_id: str) -> None:
    """Soft delete: keeps rows/versions for recovery/audit. Reclaim happens
    either via restore_file() (undo) or permanently_delete_file() /
    the purge_expired_trash Celery task (actually free storage)."""
    file_row = _get_owned_file(db, user, file_id)
    file_row.is_deleted = True
    user.storage_used_bytes = max(0, user.storage_used_bytes - file_row.size_bytes)
    log_activity(db, user.id, "DELETE", "FILE", resource_id=file_row.id)
    db.commit()


def list_trash(db: Session, user: User, limit: int = 100, offset: int = 0) -> list[File]:
    return (
        db.query(File)
        .filter(File.owner_id == user.id, File.is_deleted.is_(True))
        .order_by(File.updated_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )


def restore_file(db: Session, user: User, file_id: str) -> File:
    file_row = db.query(File).filter(File.id == file_id, File.owner_id == user.id, File.is_deleted.is_(True)).first()
    if not file_row:
        raise HTTPException(status_code=404, detail="File not found in trash")

    # Deleting freed up counted quota without freeing physical storage
    # (bytes are still on disk until a purge). Re-check quota before
    # re-adding the usage on restore, so trash can't be used to bypass it.
    available = user.storage_quota_bytes - user.storage_used_bytes
    if file_row.size_bytes > available:
        raise HTTPException(status_code=status.HTTP_507_INSUFFICIENT_STORAGE, detail="Storage quota exceeded")

    file_row.is_deleted = False
    user.storage_used_bytes += file_row.size_bytes
    log_activity(db, user.id, "RESTORE", "FILE", resource_id=file_row.id)
    db.commit()
    db.refresh(file_row)
    return file_row


def _hard_delete_file(db: Session, file_row: File, action: str = "PERMANENT_DELETE") -> None:
    """Actually frees storage. Shared by the owner-facing permanent-delete
    endpoint (action="PERMANENT_DELETE") and the purge_expired_trash
    background task (action="AUTO_PURGE") - same mechanics, distinguished
    in the audit trail so "I deleted this" and "retention policy deleted
    this automatically" don't look identical to whoever reviews the log."""
    log_activity(db, file_row.owner_id, action, "FILE", resource_id=file_row.id)
    versions = db.query(FileVersion).filter(FileVersion.file_id == file_row.id).all()
    for version in versions:
        storage.delete(version.storage_key)
        db.delete(version)
    db.delete(file_row)
    db.commit()


def permanently_delete_file(db: Session, user: User, file_id: str) -> None:
    """Owner-facing 'Delete forever'. Requires the file to already be in
    trash (is_deleted=True) - a deliberate two-step delete, matching
    typical trash UX and reducing the blast radius of a single mistaken
    call."""
    file_row = db.query(File).filter(File.id == file_id, File.owner_id == user.id, File.is_deleted.is_(True)).first()
    if not file_row:
        raise HTTPException(status_code=404, detail="File not found in trash")
    _hard_delete_file(db, file_row, action="PERMANENT_DELETE")


def list_versions(db: Session, user: User, file_id: str) -> list[FileVersion]:
    _get_owned_file(db, user, file_id)
    return (
        db.query(FileVersion)
        .filter(FileVersion.file_id == file_id, FileVersion.upload_status == UploadStatus.COMPLETED)
        .order_by(FileVersion.version_number.desc())
        .all()
    )


def restore_version(db: Session, user: User, file_id: str, version_id: str) -> File:
    file_row = _get_owned_file(db, user, file_id)
    version = db.query(FileVersion).filter(FileVersion.id == version_id, FileVersion.file_id == file_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    file_row.current_version_id = version.id
    file_row.size_bytes = version.size_bytes
    db.commit()
    db.refresh(file_row)
    return file_row


def delete_version(db: Session, user: User, file_id: str, version_id: str) -> None:
    file_row = _get_owned_file(db, user, file_id)
    if file_row.current_version_id == version_id:
        raise HTTPException(status_code=400, detail="Cannot delete the current active version")
    version = db.query(FileVersion).filter(FileVersion.id == version_id, FileVersion.file_id == file_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    storage.delete(version.storage_key)
    db.delete(version)
    db.commit()


def compare_versions(db: Session, user: User, file_id: str, version_id_a: str, version_id_b: str) -> dict:
    _get_owned_file(db, user, file_id)
    va = db.query(FileVersion).filter(FileVersion.id == version_id_a, FileVersion.file_id == file_id).first()
    vb = db.query(FileVersion).filter(FileVersion.id == version_id_b, FileVersion.file_id == file_id).first()
    if not va or not vb:
        raise HTTPException(status_code=404, detail="One or both versions not found")
    return {
        "version_a": {"id": va.id, "number": va.version_number, "size_bytes": va.size_bytes, "checksum": va.checksum_sha256, "created_at": va.created_at},
        "version_b": {"id": vb.id, "number": vb.version_number, "size_bytes": vb.size_bytes, "checksum": vb.checksum_sha256, "created_at": vb.created_at},
        "size_diff_bytes": vb.size_bytes - va.size_bytes,
        "content_identical": va.checksum_sha256 == vb.checksum_sha256,
    }
