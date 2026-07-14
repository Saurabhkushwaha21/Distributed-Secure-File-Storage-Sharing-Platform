import pytest
from starlette.websockets import WebSocketDisconnect

from app.security.jwt_handler import create_access_token
from tests.helpers import register_and_login


def _make_admin(client, db_session, email="admin@example.com"):
    from app.users.models import User, UserRole

    client.post("/api/v1/auth/register", json={"email": email, "password": "SuperSecret1!", "full_name": "Admin"})
    user = db_session.query(User).filter(User.email == email).first()
    user.role = UserRole.ADMIN
    db_session.commit()

    login = client.post("/api/v1/auth/login", json={"email": email, "password": "SuperSecret1!", "device_info": "pytest"}).json()
    return {"Authorization": f"Bearer {login['access_token']}"}


def test_websocket_rejects_missing_token(client):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/some-user-id"):
            pass


def test_websocket_rejects_token_for_different_user(client):
    # A valid token for user A must not grant a connection as user B.
    token = create_access_token(user_id="user-a-id", role="USER")
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(f"/ws/user-b-id?token={token}"):
            pass


def test_websocket_accepts_matching_valid_token(client):
    token = create_access_token(user_id="user-a-id", role="USER")
    with client.websocket_connect(f"/ws/user-a-id?token={token}") as ws:
        # Connection succeeded (accept() was called) - nothing more to assert
        # without triggering a real event, so just tear down cleanly.
        pass


def test_admin_quota_rejects_negative_value(client, db_session):
    headers = register_and_login(client, email="quotauser@example.com")
    user_resp = client.get("/api/v1/users/me", headers=headers)
    user_id = user_resp.json()["id"]

    admin_headers = _make_admin(client, db_session)

    resp = client.patch(f"/api/v1/admin/users/{user_id}/quota?quota_bytes=-5", headers=admin_headers)
    assert resp.status_code == 422

    resp_ok = client.patch(f"/api/v1/admin/users/{user_id}/quota?quota_bytes=1000", headers=admin_headers)
    assert resp_ok.status_code == 200
