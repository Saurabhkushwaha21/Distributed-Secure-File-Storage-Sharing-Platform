from tests.helpers import register_and_login


def _make_admin(client, db_session, email="admin@example.com"):
    from app.users.models import User, UserRole

    client.post("/api/v1/auth/register", json={"email": email, "password": "SuperSecret1!", "full_name": "Admin"})
    user = db_session.query(User).filter(User.email == email).first()
    user.role = UserRole.ADMIN
    db_session.commit()

    login = client.post("/api/v1/auth/login", json={"email": email, "password": "SuperSecret1!", "device_info": "pytest"}).json()
    return {"Authorization": f"Bearer {login['access_token']}"}


def test_non_admin_forbidden_from_admin_endpoints(client):
    headers = register_and_login(client, email="regularjoe@example.com")

    assert client.get("/api/v1/admin/users", headers=headers).status_code == 403
    assert client.get("/api/v1/admin/stats", headers=headers).status_code == 403
    assert client.get("/api/v1/admin/activity-logs", headers=headers).status_code == 403


def test_admin_can_list_users(client, db_session):
    register_and_login(client, email="listed_user@example.com")
    admin_headers = _make_admin(client, db_session)

    resp = client.get("/api/v1/admin/users", headers=admin_headers)
    assert resp.status_code == 200
    emails = [u["email"] for u in resp.json()]
    assert "listed_user@example.com" in emails
    assert "admin@example.com" in emails


def test_admin_can_deactivate_user(client, db_session):
    from app.users.models import User

    user_headers = register_and_login(client, email="tobedeactivated@example.com")
    admin_headers = _make_admin(client, db_session)

    user_id = client.get("/api/v1/users/me", headers=user_headers).json()["id"]
    resp = client.patch(f"/api/v1/admin/users/{user_id}/deactivate", headers=admin_headers)
    assert resp.status_code == 200

    row = db_session.query(User).filter(User.id == user_id).first()
    assert row.is_active is False


def test_deactivate_nonexistent_user_returns_404(client, db_session):
    admin_headers = _make_admin(client, db_session)
    resp = client.patch("/api/v1/admin/users/does-not-exist/deactivate", headers=admin_headers)
    assert resp.status_code == 404


def test_admin_stats_reflects_real_counts(client, db_session):
    user_headers = register_and_login(client, email="statsuser@example.com")
    admin_headers = _make_admin(client, db_session)

    init = client.post("/api/v1/files/upload/init", json={
        "file_name": "stats.txt", "folder_id": None, "total_size_bytes": 5,
        "mime_type": "text/plain", "chunk_size_bytes": 5,
    }, headers=user_headers)
    version_id = init.json()["version_id"]
    client.post(f"/api/v1/files/upload/chunk?version_id={version_id}&chunk_index=0",
                headers=user_headers, files={"chunk": ("part", b"hello")})
    client.post("/api/v1/files/upload/complete", json={"version_id": version_id}, headers=user_headers)

    resp = client.get("/api/v1/admin/stats", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_users"] >= 2  # statsuser + admin
    assert body["total_files"] >= 1
    assert body["total_storage_bytes"] >= 5


def test_admin_activity_logs_lists_and_paginates(client, db_session):
    user_headers = register_and_login(client, email="loggeduser@example.com")
    admin_headers = _make_admin(client, db_session)

    # A login is enough to generate at least one ActivityLog row for this user
    resp = client.get("/api/v1/admin/activity-logs?limit=1&offset=0", headers=admin_headers)
    assert resp.status_code == 200
    assert len(resp.json()) <= 1


def test_admin_can_unlock_a_locked_account(client, db_session):
    from datetime import datetime, timedelta
    from app.users.models import User

    user_headers = register_and_login(client, email="lockeduser@example.com")
    admin_headers = _make_admin(client, db_session)
    user_id = client.get("/api/v1/users/me", headers=user_headers).json()["id"]

    row = db_session.query(User).filter(User.id == user_id).first()
    row.failed_login_attempts = 5
    row.locked_until = datetime.utcnow() + timedelta(minutes=15)
    db_session.commit()

    resp = client.patch(f"/api/v1/admin/users/{user_id}/unlock", headers=admin_headers)
    assert resp.status_code == 200

    db_session.refresh(row)
    assert row.failed_login_attempts == 0
    assert row.locked_until is None


def test_unlock_nonexistent_user_returns_404(client, db_session):
    admin_headers = _make_admin(client, db_session)
    resp = client.patch("/api/v1/admin/users/does-not-exist/unlock", headers=admin_headers)
    assert resp.status_code == 404


def test_update_quota_for_nonexistent_user_returns_404(client, db_session):
    admin_headers = _make_admin(client, db_session)
    resp = client.patch("/api/v1/admin/users/does-not-exist/quota?quota_bytes=1000", headers=admin_headers)
    assert resp.status_code == 404
