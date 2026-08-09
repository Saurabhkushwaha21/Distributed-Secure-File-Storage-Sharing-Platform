import json

from sqlalchemy.orm import Session

from app.files.models import ActivityLog


def log_activity(
    db: Session,
    user_id: str,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    metadata: dict | None = None,
    ip_address: str | None = None,
) -> None:
    """
    Adds an audit-trail row to the same DB session/transaction as the
    action it's recording, WITHOUT committing - the caller's existing
    commit() covers both, so the action and its audit record either land
    together or neither does (no window where an action succeeds but its
    log entry is lost to a separate failed commit).
    """
    db.add(ActivityLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        metadata_json=json.dumps(metadata) if metadata else None,
        ip_address=ip_address,
    ))
