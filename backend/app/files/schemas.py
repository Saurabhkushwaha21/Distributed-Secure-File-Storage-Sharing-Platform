from datetime import datetime

from pydantic import BaseModel, Field


class CreateFolderRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    parent_id: str | None = None


class FolderResponse(BaseModel):
    id: str
    name: str
    parent_id: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class FileResponse(BaseModel):
    id: str
    name: str
    folder_id: str | None
    mime_type: str
    size_bytes: int
    current_version_id: str | None
    created_at: datetime
    updated_at: datetime
    is_duplicate: bool = False
    duplicate_of_file_id: str | None = None

    class Config:
        from_attributes = True


class RenameFileRequest(BaseModel):
    new_name: str = Field(min_length=1, max_length=255)


class MoveFileRequest(BaseModel):
    target_folder_id: str | None = None


class InitUploadRequest(BaseModel):
    file_name: str
    folder_id: str | None = None
    total_size_bytes: int = Field(gt=0)
    mime_type: str = "application/octet-stream"
    chunk_size_bytes: int | None = None  # defaults to server CHUNK_SIZE_BYTES


class InitUploadResponse(BaseModel):
    file_id: str
    version_id: str
    total_chunks: int
    chunk_size_bytes: int


class UploadChunkResponse(BaseModel):
    chunk_index: int
    received_chunks: int
    total_chunks: int
    is_complete: bool


class CompleteUploadRequest(BaseModel):
    version_id: str


class FileVersionResponse(BaseModel):
    id: str
    version_number: int
    size_bytes: int
    upload_status: str
    created_at: datetime

    class Config:
        from_attributes = True
