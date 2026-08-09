from tests.helpers import register_and_login


def test_get_my_profile(client):
    headers = register_and_login(client, email="profileuser@example.com", full_name="Profile User")
    resp = client.get("/api/v1/users/me", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "profileuser@example.com"
    assert body["full_name"] == "Profile User"


def test_update_my_profile_changes_full_name(client):
    headers = register_and_login(client, email="renameme@example.com", full_name="Old Name")
    resp = client.patch("/api/v1/users/me", json={"full_name": "New Name"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "New Name"

    refetched = client.get("/api/v1/users/me", headers=headers).json()
    assert refetched["full_name"] == "New Name"


def test_update_my_profile_partial_update_leaves_name_unchanged_if_omitted(client):
    headers = register_and_login(client, email="partialupdate@example.com", full_name="Keep Me")
    resp = client.patch("/api/v1/users/me", json={}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Keep Me"


def test_get_my_quota_reflects_uploaded_bytes(client):
    headers = register_and_login(client, email="quotachecker@example.com")

    before = client.get("/api/v1/users/me/quota", headers=headers).json()
    assert before["used_bytes"] == 0
    assert before["quota_bytes"] > 0

    content = b"twenty bytes of data"
    init = client.post("/api/v1/files/upload/init", json={
        "file_name": "quota_test.txt", "folder_id": None, "total_size_bytes": len(content),
        "mime_type": "text/plain", "chunk_size_bytes": len(content),
    }, headers=headers)
    version_id = init.json()["version_id"]
    client.post(f"/api/v1/files/upload/chunk?version_id={version_id}&chunk_index=0",
                headers=headers, files={"chunk": ("part", content)})
    client.post("/api/v1/files/upload/complete", json={"version_id": version_id}, headers=headers)

    after = client.get("/api/v1/users/me/quota", headers=headers).json()
    assert after["used_bytes"] == len(content)
    assert after["available_bytes"] == after["quota_bytes"] - len(content)
    assert after["percent_used"] >= 0


def test_profile_endpoints_require_auth(client):
    assert client.get("/api/v1/users/me").status_code == 401
    assert client.get("/api/v1/users/me/quota").status_code == 401
