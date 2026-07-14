from datetime import datetime, timedelta

from tests.helpers import register_and_login


def _upload_small_file(client, headers, name="file.txt", content=b"hello world", folder_id=None):
    init = client.post("/api/v1/files/upload/init", json={
        "file_name": name, "folder_id": folder_id, "total_size_bytes": len(content),
        "mime_type": "text/plain", "chunk_size_bytes": len(content) or 1,
    }, headers=headers)
    version_id = init.json()["version_id"]
    client.post(
        f"/api/v1/files/upload/chunk?version_id={version_id}&chunk_index=0",
        headers=headers, files={"chunk": ("part", content)},
    )
    complete = client.post("/api/v1/files/upload/complete", json={"version_id": version_id}, headers=headers)
    return complete.json()


def _patch_session_local(monkeypatch, db_session):
    """
    Tasks call `from app.database.session import SessionLocal` fresh at
    call-time and then `.close()` it in a finally block. Pointing
    SessionLocal at the test's own session (same SQLite file db_session
    uses) means the task's queries/commits land in the same place the
    test can then assert against - `.close()` on a SQLAlchemy Session
    doesn't prevent further use, it just ends the current transaction, so
    reusing the same Session object afterward is safe here.
    """
    monkeypatch.setattr("app.database.session.SessionLocal", lambda: db_session)


def test_purge_expired_trash_removes_only_expired_files(client, db_session, monkeypatch):
    from app.files.models import File
    from app.workers.tasks import purge_expired_trash

    headers = register_and_login(client, email="purgeuser@example.com")
    expired_file = _upload_small_file(client, headers, name="old.txt", content=b"old content")
    recent_file = _upload_small_file(client, headers, name="recent.txt", content=b"recent content")

    client.delete(f"/api/v1/files/{expired_file['id']}", headers=headers)
    client.delete(f"/api/v1/files/{recent_file['id']}", headers=headers)

    # Backdate only the "expired" file's updated_at past the retention window
    row = db_session.query(File).filter(File.id == expired_file["id"]).first()
    row.updated_at = datetime.utcnow() - timedelta(days=999)
    db_session.commit()

    _patch_session_local(monkeypatch, db_session)
    result = purge_expired_trash()

    assert result["purged"] == 1
    remaining_ids = {f.id for f in db_session.query(File).all()}
    assert expired_file["id"] not in remaining_ids
    assert recent_file["id"] in remaining_ids  # still in trash, not old enough to purge


def test_recompute_analytics_snapshots_every_user(client, db_session, monkeypatch):
    from app.analytics.models import StorageUsageSnapshot
    from app.workers.tasks import recompute_analytics

    headers = register_and_login(client, email="snapshotuser@example.com")
    _upload_small_file(client, headers, name="a.txt", content=b"12345")

    _patch_session_local(monkeypatch, db_session)
    result = recompute_analytics()

    assert result["users_processed"] >= 1
    snapshots = db_session.query(StorageUsageSnapshot).all()
    assert len(snapshots) >= 1
    assert any(s.file_count == 1 for s in snapshots)


def test_process_uploaded_file_logs_upload_activity(client, db_session, monkeypatch):
    from app.files.models import ActivityLog
    from app.workers import tasks

    headers = register_and_login(client, email="processuser@example.com")
    file_meta = _upload_small_file(client, headers, name="proc.txt", content=b"data")

    # generate_thumbnail/scan_for_malware are stubs that .delay() to a real
    # broker - not reachable in this test environment, so no-op them
    # rather than pull in broker/eager-mode config just for this test.
    monkeypatch.setattr(tasks.generate_thumbnail, "delay", lambda *a, **kw: None)
    monkeypatch.setattr(tasks.scan_for_malware, "delay", lambda *a, **kw: None)
    _patch_session_local(monkeypatch, db_session)

    version_id = file_meta["current_version_id"]
    result = tasks.process_uploaded_file(file_meta["id"], version_id)

    assert result["status"] == "processed"
    logs = db_session.query(ActivityLog).filter(
        ActivityLog.resource_id == file_meta["id"], ActivityLog.action == "UPLOAD"
    ).all()
    assert len(logs) >= 1


def test_process_uploaded_file_skips_missing_file(client, db_session, monkeypatch):
    from app.workers import tasks

    _patch_session_local(monkeypatch, db_session)
    result = tasks.process_uploaded_file("nonexistent-file-id", "nonexistent-version-id")

    assert result["status"] == "skipped"
