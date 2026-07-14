from tests.helpers import register_and_login


def _upload_small_file(client, headers, name="file.txt", content=b"hello world", mime_type="text/plain"):
    init = client.post("/api/v1/files/upload/init", json={
        "file_name": name, "folder_id": None, "total_size_bytes": len(content),
        "mime_type": mime_type, "chunk_size_bytes": len(content) or 1,
    }, headers=headers)
    version_id = init.json()["version_id"]
    client.post(
        f"/api/v1/files/upload/chunk?version_id={version_id}&chunk_index=0",
        headers=headers, files={"chunk": ("part", content)},
    )
    return client.post("/api/v1/files/upload/complete", json={"version_id": version_id}, headers=headers).json()


def test_search_by_name_substring(client):
    headers = register_and_login(client, email="searcher1@example.com")
    _upload_small_file(client, headers, name="quarterly_report.pdf", mime_type="application/pdf")
    _upload_small_file(client, headers, name="vacation_photo.jpg", mime_type="image/jpeg")

    resp = client.get("/api/v1/search/files?q=quarterly", headers=headers)
    assert resp.status_code == 200
    names = [f["name"] for f in resp.json()]
    assert "quarterly_report.pdf" in names
    assert "vacation_photo.jpg" not in names


def test_search_by_mime_type(client):
    headers = register_and_login(client, email="searcher2@example.com")
    _upload_small_file(client, headers, name="doc.pdf", mime_type="application/pdf")
    _upload_small_file(client, headers, name="pic.jpg", mime_type="image/jpeg")

    resp = client.get("/api/v1/search/files?mime_type=application/pdf", headers=headers)
    names = [f["name"] for f in resp.json()]
    assert names == ["doc.pdf"]


def test_search_by_size_range(client):
    headers = register_and_login(client, email="searcher3@example.com")
    _upload_small_file(client, headers, name="small.txt", content=b"tiny")
    _upload_small_file(client, headers, name="big.txt", content=b"a much longer file body here")

    resp = client.get("/api/v1/search/files?min_size_bytes=10", headers=headers)
    names = [f["name"] for f in resp.json()]
    assert "big.txt" in names
    assert "small.txt" not in names


def test_search_only_returns_own_files(client):
    headers_a = register_and_login(client, email="searcher4a@example.com")
    headers_b = register_and_login(client, email="searcher4b@example.com")
    _upload_small_file(client, headers_a, name="private_to_a.txt")

    resp = client.get("/api/v1/search/files?q=private", headers=headers_b)
    assert resp.json() == []


def test_search_excludes_trashed_files(client):
    headers = register_and_login(client, email="searcher5@example.com")
    file_meta = _upload_small_file(client, headers, name="findme.txt")

    client.delete(f"/api/v1/files/{file_meta['id']}", headers=headers)

    resp = client.get("/api/v1/search/files?q=findme", headers=headers)
    assert resp.json() == []


def test_search_pagination(client):
    headers = register_and_login(client, email="searcher6@example.com")
    for i in range(3):
        _upload_small_file(client, headers, name=f"match_{i}.txt")

    first_page = client.get("/api/v1/search/files?q=match&limit=2&offset=0", headers=headers).json()
    second_page = client.get("/api/v1/search/files?q=match&limit=2&offset=2", headers=headers).json()

    assert len(first_page) == 2
    assert len(second_page) == 1
