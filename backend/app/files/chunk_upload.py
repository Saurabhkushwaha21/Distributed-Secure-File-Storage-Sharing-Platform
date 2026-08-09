import hashlib
import math

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.files.models import File, FileVersion, FileChunk, UploadStatus
from app.security.encryption import generate_data_key, wrap_key, encrypt_bytes
from app.storage import get_storage_backend
from app.users.models import User
from app.utils.activity_log import log_activity
from app.utils.validators import is_filename_safe, is_valid_mime_type

settings = get_settings()
storage = get_storage_backend()


def init_upload(db: Session, user: User, file_name: str, folder_id: str | None,
                 total_size_bytes: int, mime_type: str, chunk_size_bytes: int | None) -> tuple[File, FileVersion]:
    if not is_filename_safe(file_name):
        raise HTTPException(
            status_code=400,
            detail="Invalid file name (unsafe characters or a blocked extension)",
        )
    if not is_valid_mime_type(mime_type):
        raise HTTPException(status_code=400, detail="Invalid MIME type")

    if total_size_bytes > settings.MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds max allowed size (10GB)")

    available = user.storage_quota_bytes - user.storage_used_bytes
    if total_size_bytes > available:
        raise HTTPException(status_code=status.HTTP_507_INSUFFICIENT_STORAGE, detail="Storage quota exceeded")

    chunk_size = chunk_size_bytes or settings.CHUNK_SIZE_BYTES
    total_chunks = max(1, math.ceil(total_size_bytes / chunk_size))

    # Find or create the logical File row
    existing = (
        db.query(File)
        .filter(File.owner_id == user.id, File.folder_id == folder_id, File.name == file_name, File.is_deleted.is_(False))
        .first()
    )
    if existing:
        file_row = existing
        next_version_number = (
            db.query(FileVersion).filter(FileVersion.file_id == file_row.id).count() + 1
        )
    else:
        file_row = File(owner_id=user.id, folder_id=folder_id, name=file_name, mime_type=mime_type)
        db.add(file_row)
        db.flush()
        next_version_number = 1

    dek = generate_data_key()
    version = FileVersion(
        file_id=file_row.id,
        version_number=next_version_number,
        storage_key=f"{user.id}/{file_row.id}/v{next_version_number}",
        size_bytes=total_size_bytes,
        checksum_sha256="",  # computed at completion
        chunk_size_bytes=chunk_size,
        wrapped_data_key=wrap_key(dek),
        upload_status=UploadStatus.UPLOADING,
        total_chunks=total_chunks,
        created_by=user.id,
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    db.refresh(file_row)

    return file_row, version


def receive_chunk(db: Session, version: FileVersion, chunk_index: int, data: bytes) -> tuple[int, int]:
    if chunk_index < 0 or chunk_index >= version.total_chunks:
        raise HTTPException(status_code=400, detail="Invalid chunk index")
    if version.upload_status != UploadStatus.UPLOADING:
        raise HTTPException(status_code=409, detail="Upload is not in progress")
    if version.chunk_size_bytes and len(data) > version.chunk_size_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Chunk exceeds the negotiated chunk size ({version.chunk_size_bytes} bytes)",
        )
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty chunk")

    checksum = hashlib.sha256(data).hexdigest()

    # Idempotent: re-uploading the same chunk (retry) just overwrites it.
    existing_chunk = (
        db.query(FileChunk)
        .filter(FileChunk.version_id == version.id, FileChunk.chunk_index == chunk_index)
        .first()
    )

    storage.append_chunk(version.storage_key, chunk_index, data)

    if existing_chunk:
        existing_chunk.size_bytes = len(data)
        existing_chunk.checksum_sha256 = checksum
    else:
        db.add(FileChunk(version_id=version.id, chunk_index=chunk_index, size_bytes=len(data), checksum_sha256=checksum))
    db.commit()

    received = db.query(FileChunk).filter(FileChunk.version_id == version.id).count()
    return received, version.total_chunks


def get_missing_chunks(db: Session, version: FileVersion) -> list[int]:
    """Supports resumable upload: client asks which chunks still need (re)sending."""
    received = {
        row.chunk_index
        for row in db.query(FileChunk.chunk_index).filter(FileChunk.version_id == version.id).all()
    }
    return [i for i in range(version.total_chunks) if i not in received]


def complete_upload(db: Session, user: User, version: FileVersion) -> File:
    missing = get_missing_chunks(db, version)
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing chunks: {missing[:20]}{'...' if len(missing) > 20 else ''}")

    # Merge raw chunks into a single object, then compress + encrypt as a
    # single pass (Upload -> Compression -> Encryption -> Storage pipeline).
    storage.merge_chunks(version.storage_key, version.total_chunks)
    raw = storage.read(version.storage_key)

    from app.utils.compression import compress_bytes
    from app.security.encryption import unwrap_key

    compressed = compress_bytes(raw)
    dek = unwrap_key(version.wrapped_data_key)
    encrypted = encrypt_bytes(compressed, dek)
    storage.write(version.storage_key, encrypted)

    version.checksum_sha256 = hashlib.sha256(raw).hexdigest()
    version.upload_status = UploadStatus.COMPLETED
    version.size_bytes = len(raw)

    file_row = db.query(File).filter(File.id == version.file_id).first()
    file_row.current_version_id = version.id
    file_row.size_bytes = version.size_bytes

    user.storage_used_bytes += version.size_bytes

    log_activity(
        db, user.id, "UPLOAD", "FILE", resource_id=file_row.id,
        metadata={"size_bytes": version.size_bytes, "version_number": version.version_number},
    )

    # Duplicate detection by content hash: each version is encrypted with
    # its own independent key (defense in depth - one leaked key doesn't
    # expose every file), which means we can't safely reuse the same
    # encrypted bytes across two versions. So this flags duplicates by
    # plaintext checksum rather than attempting physical storage dedup.
    duplicate = (
        db.query(FileVersion)
        .join(File, File.id == FileVersion.file_id)
        .filter(
            File.owner_id == user.id,
            File.is_deleted.is_(False),
            FileVersion.checksum_sha256 == version.checksum_sha256,
            FileVersion.id != version.id,
            FileVersion.upload_status == UploadStatus.COMPLETED,
        )
        .first()
    )

    db.commit()
    db.refresh(file_row)

    # Transient, non-persisted fields - set after commit/refresh so they
    # can't be touched by SQLAlchemy's attribute-expiry on commit.
    file_row.is_duplicate = duplicate is not None
    file_row.duplicate_of_file_id = duplicate.file_id if duplicate else None

    # Background tasks (thumbnail generation, virus scan, analytics update)
    # are dispatched asynchronously so upload completion isn't blocked on them.
    try:
        from app.workers.tasks import process_uploaded_file
        process_uploaded_file.delay(file_row.id, version.id)
    except Exception:
        pass  # Celery broker not reachable in this environment/test run

    return file_row


def read_decrypted_version(version: FileVersion) -> bytes:
    from app.security.encryption import unwrap_key
    from app.utils.compression import decompress_bytes

    encrypted = storage.read(version.storage_key)
    dek = unwrap_key(version.wrapped_data_key)
    compressed = decrypt_bytes_or_raise(encrypted, dek)
    return decompress_bytes(compressed)


def decrypt_bytes_or_raise(blob: bytes, dek: bytes) -> bytes:
    from app.security.encryption import decrypt_bytes
    try:
        return decrypt_bytes(blob, dek)
    except Exception:
        raise HTTPException(status_code=500, detail="File integrity check failed (decryption error)")
