"""
S3-compatible backend (works against real AWS S3 or any S3-compatible
endpoint such as MinIO). Chunks are stored as separate multipart-style
objects under a `_chunks/<key>/<index>` prefix and merged server-side using
S3's native Multipart Upload API on completion, so merging does not require
downloading the whole file back through the app server.
"""
import boto3
from botocore.client import Config

from app.config import get_settings
from app.storage.base import StorageBackend

settings = get_settings()


class S3StorageBackend(StorageBackend):
    def __init__(self):
        self.bucket = settings.S3_BUCKET
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL or None,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION,
            config=Config(signature_version="s3v4"),
        )
        self._multipart_ids: dict[str, str] = {}

    def write(self, key: str, data: bytes) -> None:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data)

    def read(self, key: str) -> bytes:
        obj = self.client.get_object(Bucket=self.bucket, Key=key)
        return obj["Body"].read()

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def exists(self, key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except self.client.exceptions.ClientError:
            return False

    def append_chunk(self, key: str, chunk_index: int, data: bytes) -> None:
        chunk_key = f"_chunks/{key}/{chunk_index:08d}.part"
        self.client.put_object(Bucket=self.bucket, Key=chunk_key, Body=data)

    def merge_chunks(self, key: str, chunk_count: int) -> None:
        # For real S3, native multipart upload (each chunk >=5MB except the
        # last) is far more efficient than reading chunks back through the
        # app. Here we do a straightforward server-side download+concat via
        # multipart copy for portability across S3-compatible providers.
        mpu = self.client.create_multipart_upload(Bucket=self.bucket, Key=key)
        upload_id = mpu["UploadId"]
        parts = []
        try:
            for i in range(chunk_count):
                chunk_key = f"_chunks/{key}/{i:08d}.part"
                part = self.client.upload_part_copy(
                    Bucket=self.bucket,
                    Key=key,
                    PartNumber=i + 1,
                    UploadId=upload_id,
                    CopySource={"Bucket": self.bucket, "Key": chunk_key},
                )
                parts.append({"ETag": part["CopyPartResult"]["ETag"], "PartNumber": i + 1})
            self.client.complete_multipart_upload(
                Bucket=self.bucket, Key=key, UploadId=upload_id,
                MultipartUpload={"Parts": parts},
            )
        except Exception:
            self.client.abort_multipart_upload(Bucket=self.bucket, Key=key, UploadId=upload_id)
            raise
        self.delete_chunks(key, chunk_count)

    def delete_chunks(self, key: str, chunk_count: int) -> None:
        objects = [{"Key": f"_chunks/{key}/{i:08d}.part"} for i in range(chunk_count)]
        if objects:
            self.client.delete_objects(Bucket=self.bucket, Delete={"Objects": objects})
