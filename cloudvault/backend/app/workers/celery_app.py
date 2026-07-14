from celery import Celery

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "cloudvault",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,           # re-deliver if a worker dies mid-task
    worker_prefetch_multiplier=1,  # fairer distribution across workers for long-running file tasks
    task_routes={
        "app.workers.tasks.process_uploaded_file": {"queue": "file_processing"},
        "app.workers.tasks.scan_for_malware": {"queue": "security"},
        "app.workers.tasks.recompute_analytics": {"queue": "analytics"},
        "app.workers.tasks.purge_expired_trash": {"queue": "file_processing"},
    },
    # The celery-beat container in docker-compose.yml runs these on a
    # schedule. Without this, celery-beat is running with nothing to
    # trigger - recompute_analytics/purge_expired_trash existed as tasks
    # but were never actually scheduled anywhere.
    beat_schedule={
        "recompute-analytics-nightly": {
            "task": "app.workers.tasks.recompute_analytics",
            "schedule": 86400.0,  # every 24h
        },
        "purge-expired-trash-nightly": {
            "task": "app.workers.tasks.purge_expired_trash",
            "schedule": 86400.0,  # every 24h
        },
    },
)
