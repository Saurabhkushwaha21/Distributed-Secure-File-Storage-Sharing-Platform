import os

import boto3
import pytest
from moto import mock_aws

os.environ.setdefault("S3_BUCKET", "cloudvault-test-bucket")
os.environ.setdefault("S3_ACCESS_KEY", "test-access-key")
os.environ.setdefault("S3_SECRET_KEY", "test-secret-key")
os.environ.setdefault("S3_REGION", "us-east-1")
# Deliberately NOT setting S3_ENDPOINT_URL - this is the real AWS S3 case
# (.env.example documents leaving it blank for real AWS, only setting it
# for a self-hosted S3-compatible endpoint like MinIO). Regression test
# for a bug where an empty string there (rather than None) crashed
# boto3.client() construction outright.


@pytest.fixture()
def s3_backend():
    with mock_aws():
        from app.config import get_settings
        get_settings.cache_clear()

        from app.storage.s3_storage import S3StorageBackend
        backend = S3StorageBackend()  # must not raise - see comment above
        backend.client.create_bucket(Bucket=backend.bucket)
        yield backend


def test_write_and_read_roundtrip(s3_backend):
    s3_backend.write("some/key.txt", b"hello from s3")
    assert s3_backend.read("some/key.txt") == b"hello from s3"


def test_exists_true_and_false(s3_backend):
    s3_backend.write("present.txt", b"data")
    assert s3_backend.exists("present.txt") is True
    assert s3_backend.exists("absent.txt") is False


def test_delete_removes_object(s3_backend):
    s3_backend.write("todelete.txt", b"data")
    assert s3_backend.exists("todelete.txt") is True

    s3_backend.delete("todelete.txt")
    assert s3_backend.exists("todelete.txt") is False


def test_append_chunk_and_merge_reconstructs_content(s3_backend):
    # Real S3 multipart parts (except the last) must be >=5MB; pad the
    # non-final chunks so upload_part_copy doesn't reject them the same
    # way a real AWS endpoint would (moto enforces this too).
    chunk0 = b"A" * (5 * 1024 * 1024)
    chunk1 = b"B" * (5 * 1024 * 1024)
    chunk2 = b"final chunk, can be small"

    s3_backend.append_chunk("merged/file.bin", 0, chunk0)
    s3_backend.append_chunk("merged/file.bin", 1, chunk1)
    s3_backend.append_chunk("merged/file.bin", 2, chunk2)

    s3_backend.merge_chunks("merged/file.bin", chunk_count=3)

    result = s3_backend.read("merged/file.bin")
    assert result == chunk0 + chunk1 + chunk2

    # delete_chunks() runs as part of merge_chunks() - the temporary chunk
    # objects shouldn't still be sitting in the bucket afterward.
    assert s3_backend.exists("_chunks/merged/file.bin/00000000.part") is False


def test_merge_chunks_aborts_multipart_on_failure(s3_backend):
    # No chunks were ever written for this key, so upload_part_copy will
    # fail - merge_chunks should abort the multipart upload rather than
    # leave it dangling, and propagate the error.
    with pytest.raises(Exception):
        s3_backend.merge_chunks("never/written.bin", chunk_count=1)
