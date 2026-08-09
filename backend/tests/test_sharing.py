from tests.helpers import register_and_login
from tests.test_files import _upload_small_file


def test_share_link_view_only_blocks_download(client):
    headers = register_and_login(client, email="sharer1@example.com")
    file_meta = _upload_small_file(client, headers, content=b"shared content")

    link = client.post("/api/v1/sharing/links", json={
        "file_id": file_meta["id"], "permission": "VIEW",
    }, headers=headers).json()

    view = client.get(f"/api/v1/sharing/public/{link['token']}")
    assert view.status_code == 200

    download = client.post(f"/api/v1/sharing/public/{link['token']}/download", json={})
    assert download.status_code == 403  # VIEW permission does not allow download


def test_share_link_download_permission_works(client):
    headers = register_and_login(client, email="sharer2@example.com")
    file_meta = _upload_small_file(client, headers, content=b"downloadable content")

    link = client.post("/api/v1/sharing/links", json={
        "file_id": file_meta["id"], "permission": "DOWNLOAD",
    }, headers=headers).json()

    download = client.post(f"/api/v1/sharing/public/{link['token']}/download", json={})
    assert download.status_code == 200
    assert download.content == b"downloadable content"


def test_password_protected_share_link(client):
    headers = register_and_login(client, email="sharer3@example.com")
    file_meta = _upload_small_file(client, headers, content=b"secret content")

    link = client.post("/api/v1/sharing/links", json={
        "file_id": file_meta["id"], "permission": "DOWNLOAD", "password": "letmein",
    }, headers=headers).json()

    no_password = client.post(f"/api/v1/sharing/public/{link['token']}/download", json={})
    assert no_password.status_code == 401

    wrong_password = client.post(f"/api/v1/sharing/public/{link['token']}/download", json={"password": "wrong"})
    assert wrong_password.status_code == 401

    correct = client.post(f"/api/v1/sharing/public/{link['token']}/download", json={"password": "letmein"})
    assert correct.status_code == 200


def test_revoked_share_link_returns_404(client):
    headers = register_and_login(client, email="sharer4@example.com")
    file_meta = _upload_small_file(client, headers, content=b"revoke me")

    link = client.post("/api/v1/sharing/links", json={
        "file_id": file_meta["id"], "permission": "DOWNLOAD",
    }, headers=headers).json()

    revoke = client.delete(f"/api/v1/sharing/links/{link['id']}", headers=headers)
    assert revoke.status_code == 204

    resp = client.get(f"/api/v1/sharing/public/{link['token']}")
    assert resp.status_code == 404


def test_share_link_rate_limited_after_repeated_wrong_password(client):
    headers = register_and_login(client, email="sharer5@example.com")
    file_meta = _upload_small_file(client, headers, content=b"brute force target")

    link = client.post("/api/v1/sharing/links", json={
        "file_id": file_meta["id"], "permission": "DOWNLOAD", "password": "correcthorsebattery",
    }, headers=headers).json()

    for _ in range(5):
        client.post(f"/api/v1/sharing/public/{link['token']}/download", json={"password": "wrong"})

    resp = client.post(f"/api/v1/sharing/public/{link['token']}/download", json={"password": "wrong"})
    assert resp.status_code == 429


def test_trashed_file_not_accessible_via_share_link(client):
    headers = register_and_login(client, email="sharer6@example.com")
    file_meta = _upload_small_file(client, headers, content=b"about to be trashed")

    link = client.post("/api/v1/sharing/links", json={
        "file_id": file_meta["id"], "permission": "DOWNLOAD",
    }, headers=headers).json()

    client.delete(f"/api/v1/files/{file_meta['id']}", headers=headers)

    resp = client.get(f"/api/v1/sharing/public/{link['token']}")
    assert resp.status_code == 404
