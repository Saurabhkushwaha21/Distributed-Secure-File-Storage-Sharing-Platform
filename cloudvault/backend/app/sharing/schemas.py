from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CreateShareLinkRequest(BaseModel):
    file_id: str = Field(..., min_length=1, max_length=128)
    permission: str = Field(default="VIEW", pattern=r"^(VIEW|DOWNLOAD|EDIT)$")
    password: str | None = Field(default=None, min_length=8, max_length=128)
    expires_in_hours: int | None = Field(default=None, ge=1, le=24 * 30)
    max_downloads: int | None = Field(default=None, ge=1, le=1_000_000)

    @field_validator("file_id")
    @classmethod
    def normalize_file_id(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("file_id cannot be empty")
        return value


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

    model_config = ConfigDict(from_attributes=True)


class AccessShareLinkRequest(BaseModel):
    password: str | None = Field(default=None, max_length=128)
