import math

from tests.helpers import register_and_login


def _upload_small_file(client, headers, name="hello.txt", content=b"Hello, CloudVault!", chunk_size=8):
    init = client.post("/api/v1/files/upload/init", json={
        "file_name": name, "folder_id": None, "total_size_bytes": len(content),
        "mime_type": "text/plain", "chunk_size_bytes": chunk_size,
    }, headers=headers)
    assert init.status_code == 200
    body = init.json()
    version_id, total_chunks = body["version_id"], body["total_chunks"]
    assert total_chunks == math.ceil(len(content) / chunk_size)

    for i in range(total_chunks):
        piece = content[i * chunk_size:(i + 1) * chunk_size]
        resp = client.post(
            f"/api/v1/files/upload/chunk?version_id={version_id}&chunk_index={i}",
            headers=headers,
            files={"chunk": ("part", piece)},
        )
        assert resp.status_code == 200

    complete = client.post("/api/v1/files/upload/complete", json={"version_id": version_id}, headers=headers)
    assert complete.status_code == 200
    return complete.json()


def test_chunked_upload_and_download_roundtrip(client):
    headers = register_and_login(client, email="uploader@example.com")
    content = b"Hello, CloudVault! This content spans multiple small chunks."

    file_meta = _upload_small_file(client, headers, content=content)
    assert file_meta["size_bytes"] == len(content)

    download = client.get(f"/api/v1/files/{file_meta['id']}/download", headers=headers)
    assert download.status_code == 200
    assert download.content == content  # proves compress->encrypt->store->decrypt->decompress roundtrips correctly


def test_upload_rejects_missing_chunks_on_complete(client):
    headers = register_and_login(client, email="incomplete@example.com")
    init = client.post("/api/v1/files/upload/init", json={
        "file_name": "big.bin", "folder_id": None, "total_size_bytes": 100,
        "mime_type": "application/octet-stream", "chunk_size_bytes": 10,
    }, headers=headers)
    version_id = init.json()["version_id"]

    # Only send chunk 0, skip the rest
    client.post(f"/api/v1/files/upload/chunk?version_id={version_id}&chunk_index=0",
                headers=headers, files={"chunk": ("part", b"0123456789")})

    complete = client.post("/api/v1/files/upload/complete", json={"version_id": version_id}, headers=headers)
    assert complete.status_code == 400


def test_rename_move_copy_delete(client):
    headers = register_and_login(client, email="orguser@example.com")
    file_meta = _upload_small_file(client, headers, name="doc.txt", content=b"content")

    folder = client.post("/api/v1/files/folders", json={"name": "Projects", "parent_id": None}, headers=headers).json()

    renamed = client.patch(f"/api/v1/files/{file_meta['id']}/rename", json={"new_name": "renamed.txt"}, headers=headers)
    assert renamed.status_code == 200 and renamed.json()["name"] == "renamed.txt"

    moved = client.patch(f"/api/v1/files/{file_meta['id']}/move", json={"target_folder_id": folder["id"]}, headers=headers)
    assert moved.status_code == 200 and moved.json()["folder_id"] == folder["id"]

    copied = client.post(f"/api/v1/files/{file_meta['id']}/copy", json={"target_folder_id": None}, headers=headers)
    assert copied.status_code == 200
    assert copied.json()["id"] != file_meta["id"]

    deleted = client.delete(f"/api/v1/files/{file_meta['id']}", headers=headers)
    assert deleted.status_code == 204


def test_versioning_creates_new_version_on_reupload(client):
    headers = register_and_login(client, email="versioner@example.com")
    v1 = _upload_small_file(client, headers, name="versioned.txt", content=b"version one content")
    # Re-upload same name -> new version of the same logical file
    v2 = _upload_small_file(client, headers, name="versioned.txt", content=b"version two content, longer")

    assert v1["id"] == v2["id"]  # same logical File row

    versions = client.get(f"/api/v1/files/{v1['id']}/versions", headers=headers).json()
    assert len(versions) == 2

    latest, previous = versions[0], versions[1]
    restore = client.post(f"/api/v1/files/{v1['id']}/versions/{previous['id']}/restore", headers=headers)
    assert restore.status_code == 200

    download = client.get(f"/api/v1/files/{v1['id']}/download", headers=headers)
    assert download.content == b"version one content"


