# CloudVault — Distributed File Storage Backend

A Dropbox-style distributed file storage backend built with FastAPI, SQLAlchemy 2.0,
MySQL, Redis, and Celery. Designed to demonstrate the core distributed-systems
concepts behind a product like Dropbox/S3: chunked resumable uploads, envelope
encryption, storage-backend abstraction, versioning, and background processing.

## What's fully implemented and tested (17/17 tests passing)

- **Auth**: register, email-verification OTP, login, JWT access + refresh tokens
  with **rotation and reuse detection** (a replayed, already-rotated refresh token
  revokes the whole session family), logout / logout-all-devices, forgot/reset
  password, Redis-backed brute-force rate limiting on login.
- **Users**: profile, storage quota tracking, role (`USER`/`ADMIN`).
- **Files**: folders (nested), rename, move, copy, soft delete.
- **Chunked upload pipeline**: `init` → many `chunk` calls (parallelizable,
  idempotent/retryable) → `complete`, with a missing-chunks endpoint for resume.
  Designed for files up to 10GB via configurable chunk size.
- **Storage abstraction**: `StorageBackend` interface with a working local-disk
  implementation and an S3-compatible implementation (boto3 + native multipart
  upload for server-side chunk merging) — switching is a one-line config change.
- **Encryption**: real AES-256-GCM envelope encryption. Each file version gets
  its own random Data Encryption Key (DEK); the DEK is wrapped with a master key
  before being stored. Pipeline is upload → compress (zlib) → encrypt → store,
  and reversed on download. Verified round-trip in tests.
- **Versioning**: every completed upload to an existing filename creates a new
  `FileVersion`; list, restore, delete, and compare versions all work.
- **Sharing**: public share links with VIEW/DOWNLOAD/EDIT permission levels,
  optional password protection, expiry, max-download limits, revocation.
- **Search**: filter by name/type/size/date over indexed columns.
- **Analytics**: per-user dashboard (storage used, file-type breakdown, upload/
  download counts).
- **Admin**: list/deactivate users, adjust quotas, system-wide stats, activity log.
- **Background processing**: Celery app wired up; upload completion enqueues
  post-processing tasks instead of blocking the HTTP response.
- **Security middleware**: CORS, secure headers (HSTS, X-Frame-Options, etc.),
  centralized error handling, filename/mime validation.
- **Docker**: standalone `docker/Dockerfile` for this service. It's built
  as one of several services by the `docker-compose.yml` at the repo root,
  which wires this backend together with MySQL, Redis, Celery worker/beat,
  and the frontend (whose nginx container is the reverse proxy — rate
  limiting and WebSocket upgrade support live in `frontend/docker/nginx.conf`).
- **CI**: GitHub Actions workflow that installs deps, runs the full pytest suite
  against a real Redis service container, and builds the Docker image.

## What's architected but intentionally left as a stub

Being upfront about this matters more than pretending it's all done:

- **Thumbnail generation & malware scanning** — the Celery tasks exist and are
  correctly wired into the upload-completion flow, but the actual Pillow/ffmpeg
  and ClamAV integration is a stub (`app/workers/tasks.py`). These are
  orthogonal, swappable pieces, not core to the storage/auth/versioning system.
- **WebSocket real-time events** — the connection manager and endpoint are real
  and functional (`app/files/realtime.py`), but it isn't yet wired to fire on
  every upload/processing event, and the socket auth check is a documented
  TODO, not implemented. For multi-instance deployments, replace the in-memory
  connection dict with Redis Pub/Sub as noted in the file.
- **Elasticsearch** — the search endpoint works today against indexed MySQL
  columns; the doc comments show exactly where an ES-backed index would slot
  in without changing the API surface.
- **Prometheus/Grafana** — not included. Add `prometheus-fastapi-instrumentator`
  and a `/metrics` endpoint, then point a Prometheus scrape config + Grafana
  dashboard at it.
- **Alembic migrations** — the app uses `Base.metadata.create_all()` for fast
  bootstrapping. A real production deployment should use Alembic for schema
  migrations instead.
- **Deploy step in CI** — the GitHub Actions workflow tests and builds the
  image; the actual deploy target (ECS, EKS, Fly.io, etc.) is commented out
  since it depends on infrastructure this repo doesn't own.

## Architecture

```
app/
  auth/        registration, login, JWT rotation, OTP, password reset
  users/       profile, quota
  files/       folders, chunked upload, download, versioning, search, realtime
  storage/     StorageBackend interface + local disk & S3-compatible impls
  sharing/     public share links with permissions/password/expiry
  analytics/   usage dashboards
  admin/       user management, system stats
  workers/     Celery app + background tasks
  security/    JWT, password hashing, AES-256 envelope encryption, rate limiting
  database/    SQLAlchemy engine/session setup
  utils/       compression, validators, logging
```

Envelope encryption pattern:

