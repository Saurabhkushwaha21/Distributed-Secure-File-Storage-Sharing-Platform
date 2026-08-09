from fastapi import APIRouter, Depends, HTTPException, UploadFile, File as FastAPIFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.files import schemas, service
from app.files.chunk_upload import init_upload, receive_chunk, complete_upload, read_decrypted_version, get_missing_chunks
from app.files.models import File as FileModel, FileVersion
from app.security.jwt_handler import get_current_user, CurrentUser
from app.users.models import User
from app.utils.activity_log import log_activity
from app.utils.validators import content_disposition_header

router = APIRouter(prefix="/files", tags=["Files"])


def _load_user(db: Session, current_user: CurrentUser) -> User:
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ---------- Folders ----------

@router.post("/folders", response_model=schemas.FolderResponse, status_code=201)
def create_folder(payload: schemas.CreateFolderRequest, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    user = _load_user(db, cu)
    return service.create_folder(db, user, payload.name, payload.parent_id)


@router.get("/contents")
def list_contents(
    folder_id: str | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    """
    folder_id as an optional query param (not a path segment) - None means
    the root folder. This previously lived at /folders/{folder_id}/contents
    with folder_id as a required path parameter, which made the root
    folder unreachable and never matched what the frontend actually calls
    (/files/contents?folder_id=...) - fixed to match.
    """
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    user = _load_user(db, cu)
    folders, files = service.list_folder_contents(db, user, folder_id, limit=limit, offset=offset)
    return {
        "folders": [schemas.FolderResponse.model_validate(f) for f in folders],
        "files": [schemas.FileResponse.model_validate(f) for f in files],
    }


# ---------- Chunked upload ----------

@router.post("/upload/init", response_model=schemas.InitUploadResponse)
def upload_init(payload: schemas.InitUploadRequest, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    user = _load_user(db, cu)
    file_row, version = init_upload(
        db, user, payload.file_name, payload.folder_id, payload.total_size_bytes,
        payload.mime_type, payload.chunk_size_bytes,
    )
    return schemas.InitUploadResponse(
        file_id=file_row.id,
        version_id=version.id,
        total_chunks=version.total_chunks,
        chunk_size_bytes=payload.chunk_size_bytes or version.size_bytes // max(version.total_chunks, 1) or 1,
    )


@router.post("/upload/chunk", response_model=schemas.UploadChunkResponse)
async def upload_chunk(
    version_id: str,
    chunk_index: int,
    chunk: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    version = db.query(FileVersion).filter(FileVersion.id == version_id, FileVersion.created_by == cu.id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Upload session not found")

    data = await chunk.read()
    received, total = receive_chunk(db, version, chunk_index, data)
    return schemas.UploadChunkResponse(
        chunk_index=chunk_index, received_chunks=received, total_chunks=total, is_complete=received == total,
    )


@router.get("/upload/{version_id}/missing-chunks")
def missing_chunks(version_id: str, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    version = db.query(FileVersion).filter(FileVersion.id == version_id, FileVersion.created_by == cu.id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Upload session not found")
    return {"missing_chunk_indices": get_missing_chunks(db, version)}


@router.post("/upload/complete", response_model=schemas.FileResponse)
def upload_complete(payload: schemas.CompleteUploadRequest, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    user = _load_user(db, cu)
    version = db.query(FileVersion).filter(FileVersion.id == payload.version_id, FileVersion.created_by == cu.id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Upload session not found")
    return complete_upload(db, user, version)


# ---------- Download ----------

@router.get("/{file_id}/download")
def download_file(file_id: str, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    file_row = db.query(FileModel).filter(FileModel.id == file_id, FileModel.owner_id == cu.id, FileModel.is_deleted.is_(False)).first()
    if not file_row or not file_row.current_version_id:
        raise HTTPException(status_code=404, detail="File not found")
    version = db.query(FileVersion).filter(FileVersion.id == file_row.current_version_id).first()
    content = read_decrypted_version(version)

    log_activity(db, cu.id, "DOWNLOAD", "FILE", resource_id=file_row.id)
    db.commit()

    return Response(
        content=content,
        media_type=file_row.mime_type,
        headers={"Content-Disposition": content_disposition_header(file_row.name)},
    )


# ---------- File ops ----------

@router.patch("/{file_id}/rename", response_model=schemas.FileResponse)
def rename_file(file_id: str, payload: schemas.RenameFileRequest, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    user = _load_user(db, cu)
    return service.rename_file(db, user, file_id, payload.new_name)


@router.patch("/{file_id}/move", response_model=schemas.FileResponse)
def move_file(file_id: str, payload: schemas.MoveFileRequest, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    user = _load_user(db, cu)
    return service.move_file(db, user, file_id, payload.target_folder_id)


@router.post("/{file_id}/copy", response_model=schemas.FileResponse)
def copy_file(file_id: str, payload: schemas.MoveFileRequest, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    user = _load_user(db, cu)
    return service.copy_file(db, user, file_id, payload.target_folder_id)


@router.delete("/{file_id}", status_code=204)
def delete_file(file_id: str, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    user = _load_user(db, cu)
    service.delete_file(db, user, file_id)


@router.get("/trash", response_model=list[schemas.FileResponse])
def list_trash(limit: int = 100, offset: int = 0, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    user = _load_user(db, cu)
    return service.list_trash(db, user, limit=limit, offset=offset)


@router.post("/{file_id}/restore", response_model=schemas.FileResponse)
def restore_file(file_id: str, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    user = _load_user(db, cu)
    return service.restore_file(db, user, file_id)


@router.delete("/{file_id}/permanent", status_code=204)
def permanently_delete_file(file_id: str, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    user = _load_user(db, cu)
    service.permanently_delete_file(db, user, file_id)


# ---------- Versioning ----------

@router.get("/{file_id}/versions", response_model=list[schemas.FileVersionResponse])
def list_versions(file_id: str, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    user = _load_user(db, cu)
    return service.list_versions(db, user, file_id)


@router.post("/{file_id}/versions/{version_id}/restore", response_model=schemas.FileResponse)
def restore_version(file_id: str, version_id: str, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    user = _load_user(db, cu)
    return service.restore_version(db, user, file_id, version_id)


@router.delete("/{file_id}/versions/{version_id}", status_code=204)
def delete_version(file_id: str, version_id: str, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    user = _load_user(db, cu)
    service.delete_version(db, user, file_id, version_id)


@router.get("/{file_id}/versions/compare")
def compare_versions(file_id: str, version_a: str, version_b: str, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    user = _load_user(db, cu)
    return service.compare_versions(db, user, file_id, version_a, version_b)
