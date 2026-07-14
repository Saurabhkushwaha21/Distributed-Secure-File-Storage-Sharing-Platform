import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Boolean, BigInteger, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
import enum

from app.database.session import Base


class UserRole(str, enum.Enum):
    USER = "USER"
    ADMIN = "ADMIN"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[str] = mapped_column(SAEnum(UserRole, native_enum=False), default=UserRole.USER)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    storage_quota_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    storage_used_bytes: Mapped[int] = mapped_column(BigInteger, default=0)

    # Persisted account lockout, separate from the Redis-backed login rate
    # limiter: this survives a Redis restart, is visible to admin tooling,
    # and is what an admin "unlock account" action clears.
    failed_login_attempts: Mapped[int] = mapped_column(default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
