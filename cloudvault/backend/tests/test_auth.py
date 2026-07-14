def test_register_and_login(client):
    resp = client.post("/api/v1/auth/register", json={
        "email": "alice@example.com", "password": "SuperSecret1!", "full_name": "Alice",
    })
    assert resp.status_code == 201

    resp = client.post("/api/v1/auth/login", json={
        "email": "alice@example.com", "password": "SuperSecret1!", "device_info": "pytest",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body and "refresh_token" in body


def test_login_wrong_password_fails(client):
    client.post("/api/v1/auth/register", json={
        "email": "bob@example.com", "password": "SuperSecret1!", "full_name": "Bob",
    })
    resp = client.post("/api/v1/auth/login", json={
        "email": "bob@example.com", "password": "WrongPassword", "device_info": "pytest",
    })
    assert resp.status_code == 401


def test_duplicate_registration_conflict(client):
    payload = {"email": "carol@example.com", "password": "SuperSecret1!", "full_name": "Carol"}
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    assert client.post("/api/v1/auth/register", json=payload).status_code == 409


def test_refresh_token_rotation(client):
    client.post("/api/v1/auth/register", json={
        "email": "dave@example.com", "password": "SuperSecret1!", "full_name": "Dave",
    })
    login = client.post("/api/v1/auth/login", json={
        "email": "dave@example.com", "password": "SuperSecret1!", "device_info": "pytest",
    }).json()

    refreshed = client.post("/api/v1/auth/refresh", json={"refresh_token": login["refresh_token"]})
    assert refreshed.status_code == 200
    assert refreshed.json()["access_token"] != login["access_token"]

    # Reusing the rotated-out (old) refresh token must now fail
    reused = client.post("/api/v1/auth/refresh", json={"refresh_token": login["refresh_token"]})
    assert reused.status_code == 401


def test_brute_force_protection_locks_after_threshold(client):
    client.post("/api/v1/auth/register", json={
        "email": "eve@example.com", "password": "SuperSecret1!", "full_name": "Eve",
    })
    for _ in range(5):
        client.post("/api/v1/auth/login", json={"email": "eve@example.com", "password": "wrong", "device_info": "pytest"})

    resp = client.post("/api/v1/auth/login", json={"email": "eve@example.com", "password": "wrong", "device_info": "pytest"})
    assert resp.status_code == 429


def test_weak_password_rejected_on_register(client):
    resp = client.post("/api/v1/auth/register", json={
        "email": "weak@example.com", "password": "alllowercase", "full_name": "Weak",
    })
    assert resp.status_code == 422


def test_persisted_lockout_blocks_login_even_with_correct_password(client, db_session):
    from datetime import datetime, timedelta
    from app.users.models import User

    client.post("/api/v1/auth/register", json={
        "email": "frank@example.com", "password": "SuperSecret1!", "full_name": "Frank",
    })

    user = db_session.query(User).filter(User.email == "frank@example.com").first()
    user.locked_until = datetime.utcnow() + timedelta(minutes=15)
    db_session.commit()

    resp = client.post("/api/v1/auth/login", json={
        "email": "frank@example.com", "password": "SuperSecret1!", "device_info": "pytest",
    })
    assert resp.status_code == 423


def test_otp_verification_rate_limited(client):
    client.post("/api/v1/auth/register", json={
        "email": "grace@example.com", "password": "SuperSecret1!", "full_name": "Grace",
    })
    for _ in range(5):
        client.post("/api/v1/auth/verify-email", json={"email": "grace@example.com", "code": "000000"})

    resp = client.post("/api/v1/auth/verify-email", json={"email": "grace@example.com", "code": "000000"})
    assert resp.status_code == 429
