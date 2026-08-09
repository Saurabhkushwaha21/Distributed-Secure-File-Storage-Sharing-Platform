import time
import uuid

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from app.admin.router import router as admin_router
from app.analytics.router import router as analytics_router
from app.auth.router import router as auth_router
from app.config import get_settings
from app.database import init_db
from app.files.realtime import router as realtime_router
from app.files.router import router as files_router
from app.files.search_router import router as search_router
from app.sharing.router import router as sharing_router
from app.users.router import router as users_router
from app.utils.logger import get_logger
from app.utils.request_context import request_id_ctx

settings = get_settings()
logger = get_logger("cloudvault")

API_PREFIX = "/api/v1"

# ---------- Sentry ----------
# Fully inactive with no SENTRY_DSN set (the default) - init() is a no-op
# in that case, so this is safe to leave in place for every environment
# rather than being dev/prod-conditional code.
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENV,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        # Request/response bodies can contain file contents, passwords, or
        # tokens - never send them to a third party by default.
        send_default_pii=False,
    )
    logger.info("Sentry error tracking enabled")

app = FastAPI(
    title="CloudVault Distributed Storage System",
    description="Production-grade distributed file storage backend (Dropbox-style).",
    version="1.0.0",
)


# ---------- Request ID ----------
@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    """
    Accepts an inbound X-Request-ID (useful when a reverse proxy/gateway
    already assigns one) or generates a fresh one, stores it in a
    ContextVar for the duration of the request so get_logger() output and
    the global exception handler can include it, and echoes it back on the
    response so client-side logs/support tickets can be correlated to
    server-side logs for the same request.
    """
    incoming = request.headers.get("X-Request-ID")
    rid = incoming if incoming else str(uuid.uuid4())
    token = request_id_ctx.set(rid)
    try:
        response = await call_next(request)
    finally:
        request_id_ctx.reset(token)
    response.headers["X-Request-ID"] = rid
    return response

# ---------- CORS ----------
if settings.ENV == "production":
    dev_looking = [o for o in settings.CORS_ORIGINS if "localhost" in o or "127.0.0.1" in o]
    if dev_looking or not settings.CORS_ORIGINS:
        logger.warning(
            f"ENV=production but CORS_ORIGINS looks like a dev default: {settings.CORS_ORIGINS}. "
            "Set CORS_ORIGINS in .env to your real frontend origin(s) before going live."
        )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Security headers ----------
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    response.headers["Referrer-Policy"] = "no-referrer"
    if request.url.path not in ("/docs", "/redoc") and not request.url.path.startswith("/openapi"):
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["X-Process-Time-Ms"] = str(round((time.time() - start) * 1000, 2))
    return response


# ---------- Global exception handling ----------
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    FastAPI's default 422 body is `{"detail": [{"type": ..., "loc": ..., "msg": ...}, ...]}` -
    a raw list of pydantic error objects. That's fine for API consumers debugging with
    curl/Postman, but the frontend renders `detail` directly as user-facing text (e.g. on
    the register/reset-password forms), so a list-of-objects there either shows as
    "[object Object]" or crashes the render entirely. Collapse it into a single
    human-readable string instead, using the first error (the one Pydantic actually
    stopped on) and stripping the "Value error, " prefix our own field_validators add.
    """
    first = exc.errors()[0]
    msg = str(first.get("msg", "Invalid input"))
    if msg.startswith("Value error, "):
        msg = msg[len("Value error, "):]
    field = first.get("loc", [])[-1] if first.get("loc") else None
    if field and field not in ("body", "query", "path"):
        msg = f"{field}: {msg}"
    return JSONResponse(status_code=422, content={"detail": msg})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    rid = request_id_ctx.get()
    logger.error(f"Unhandled exception on {request.url.path}: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error", "request_id": rid})


# ---------- Startup ----------
@app.on_event("startup")
def on_startup():
    if settings.ENV == "production":
        # Production schema changes go through `alembic upgrade head` only
        # (see backend/alembic/ and README.md "Database Migrations"). Never
        # run create_all() here - it would silently diverge from migration
        # history and make future `alembic revision --autogenerate` diffs
        # unreliable.
        logger.info("ENV=production: skipping create_all(), schema is managed by Alembic")
    else:
        try:
            init_db()
        except Exception as exc:  # pragma: no cover - environment dependent
            # Dev/test convenience only. In dev without a reachable MySQL
            # instance (e.g. unit tests using SQLite via dependency
            # override) we log and continue instead of crashing.
            logger.warning(f"init_db() skipped: {exc}")
    logger.info("CloudVault backend started")


# ---------- Health ----------
@app.get("/health", tags=["Health"])
def health_check():
    """
    Reports real connectivity, not just "the process is running" — a
    misconfigured DATABASE_URL/REDIS_URL (e.g. the docker-only hostnames
    "mysql"/"redis" used while running outside Docker) otherwise looks
    fine here but 500s on every real request, which is confusing to debug.
    """
    checks = {}

    try:
        from app.database.session import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = f"unreachable: {exc.__class__.__name__}"

    try:
        from app.security.rate_limit import redis_client
        redis_client.ping()
        checks["redis"] = "ok"
    except Exception as exc:
        checks["redis"] = f"unreachable: {exc.__class__.__name__}"

    overall = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    return {"status": overall, "service": settings.APP_NAME, "checks": checks}


# ---------- Routers ----------
# Versioned under /api/v1 - /health and /ws are intentionally NOT versioned:
# infra (load balancer / k8s probes) expects a stable health path, and the
# WebSocket contract is separate from the REST API's versioning.
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(users_router, prefix=API_PREFIX)
app.include_router(files_router, prefix=API_PREFIX)
app.include_router(search_router, prefix=API_PREFIX)
app.include_router(sharing_router, prefix=API_PREFIX)
app.include_router(analytics_router, prefix=API_PREFIX)
app.include_router(admin_router, prefix=API_PREFIX)
app.include_router(realtime_router)

# ---------- Prometheus ----------
# Exposes /metrics (request counts, latencies, in-progress requests, etc.
# in Prometheus text format) unversioned, same reasoning as /health - a
# scrape target's path shouldn't move when the REST API version does.
# Point a Prometheus server at this path; a Grafana dashboard reads from
# Prometheus, not from this app directly, so no CloudVault-side Grafana
# config is needed beyond this endpoint existing.
if settings.PROMETHEUS_ENABLED:
    from prometheus_fastapi_instrumentator import Instrumentator

    Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)
