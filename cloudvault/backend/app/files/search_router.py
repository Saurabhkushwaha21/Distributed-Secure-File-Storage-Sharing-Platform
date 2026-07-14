from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.files import schemas
from app.files.models import File as FileModel
from app.security.jwt_handler import get_current_user, CurrentUser

router = APIRouter(prefix="/search", tags=["Search"])


@router.get("/files", response_model=list[schemas.FileResponse])
def search_files(
    q: str | None = Query(None, description="Substring match on file name"),
    mime_type: str | None = None,
    min_size_bytes: int | None = None,
    max_size_bytes: int | None = None,
    created_after: datetime | None = None,
    created_before: datetime | None = None,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    """
    Simple relational search over indexed columns (name, mime_type,
    size_bytes, created_at, owner_id). For fuzzy/full-text search at scale,
    swap this for an Elasticsearch query against a `files` index kept in
    sync via a Celery task on create/update/delete - the query surface
    (this endpoint's params) would stay identical to callers.
    """
    query = db.query(FileModel).filter(FileModel.owner_id == cu.id, FileModel.is_deleted.is_(False))

    if q:
        query = query.filter(FileModel.name.ilike(f"%{q}%"))
    if mime_type:
        query = query.filter(FileModel.mime_type == mime_type)
    if min_size_bytes is not None:
        query = query.filter(FileModel.size_bytes >= min_size_bytes)
    if max_size_bytes is not None:
        query = query.filter(FileModel.size_bytes <= max_size_bytes)
    if created_after:
        query = query.filter(FileModel.created_at >= created_after)
    if created_before:
        query = query.filter(FileModel.created_at <= created_before)

    return query.order_by(FileModel.created_at.desc()).limit(limit).offset(offset).all()
