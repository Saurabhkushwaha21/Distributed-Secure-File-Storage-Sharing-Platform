import re

# A conservative allow-list; extend as needed. Executables and scripts are
# blocked by default to reduce the blast radius of a compromised account
# uploading something designed to be executed later.
BLOCKED_EXTENSIONS = {".exe", ".bat", ".sh", ".cmd", ".msi", ".dll", ".scr", ".jar"}

SAFE_FILENAME_RE = re.compile(r"^[\w\-. ()\[\]]{1,255}$")


def is_filename_safe(name: str) -> bool:
    if not SAFE_FILENAME_RE.match(name):
        return False
    lowered = name.lower()
    return not any(lowered.endswith(ext) for ext in BLOCKED_EXTENSIONS)


def is_valid_mime_type(mime_type: str) -> bool:
    return bool(re.match(r"^[\w.\-]+/[\w.\-+]+$", mime_type))


def content_disposition_header(filename: str, disposition: str = "attachment") -> str:
    """
    RFC 6266 filename*=UTF-8''<percent-encoded>, plus a quoted-ASCII
    fallback for older clients. Avoids header injection/malformation from
    quotes, CRLF, or non-ASCII characters in a user-controlled file name.
    """
    from urllib.parse import quote

    safe_ascii_name = (
        filename.encode("ascii", "ignore").decode().replace('"', "").replace("\n", "").replace("\r", "")
        or "download"
    )
    encoded_name = quote(filename)
    return f"{disposition}; filename=\"{safe_ascii_name}\"; filename*=UTF-8''{encoded_name}"
