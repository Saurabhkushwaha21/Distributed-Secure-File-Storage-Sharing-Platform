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


def test_dashboard_reflects_uploaded_files(client):
    headers = register_and_login(client, email="dashboarder@example.com")
    _upload_small_file(client, headers, name="a.txt", content=b"12345")
    _upload_small_file(client, headers, name="b.txt", content=b"1234567890")

    resp = client.get("/api/v1/analytics/dashboard", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_files"] == 2
    assert body["total_storage_bytes"] == 15
    assert body["files_by_type"] == {"text/plain": 2}
    assert body["upload_count"] == 2  # regression check: UPLOAD activity wasn't being logged at all before


def test_dashboard_is_cached_briefly(client):
    """
    A short Redis TTL cache sits in front of the aggregation query - upload
    a second file right after reading the dashboard once, and the cached
    response (still showing 1 file) should be returned rather than
    recomputed, until the TTL naturally expires.
    """
    headers = register_and_login(client, email="dashcache@example.com")
    _upload_small_file(client, headers, name="first.txt", content=b"abc")

    first = client.get("/api/v1/analytics/dashboard", headers=headers).json()
    assert first["total_files"] == 1

    _upload_small_file(client, headers, name="second.txt", content=b"def")

    second = client.get("/api/v1/analytics/dashboard", headers=headers).json()
    assert second["total_files"] == 1  # still cached, not yet recomputed
