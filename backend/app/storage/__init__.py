from functools import lru_cache

from app.config import get_settings
from app.storage.base import StorageBackend
from app.storage.local_storage import LocalStorageBackend

settings = get_settings()


@lru_cache
def get_storage_backend() -> StorageBackend:
    if settings.STORAGE_BACKEND == "s3":
        from app.storage.s3_storage import S3StorageBackend
        return S3StorageBackend()
    return LocalStorageBackend()
