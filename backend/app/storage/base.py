from abc import ABC, abstractmethod


class StorageBackend(ABC):
    """
    Object storage abstraction. Any backend (local disk, S3, GCS, MinIO...)
    implements this interface so the rest of the app never depends on the
    concrete storage technology - this is what makes CloudVault "cloud
    ready": swapping STORAGE_BACKEND in config is the only change needed
    to move from local disk to S3.
    """

    @abstractmethod
    def write(self, key: str, data: bytes) -> None:
        """Persist bytes under the given object key (overwrites if it exists)."""

    @abstractmethod
    def read(self, key: str) -> bytes:
        """Read bytes stored under the given object key."""

    @abstractmethod
    def delete(self, key: str) -> None:
        """Delete the object at the given key. No-op if missing."""

    @abstractmethod
    def exists(self, key: str) -> bool:
        ...

    @abstractmethod
    def append_chunk(self, key: str, chunk_index: int, data: bytes) -> None:
        """Store an individual upload chunk, addressed by parent key + index."""

    @abstractmethod
    def merge_chunks(self, key: str, chunk_count: int) -> None:
        """Concatenate previously stored chunks into a single final object."""

    @abstractmethod
    def delete_chunks(self, key: str, chunk_count: int) -> None:
        ...
