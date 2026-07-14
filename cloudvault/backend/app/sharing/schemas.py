from datetime import datetime

from pydantic import BaseModel


class CreateShareLinkRequest(BaseModel):
    file_id: str
    permission: str = "VIEW"  # VIEW | DOWNLOAD | EDIT
    password: str | None = None
    expires_in_hours: int | None = None
    max_downloads: int | None = None


class ShareLinkResponse(BaseModel):
    id: str
    token: str
    file_id: str
    permission: str
    is_password_protected: bool
    expires_at: datetime | None
    max_downloads: int | None
    download_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class AccessShareLinkRequest(BaseModel):
    password: str | None = None
