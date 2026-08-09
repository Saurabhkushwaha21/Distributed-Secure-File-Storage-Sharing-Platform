from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserProfile(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    role: str
    is_email_verified: bool
    storage_quota_bytes: int
    storage_used_bytes: int
    created_at: datetime

    class Config:
        from_attributes = True


class UpdateProfileRequest(BaseModel):
    full_name: str | None = None


class StorageQuotaResponse(BaseModel):
    quota_bytes: int
    used_bytes: int
    available_bytes: int
    percent_used: float
