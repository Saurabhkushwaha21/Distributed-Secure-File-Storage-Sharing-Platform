from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.security.jwt_handler import get_current_user, CurrentUser
from app.sharing import schemas, service
from app.users.models import User
from app.utils.validators import content_disposition_header

router = APIRouter(prefix="/sharing", tags=["Sharing"])


def _load_user(db: Session, cu: CurrentUser) -> User:
    return db.query(User).filter(User.id == cu.id).first()


@router.post("/links", response_model=schemas.ShareLinkResponse, status_code=201)
def create_link(payload: schemas.CreateShareLinkRequest, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    user = _load_user(db, cu)
    return service.create_share_link(
        db, user, payload.file_id, payload.permission, payload.password,
        payload.expires_in_hours, payload.max_downloads,
    )


@router.get("/links", response_model=list[schemas.ShareLinkResponse])
def my_links(db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    user = _load_user(db, cu)
    return service.list_my_share_links(db, user)


@router.delete("/links/{link_id}", status_code=204)
def revoke_link(link_id: str, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    user = _load_user(db, cu)
    service.revoke_share_link(db, user, link_id)


# ---------- Public (unauthenticated) endpoints ----------

@router.get("/public/{token}")
def view_public(token: str, password: str | None = None, db: Session = Depends(get_db)):
    return service.view_shared_file_metadata(db, token, password)


@router.post("/public/{token}/download")
def download_public(token: str, payload: schemas.AccessShareLinkRequest, db: Session = Depends(get_db)):
    content, name, mime = service.download_shared_file(db, token, payload.password)
    return Response(
        content=content,
        media_type=mime,
        headers={"Content-Disposition": content_disposition_header(name)},
    )
