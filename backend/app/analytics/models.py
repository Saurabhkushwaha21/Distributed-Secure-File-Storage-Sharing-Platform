import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, BigInteger, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class StorageUsageSnapshot(Base):
    """
    Periodic (e.g. daily, via Celery beat) snapshot of per-user storage
    usage - powers historical usage-over-time charts without expensive
    on-the-fly aggregation of the files table.
    """
    __tablename__ = "storage_usage"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    used_bytes: Mapped[int] = mapped_column(BigInteger)
    file_count: Mapped[int] = mapped_column(Integer)
    snapshot_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
