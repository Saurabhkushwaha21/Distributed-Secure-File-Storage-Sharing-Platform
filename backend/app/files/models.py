import uuid
from datetime import datetime
from typing import ClassVar

from sqlalchemy import String, DateTime, BigInteger, ForeignKey, Boolean, Integer, Text, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class Folder(Base):
    __tablename__ = "folders"
    __table_args__ = (
        # Matches list_folder_contents' exact filter: owner_id + parent_id + is_deleted together
        Index("ix_folders_owner_parent_deleted", "owner_id", "parent_id", "is_deleted"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("folders.id", ondelete="CASCADE"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class File(Base):
    """
    Represents a logical file (name + location). Its actual binary content
    lives in FileVersion rows, so every save creates a new immutable
    version and the File row just points at the "current" one.
    """
    __tablename__ = "files"
    __table_args__ = (
        # Matches list_folder_contents' exact filter: owner_id + folder_id + is_deleted together
        Index("ix_files_owner_folder_deleted", "owner_id", "folder_id", "is_deleted"),
        # Matches list_trash's filter: owner_id + is_deleted, sorted by updated_at
        Index("ix_files_owner_deleted_updated", "owner_id", "is_deleted", "updated_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    folder_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("folders.id", ondelete="SET NULL"), nullable=True, index=True)

    name: Mapped[str] = mapped_column(String(255), index=True)
    mime_type: Mapped[str] = mapped_column(String(127), default="application/octet-stream")
    current_version_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Transient, non-persisted duplicate-detection metadata - set only in
    # chunk_upload.complete_upload() right after a fresh upload. ClassVar
    # tells SQLAlchemy's declarative scanner to skip mapping these as
    # columns; they're still freely settable per-instance from plain
    # Python (ClassVar only affects the class-level default/scanning).
    is_duplicate: ClassVar[bool] = False
    duplicate_of_file_id: ClassVar[str | None] = None


class UploadStatus:
    PENDING = "PENDING"
    UPLOADING = "UPLOADING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class FileVersion(Base):
    __tablename__ = "file_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    file_id: Mapped[str] = mapped_column(String(36), ForeignKey("files.id", ondelete="CASCADE"), index=True)
    version_number: Mapped[int] = mapped_column(Integer)

    storage_key: Mapped[str] = mapped_column(String(512))  # object key in the storage backend
    size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    checksum_sha256: Mapped[str] = mapped_column(String(64), index=True)
    chunk_size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)

    is_compressed: Mapped[bool] = mapped_column(Boolean, default=True)
    is_encrypted: Mapped[bool] = mapped_column(Boolean, default=True)
    wrapped_data_key: Mapped[str] = mapped_column(Text)  # envelope-encrypted DEK, see security/encryption.py

    upload_status: Mapped[str] = mapped_column(String(20), default=UploadStatus.PENDING)
    total_chunks: Mapped[int] = mapped_column(Integer, default=1)

    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class FileChunk(Base):
    """Tracks receipt of each chunk during a resumable chunked upload."""
    __tablename__ = "file_chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    version_id: Mapped[str] = mapped_column(String(36), ForeignKey("file_versions.id", ondelete="CASCADE"), index=True)
    chunk_index: Mapped[int] = mapped_column(Integer)
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    checksum_sha256: Mapped[str] = mapped_column(String(64))
    received_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    action: Mapped[str] = mapped_column(String(60))  # e.g. "UPLOAD", "DELETE", "SHARE", "LOGIN"
    resource_type: Mapped[str] = mapped_column(String(30))  # "FILE" | "FOLDER" | "SHARE_LINK" | "AUTH"
    resource_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