def test_trash_restore_and_permanent_delete(client):
    headers = register_and_login(client, email="trasher@example.com")
    file_meta = _upload_small_file(client, headers, name="temp.txt", content=b"trash me")

    client.delete(f"/api/v1/files/{file_meta['id']}", headers=headers)

    trash = client.get("/api/v1/files/trash", headers=headers).json()
    assert any(f["id"] == file_meta["id"] for f in trash)

    # A trashed file is gone from normal listing/download
    download = client.get(f"/api/v1/files/{file_meta['id']}/download", headers=headers)
    assert download.status_code == 404

    restored = client.post(f"/api/v1/files/{file_meta['id']}/restore", headers=headers)
    assert restored.status_code == 200

    download = client.get(f"/api/v1/files/{file_meta['id']}/download", headers=headers)
    assert download.status_code == 200

    # Delete forever requires it to be in trash first
    forever = client.delete(f"/api/v1/files/{file_meta['id']}/permanent", headers=headers)
    assert forever.status_code == 404  # not in trash (it was restored)

    client.delete(f"/api/v1/files/{file_meta['id']}", headers=headers)
    forever = client.delete(f"/api/v1/files/{file_meta['id']}/permanent", headers=headers)
    assert forever.status_code == 204

    trash_after = client.get("/api/v1/files/trash", headers=headers).json()
    assert not any(f["id"] == file_meta["id"] for f in trash_after)


def test_duplicate_upload_detected_by_hash(client):
    headers = register_and_login(client, email="deduper@example.com")
    content = b"identical bytes across two different files"

    original = _upload_small_file(client, headers, name="original.txt", content=content)
    assert original["is_duplicate"] is False

    copy_upload = _upload_small_file(client, headers, name="different_name.txt", content=content)
    assert copy_upload["is_duplicate"] is True
    assert copy_upload["duplicate_of_file_id"] == original["id"]


def test_unsafe_filename_rejected(client):
    headers = register_and_login(client, email="unsafe@example.com")
    resp = client.post("/api/v1/files/upload/init", json={
        "file_name": "malware.exe", "folder_id": None, "total_size_bytes": 10,
        "mime_type": "application/octet-stream", "chunk_size_bytes": 10,
    }, headers=headers)
    assert resp.status_code == 400


def test_invalid_mime_type_rejected(client):
    headers = register_and_login(client, email="badmime@example.com")
    resp = client.post("/api/v1/files/upload/init", json={
        "file_name": "ok.txt", "folder_id": None, "total_size_bytes": 10,
        "mime_type": "not-a-mime-type", "chunk_size_bytes": 10,
    }, headers=headers)
    assert resp.status_code == 400


def test_oversized_chunk_rejected(client):
    headers = register_and_login(client, email="oversize@example.com")
    init = client.post("/api/v1/files/upload/init", json={
        "file_name": "small_chunks.bin", "folder_id": None, "total_size_bytes": 20,
        "mime_type": "application/octet-stream", "chunk_size_bytes": 10,
    }, headers=headers)
    version_id = init.json()["version_id"]

    # Send a 15-byte chunk when the negotiated chunk size is 10 bytes
    resp = client.post(
        f"/api/v1/files/upload/chunk?version_id={version_id}&chunk_index=0",
        headers=headers, files={"chunk": ("part", b"0" * 15)},
    )
    assert resp.status_code == 413


def test_list_contents_root_folder(client):
    # Regression test: /files/contents used to live at
    # /files/folders/{folder_id}/contents with folder_id as a REQUIRED path
    # param, which made the root folder (folder_id=None) unreachable and
    # never matched the frontend's actual call shape at all.
    headers = register_and_login(client, email="lister@example.com")
    _upload_small_file(client, headers, name="root_file.txt", content=b"at the root")

    resp = client.get("/api/v1/files/contents", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert any(f["name"] == "root_file.txt" for f in body["files"])


def test_list_contents_inside_folder(client):
    headers = register_and_login(client, email="folderlister@example.com")
    folder = client.post("/api/v1/files/folders", json={"name": "Reports", "parent_id": None}, headers=headers).json()

    root_listing = client.get("/api/v1/files/contents", headers=headers).json()
    assert any(f["id"] == folder["id"] for f in root_listing["folders"])

    inside_listing = client.get(f"/api/v1/files/contents?folder_id={folder['id']}", headers=headers).json()
    assert inside_listing["folders"] == []
    assert inside_listing["files"] == []


def test_list_contents_pagination(client):
    headers = register_and_login(client, email="paginator@example.com")
    for i in range(3):
        _upload_small_file(client, headers, name=f"page_file_{i}.txt", content=f"content {i}".encode())

    first_page = client.get("/api/v1/files/contents?limit=2&offset=0", headers=headers).json()
    second_page = client.get("/api/v1/files/contents?limit=2&offset=2", headers=headers).json()

    assert len(first_page["files"]) == 2
    assert len(second_page["files"]) == 1
    first_ids = {f["id"] for f in first_page["files"]}
    second_ids = {f["id"] for f in second_page["files"]}
    assert first_ids.isdisjoint(second_ids)
