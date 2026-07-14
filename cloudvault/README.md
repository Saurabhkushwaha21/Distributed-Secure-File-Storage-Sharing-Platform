# CloudVault

A Dropbox-style distributed file storage system: **FastAPI + SQLAlchemy +
MySQL + Redis + Celery** backend, **React 18 + TypeScript** frontend, wired
together and verified end-to-end (real chunked upload → AES-256-GCM
envelope encryption → download round-trip, auth with refresh-token
rotation, share links, analytics — all tested against a real MySQL/Redis,
not mocks).

This repo is the backend and frontend combined into one place so they can
be run, tested, and deployed as one connected stack. See `backend/README.md`
and `frontend/README.md` for the full feature lists and each side's own
architecture notes — this file covers how the two are wired together.

## How the connection works

- **Dev**: the frontend's Vite dev server proxies `/api/*` → `http://localhost:8000/*`
  and `/ws/*` → the backend's WebSocket, so the browser only ever talks to
  `localhost:5173` (see `frontend/vite.config.ts`). No CORS issues in dev
  because of this — but `CORS_ORIGINS` in the backend still needs
  `http://localhost:5173` for the (rare) case something bypasses the proxy;
  that's the default in `backend/app/config.py` already.
- **Production**: the frontend's own nginx container (`frontend/Dockerfile`
  + `frontend/docker/nginx.conf`) serves the built SPA *and* proxies
  `/api/*` and `/ws/*` to the backend container — so in production the
  browser also only ever talks to one origin. This is why the frontend's
  `VITE_API_BASE_URL` defaults to the relative path `/api` and
  `VITE_WS_BASE_URL` is left unset (falls back to
  `wss://<same-origin>/ws`) — the same build works in both dev and prod
  without any URL rewriting.

## Running it locally (no Docker)

```bash
# 1. MySQL + Redis running locally, then create the database:
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS cloudvault;"

# 2. Backend
cd backend
cp .env.example .env
# edit .env: DATABASE_URL, REDIS_URL (localhost, not the docker hostnames),
# JWT_SECRET_KEY, FILE_ENCRYPTION_KEY (see the generation commands in the file)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 3. Frontend (separate terminal)
cd frontend
npm install
npm run dev
# open http://localhost:5173 — it's already proxying to the backend above
```

## Running the full stack with Docker (production-style)

```bash
cp .env.example .env
# fill in every REPLACE_ME — see the comments in the file for how to
# generate JWT_SECRET_KEY and FILE_ENCRYPTION_KEY

docker compose --env-file .env up -d --build
open http://localhost
```

This starts: `mysql`, `redis` (password-protected), `backend`,
`celery-worker`, `celery-beat`, and `frontend` (the nginx edge — the only
container exposed to the host). Nothing else is reachable from outside the
Docker network, which is deliberate.

For real internet-facing HTTPS, either put this behind a platform load
balancer that terminates TLS, or uncomment the HTTPS `server` block at the
bottom of `frontend/docker/nginx.conf` and mount real certs.

There's only one `docker-compose.yml` (this one, at the repo root) — it
builds both `./backend` and `./frontend` as services on one network, so
there's no separate standalone compose file per side to keep in sync.

## Monitoring

**Errors (Sentry):** the backend has `sentry-sdk` wired in
(`backend/app/main.py`) but fully inactive until you set `SENTRY_DSN` in
`.env` — with it empty (the default), `sentry_sdk.init()` never runs, so
there's no behavior difference in environments that don't use Sentry.
Request/response bodies are never sent (`send_default_pii=False`) since
they can contain file contents or tokens.

**Metrics (Prometheus + Grafana):** the backend always exposes
`/metrics` in Prometheus format when `PROMETHEUS_ENABLED=true` (the
default) - request counts, latencies, in-progress requests, etc. Actually
scraping and visualizing that is opt-in, off by default so a plain
`docker compose up` stays lightweight:

```bash
docker compose --profile monitoring up -d
# Prometheus: http://localhost:9090
# Grafana:    http://localhost:3001  (login: admin / $GRAFANA_ADMIN_PASSWORD, defaults to "admin")
```

`monitoring/prometheus.yml` scrapes `backend:8000/metrics` over the
internal compose network (no need to expose the backend's port to the
host for this to work). Grafana comes pre-connected to that Prometheus
instance via `monitoring/grafana/provisioning/datasources/` - no manual
"add a datasource" step. There's no pre-built dashboard JSON provisioned
yet; add panels against the `http_requests_total` /
`http_request_duration_seconds` metrics the instrumentator exposes, or
import a community FastAPI dashboard.

## Troubleshooting

**"Internal Server Error" on registration/login (or anything else that
touches the database), when running the backend locally with `uvicorn`
(not via `docker compose`):**

`DATABASE_URL`/`REDIS_URL` default to the hostnames `mysql`/`redis` —
those only resolve *inside* the Docker network docker-compose creates.
Running the backend directly on your machine needs `localhost` instead.
Check first with `curl http://localhost:8000/health` — it reports real
connectivity (`{"status":"degraded","checks":{"database":"unreachable: ..."}}`)
instead of just "the process is up", so this is diagnosable in one request
rather than guessing from a generic 500. Fix: in `backend/.env`, change
```
DATABASE_URL=mysql+pymysql://cloudvault:cloudvault@mysql:3306/cloudvault
REDIS_URL=redis://redis:6379/0
```
to
```
DATABASE_URL=mysql+pymysql://cloudvault:cloudvault@localhost:3306/cloudvault
REDIS_URL=redis://localhost:6379/0
```
(adjust user/password/db name to match your actual local MySQL). This
only applies to local/non-Docker dev — the docker-compose stack sets
these correctly as container env vars already.

## Testing

```bash
# Backend — 17/17 passing, isolated SQLite per test, real Redis (see below)
cd backend
pip install -r requirements.txt
pytest tests/ -v --cov=app --cov-report=term-missing
# Needs a local Redis reachable at localhost:6379 (rate limiting +
# refresh-token session store are real Redis calls, not mocked).
# tests/conftest.py already defaults REDIS_URL to localhost for you.

# Frontend — 16/16 passing
cd frontend
npm install
npm run test        # vitest
npm run build        # tsc --noEmit + production build
```

CI runs both suites independently (`.github/workflows/backend-ci.yml`,
`frontend-ci.yml`) on every push/PR, plus
`.github/workflows/integration-smoke-test.yml`, which builds the *actual*
docker-compose stack and does a real register+login through the
nginx-proxied frontend origin — the same path a browser takes — to catch
wiring regressions that testing each side in isolation can't see.

## What's genuinely done vs. honest placeholders

Both `backend/README.md` and `frontend/README.md` have detailed, honest
"what's real vs. stubbed" sections (thumbnail/malware scanning stubs,
WebSocket auth not yet enforced, Starred/Trash pages waiting on backend
endpoints that don't exist yet, no Alembic migrations, etc.) — worth
reading before treating this as 100% feature-complete. The auth, chunked
upload + encryption, versioning, sharing, and analytics paths are real
and were verified end-to-end against a live MySQL + Redis while building
this connection, not just unit-tested in isolation.
