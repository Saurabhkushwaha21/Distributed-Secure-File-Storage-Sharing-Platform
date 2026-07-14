import os
import shutil

from app.config import get_settings
from app.storage.base import StorageBackend

settings = get_settings()


class LocalStorageBackend(StorageBackend):
    def __init__(self, root: str | None = None):
        self.root = root or settings.LOCAL_STORAGE_ROOT
        os.makedirs(self.root, exist_ok=True)
        os.makedirs(os.path.join(self.root, "_chunks"), exist_ok=True)

    def _path(self, key: str) -> str:
        path = os.path.join(self.root, key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        return path

    def _chunk_path(self, key: str, chunk_index: int) -> str:
        safe_key = key.replace("/", "_")
        path = os.path.join(self.root, "_chunks", safe_key, f"{chunk_index:08d}.part")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        return path

    def write(self, key: str, data: bytes) -> None:
        with open(self._path(key), "wb") as f:
            f.write(data)

    def read(self, key: str) -> bytes:
        with open(self._path(key), "rb") as f:
            return f.read()

    def delete(self, key: str) -> None:
        path = self._path(key)
        if os.path.exists(path):
            os.remove(path)

    def exists(self, key: str) -> bool:
        return os.path.exists(self._path(key))

    def append_chunk(self, key: str, chunk_index: int, data: bytes) -> None:
        with open(self._chunk_path(key, chunk_index), "wb") as f:
            f.write(data)

    def merge_chunks(self, key: str, chunk_count: int) -> None:
        final_path = self._path(key)
        with open(final_path, "wb") as out:
            for i in range(chunk_count):
                chunk_path = self._chunk_path(key, i)
                with open(chunk_path, "rb") as part:
                    shutil.copyfileobj(part, out)
        self.delete_chunks(key, chunk_count)

    def delete_chunks(self, key: str, chunk_count: int) -> None:
        safe_key = key.replace("/", "_")
        chunk_dir = os.path.join(self.root, "_chunks", safe_key)
        if os.path.exists(chunk_dir):
            shutil.rmtree(chunk_dir)
