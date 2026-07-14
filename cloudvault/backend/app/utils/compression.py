import zlib


def compress_bytes(data: bytes, level: int = 6) -> bytes:
    return zlib.compress(data, level)


def decompress_bytes(data: bytes) -> bytes:
    return zlib.decompress(data)
