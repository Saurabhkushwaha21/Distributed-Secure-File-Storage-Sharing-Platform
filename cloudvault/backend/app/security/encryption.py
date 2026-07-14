"""
File-content encryption service.

Uses Fernet (AES-128-CBC + HMAC in the stdlib `cryptography` package's high
level API is AES-128; for true AES-256-GCM we use AESGCM directly below,
which is what production CloudVault should use). Each file gets its own
randomly generated Data Encryption Key (DEK); the DEK itself is wrapped with
the master key (KEK) from settings before being stored in FileVersion
metadata. This is the standard envelope-encryption pattern used by S3/KMS.
"""
import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import get_settings

settings = get_settings()


def _master_key_bytes() -> bytes:
    # FILE_ENCRYPTION_KEY is a urlsafe-base64 32-byte key (AES-256 key length)
    key = settings.FILE_ENCRYPTION_KEY.encode()
    # Normalize to exactly 32 bytes for AES-256
    return base64.urlsafe_b64decode(key + b"=" * (-len(key) % 4))[:32].ljust(32, b"0")


def generate_data_key() -> bytes:
    """Generate a fresh random 32-byte (AES-256) data encryption key per file."""
    return AESGCM.generate_key(bit_length=256)


def wrap_key(dek: bytes) -> str:
    """Encrypt (wrap) a data-encryption-key with the master key for storage."""
    aesgcm = AESGCM(_master_key_bytes())
    nonce = os.urandom(12)
    wrapped = aesgcm.encrypt(nonce, dek, associated_data=None)
    return base64.urlsafe_b64encode(nonce + wrapped).decode()


def unwrap_key(wrapped_key_b64: str) -> bytes:
    raw = base64.urlsafe_b64decode(wrapped_key_b64.encode())
    nonce, ciphertext = raw[:12], raw[12:]
    aesgcm = AESGCM(_master_key_bytes())
    return aesgcm.decrypt(nonce, ciphertext, associated_data=None)


def encrypt_bytes(data: bytes, dek: bytes) -> bytes:
    """Encrypt a chunk/file payload with AES-256-GCM. Nonce is prepended to output."""
    aesgcm = AESGCM(dek)
    nonce = os.urandom(12)
    return nonce + aesgcm.encrypt(nonce, data, associated_data=None)


def decrypt_bytes(blob: bytes, dek: bytes) -> bytes:
    aesgcm = AESGCM(dek)
    nonce, ciphertext = blob[:12], blob[12:]
    return aesgcm.decrypt(nonce, ciphertext, associated_data=None)
