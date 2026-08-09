import os

os.environ.setdefault("FILE_ENCRYPTION_KEY", "cGxhY2Vob2xkZXJfMzJfYnl0ZV9rZXlfMTIzNDU2")

from app.security.encryption import generate_data_key, wrap_key, unwrap_key, encrypt_bytes, decrypt_bytes
from app.security.password import hash_password, verify_password


def test_data_key_wrap_unwrap_roundtrip():
    dek = generate_data_key()
    wrapped = wrap_key(dek)
    assert unwrap_key(wrapped) == dek


def test_file_content_encrypt_decrypt_roundtrip():
    dek = generate_data_key()
    plaintext = b"This is sensitive file content that must round-trip exactly."
    ciphertext = encrypt_bytes(plaintext, dek)
    assert ciphertext != plaintext
    assert decrypt_bytes(ciphertext, dek) == plaintext


def test_wrong_key_fails_to_decrypt():
    dek_a = generate_data_key()
    dek_b = generate_data_key()
    ciphertext = encrypt_bytes(b"secret", dek_a)
    try:
        decrypt_bytes(ciphertext, dek_b)
        assert False, "Expected decryption with wrong key to fail"
    except Exception:
        pass


def test_password_hash_and_verify():
    hashed = hash_password("correct-horse-battery-staple")
    assert verify_password("correct-horse-battery-staple", hashed)
    assert not verify_password("wrong-password", hashed)
