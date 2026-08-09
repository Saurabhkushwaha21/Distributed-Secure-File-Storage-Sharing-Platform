import os
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ["FILE_ENCRYPTION_KEY"] = "cGxhY2Vob2xkZXJfMzJfYnl0ZV9rZXlfMTIzNDU2"
os.environ["JWT_SECRET_KEY"] = "test-secret-key"
# Tests need a real Redis (rate limiting / refresh-token session store).
# The default in config.py ("redis://redis:6379/0") is the docker-compose
# hostname, which doesn't resolve when running pytest directly on the host
# — only override it if the caller hasn't already set one explicitly.
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

from app.database.session import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def db_session(tmp_path):
    db_path = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})

    # Import all models so metadata is populated before create_all
    from app.auth import models as _a  # noqa: F401
    from app.users import models as _u  # noqa: F401
    from app.files import models as _f  # noqa: F401
    from app.sharing import models as _s  # noqa: F401
    from app.analytics import models as _an  # noqa: F401

    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session, tmp_path, monkeypatch):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    # Rate-limit counters live in Redis, not the per-test SQLite DB, so
    # without this they'd leak across test runs (e.g. a fixed test email
    # like "carol@example.com" re-registering enough times across repeated
    # suite runs to trip the register rate limit years before its window
    # naturally expires).
    from app.security.rate_limit import redis_client
    redis_client.flushdb()

    # Redirect local storage to a temp dir per test
    storage_root = tmp_path / "storage"
    storage_root.mkdir()
    monkeypatch.setenv("LOCAL_STORAGE_ROOT", str(storage_root))

    from app.storage import get_storage_backend
    from app.storage.local_storage import LocalStorageBackend
    get_storage_backend.cache_clear()

    import app.files.chunk_upload as chunk_upload_module
    import app.files.service as file_service_module
    chunk_upload_module.storage = LocalStorageBackend(root=str(storage_root))
    file_service_module.storage = chunk_upload_module.storage

    # Skip real DB init on startup event during tests
    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
