from app.files.models import ActivityLog
from tests.helpers import register_and_login


def _upload_small_file(client, headers, name="file.txt", content=b"hello world"):
    init = client.post("/api/v1/files/upload/init", json={
        "file_name": name, "folder_id": None, "total_size_bytes": len(content),
        "mime_type": "text/plain", "chunk_size_bytes": len(content) or 1,
    }, headers=headers)
    version_id = init.json()["version_id"]
    client.post(
        f"/api/v1/files/upload/chunk?version_id={version_id}&chunk_index=0",
        headers=headers, files={"chunk": ("part", content)},
    )
    return client.post("/api/v1/files/upload/complete", json={"version_id": version_id}, headers=headers).json()


def _make_admin(client, db_session, email="audit-admin@example.com"):
    from app.users.models import User, UserRole

    client.post("/api/v1/auth/register", json={"email": email, "password": "SuperSecret1!", "full_name": "Admin"})
    user = db_session.query(User).filter(User.email == email).first()
    user.role = UserRole.ADMIN
    db_session.commit()
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "SuperSecret1!", "device_info": "pytest"}).json()
    return {"Authorization": f"Bearer {login['access_token']}"}


def test_login_writes_activity_log(client, db_session):
    register_and_login(client, email="auditlogin@example.com")

    logs = db_session.query(ActivityLog).filter(ActivityLog.action == "LOGIN").all()
    assert len(logs) == 1
    assert logs[0].resource_type == "AUTH"


def test_failed_login_writes_activity_log(client, db_session):
    client.post("/api/v1/auth/register", json={
        "email": "auditbadlogin@example.com", "password": "SuperSecret1!", "full_name": "Test",
    })
    client.post("/api/v1/auth/login", json={
        "email": "auditbadlogin@example.com", "password": "wrongpassword", "device_info": "pytest",
    })

    logs = db_session.query(ActivityLog).filter(ActivityLog.action == "LOGIN_FAILED").all()
    assert len(logs) == 1


def test_logout_writes_activity_log(client, db_session):
    headers = register_and_login(client, email="auditlogout@example.com")
    client.post("/api/v1/auth/logout-all", headers=headers)

    logs = db_session.query(ActivityLog).filter(ActivityLog.action == "LOGOUT_ALL").all()
    assert len(logs) == 1


def test_download_writes_activity_log(client, db_session):
    headers = register_and_login(client, email="auditdownload@example.com")
    file_meta = _upload_small_file(client, headers)
    client.get(f"/api/v1/files/{file_meta['id']}/download", headers=headers)

    logs = db_session.query(ActivityLog).filter(ActivityLog.action == "DOWNLOAD", ActivityLog.resource_id == file_meta["id"]).all()
    assert len(logs) == 1


def test_delete_and_restore_write_activity_logs(client, db_session):
    headers = register_and_login(client, email="auditdelete@example.com")
    file_meta = _upload_small_file(client, headers)
    client.delete(f"/api/v1/files/{file_meta['id']}", headers=headers)
    client.post(f"/api/v1/files/{file_meta['id']}/restore", headers=headers)

    delete_logs = db_session.query(ActivityLog).filter(ActivityLog.action == "DELETE", ActivityLog.resource_id == file_meta["id"]).all()
    restore_logs = db_session.query(ActivityLog).filter(ActivityLog.action == "RESTORE", ActivityLog.resource_id == file_meta["id"]).all()
    assert len(delete_logs) == 1
    assert len(restore_logs) == 1


def test_admin_actions_write_activity_logs(client, db_session):
    headers = register_and_login(client, email="audittarget@example.com")
    user_id = client.get("/api/v1/users/me", headers=headers).json()["id"]
    admin_headers = _make_admin(client, db_session)

    client.patch(f"/api/v1/admin/users/{user_id}/quota?quota_bytes=500", headers=admin_headers)

    logs = db_session.query(ActivityLog).filter(ActivityLog.action == "ADMIN_UPDATE_QUOTA", ActivityLog.resource_id == user_id).all()
    assert len(logs) == 1