```
Upload → Compress (zlib) → Encrypt (AES-256-GCM, per-file DEK) → Store
Download → Read → Decrypt → Decompress → Serve
```

Chunked upload:

```
POST /api/v1/files/upload/init      -> creates FileVersion (status=UPLOADING), returns total_chunks
POST /api/v1/files/upload/chunk     -> stores one chunk, idempotent (retry-safe)
GET  /api/v1/files/upload/{id}/missing-chunks  -> resume support
POST /api/v1/files/upload/complete  -> merges chunks, compresses, encrypts, updates quota
```

All business endpoints are versioned under `/api/v1` (e.g. `/api/v1/auth/login`,
`/api/v1/files/...`). `/health` and the `/ws/{user_id}` WebSocket are
intentionally unversioned - infra health probes expect a stable path, and
the socket contract is separate from REST versioning.

**If you have a frontend already pointed at the old unversioned paths
(`/auth/login`, `/files/...`), update its API base URL to include
`/api/v1` - this is a breaking change to the route contract.**

Every response also carries an `X-Request-ID` header (generated, or
echoed back if the caller/proxy already set one) - the same ID appears in
that request's server-side log lines, so a user-reported error can be
traced straight to its logs.

## Monitoring

- **Structured logs**: every log line is JSON with a `request_id` field tying it to the request that produced it (see `X-Request-ID` response header, `app/utils/logger.py`).
- **Audit trail**: `ActivityLog` table + `app/utils/activity_log.py` - logs login/failed-login/logout, file download/delete/restore, and admin actions (deactivate/unlock/quota change) with `user_id`, `action`, `resource_type`/`resource_id`, and IP where available. Query via `GET /api/v1/admin/activity-logs` (paginated).
- **Sentry**: inactive by default. Set `SENTRY_DSN` in `.env` to enable - no code changes needed. `send_default_pii=False` always, since request bodies here can contain file contents/passwords/tokens.
- **Prometheus**: `GET /metrics` (unversioned, like `/health`) exposes request counts/latencies in Prometheus text format whenever `PROMETHEUS_ENABLED=true` (default). Point a Prometheus server at it; Grafana then reads from that Prometheus instance, not from CloudVault directly.

## Running locally

```bash
docker compose up --build
# API docs: http://localhost:8000/docs
# Through nginx: http://localhost/
```

The backend container's entrypoint (`docker/entrypoint.sh`) runs
`alembic upgrade head` before starting the server, then serves via
Gunicorn with Uvicorn workers (`docker/gunicorn_conf.py` - worker count
defaults to `2 * CPU + 1`, override with `WEB_CONCURRENCY`). The
`celery-worker`/`celery-beat` containers override the image's default
command, so migrations only run once, from the `backend` container.

Set real secrets before any non-local use:

```bash
export JWT_SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(48))")
export FILE_ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
```

## Database Migrations

Schema is managed by Alembic — `Base.metadata.create_all()` (`init_db()`) only
runs when `ENV != production`, as a dev/test convenience. Everywhere else,
migrations are the source of truth.

```bash
cd backend
pip install -r requirements.txt alembic

# Apply all migrations (creates every table: users, refresh_tokens, otp_codes,
# folders, files, file_versions, file_chunks, share_links, storage_usage,
# activity_logs) against whatever DATABASE_URL is set in your .env:
alembic upgrade head

# After changing a model, generate the next migration and review it before
# committing - autogenerate is a good first draft, not a guarantee:
alembic revision --autogenerate -m "describe the change"

# Roll back one revision:
alembic downgrade -1

# See current DB revision / full history:
alembic current
alembic history
```

`alembic/env.py` reads `DATABASE_URL` from `app.config.get_settings()` (your
`.env`), so migrations always target the same database the FastAPI app
connects to — there's no separate URL to keep in sync in `alembic.ini`.

## Running tests

```bash
pip install -r requirements.txt
redis-server --daemonize yes   # tests need a reachable Redis for rate limiting
REDIS_URL=redis://localhost:6379/0 pytest tests/ -v
```

All 17 tests pass, covering auth (including refresh-token rotation and brute-force
lockout), the full chunked-upload → encrypt → store → decrypt → download round
trip, versioning/restore, and sharing permissions (view-only, download, password,
revocation).

## Talking points for a system-design interview

- Why envelope encryption (per-file DEK + wrapped master key) instead of one
  global key: rotating the master key never requires re-encrypting stored data.
- Why chunked upload uses per-chunk idempotency instead of a single stream:
  enables parallel upload and resume without re-sending already-received bytes.
- Why the storage backend is behind an interface: local disk for dev, S3 (or
  MinIO) in production, with zero application-code changes.
- Why refresh tokens are rotated with reuse detection: limits the blast radius
  of a stolen refresh token to a single use before the whole session is killed.
- Trade-off made explicit: soft-delete + async storage reclamation vs. hard
  delete, favoring recoverability and audit trails.
