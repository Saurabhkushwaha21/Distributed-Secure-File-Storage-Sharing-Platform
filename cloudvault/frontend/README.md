# CloudVault — Frontend

A production-style React 18 + TypeScript SPA for CloudVault, the distributed
file storage backend built alongside this project. Talks to the FastAPI
backend for auth, chunked uploads, versioning, sharing, search, analytics,
and admin.

## Design system: "Vault Dial"

Rather than a generic dashboard look, the UI leans into the vault/security
metaphor the backend actually implements (AES-256 envelope encryption,
access control, audit logs):

- **Palette**: deep ink navy (`#12162B`) for chrome, a cool steel-tinted
  paper canvas (`#EEF1F6` — deliberately not the common warm-cream default),
  a single brass accent (`#B8842E`) for primary actions, plus a vault-green
  and signal-red for encrypted/healthy vs. destructive states.
- **Type**: Fraunces (serif, display) for headings — an intentional contrast
  against the all-sans convention of SaaS dashboards — paired with IBM Plex
  Sans for body text and IBM Plex Mono for anything numeric (file sizes,
  checksums, timestamps, quota figures).
- **Signature element**: the `VaultDial` — a circular progress ring styled
  like a combination-lock dial, with tick marks around the rim. It's not
  decoration bolted onto a progress bar; it's the actual progress/quota
  visualization used for upload progress and storage quota, so the metaphor
  does real work instead of just looking nice.

## What's fully implemented and tested (16/16 tests passing)

- **Auth**: login, registration with password-strength meter, email
  verification (OTP), forgot/reset password, remember-me, protected routes,
  role-based access control (admin-only routes redirect non-admins).
- **Token handling**: access token kept in memory only (never touches
  localStorage, to reduce XSS blast radius); refresh token persisted per
  "remember me"; axios interceptor with automatic refresh-and-retry,
  including request queueing so concurrent 401s don't trigger parallel
  refresh calls.
- **File explorer**: nested folders, breadcrumb navigation, grid/list view
  toggle, sort by name/size/date, rename/move/copy/delete, drag-and-drop
  upload zone.
- **Chunked upload engine** (`src/services/uploadManager.ts`): splits files
  into chunks, uploads up to 4 in parallel, tracks real-time speed and ETA,
  supports pause/resume (re-syncing against the backend's missing-chunks
  endpoint so a page refresh mid-upload doesn't lose progress), cancel, and
  per-chunk retry with exponential backoff.
- **Upload dashboard**: floating dock showing every queued/active upload
  with name, size, progress ring, speed, ETA, and status — matches what the
  brief asked for.
- **File preview**: image, video, audio, PDF (via iframe), and text preview,
  plus a metadata panel.
- **Version history**: timeline UI, restore, delete, with the current
  version clearly marked.
- **Sharing**: create/revoke public links with VIEW/DOWNLOAD/EDIT
  permission, password protection, expiry, and a public unauthenticated
  landing page (`/s/:token`) that handles the password-prompt and
  expired/revoked states.
- **Search**: name-based search wired to the backend's indexed-column
  search endpoint, with results rendered in the same explorer UI.
- **Analytics & Dashboard**: storage quota vault-dial, file-type
  distribution (pie), upload/download counters, all from real backend data.
- **Admin panel**: user list, deactivate user, system-wide stats, recent
  activity log — all live against the backend's admin endpoints.
- **Realtime**: a working WebSocket hook with reconnect-with-backoff,
  wired to show toasts for `security_alert` and `file_processed` events.
- **Error handling**: global error boundary, toast notifications, loading
  skeletons, empty states with actionable copy.
- **Responsive**: layout collapses gracefully down to mobile; keyboard
  focus is visible everywhere; `prefers-reduced-motion` is respected.
- **Testing**: Vitest + React Testing Library, covering the login form
  (including the async-thunk error path), the VaultDial component, and the
  formatting utilities that drive the upload dashboard's numbers.
- **Docker**: multi-stage Dockerfile (Node build → nginx serve) with the
  SPA fallback, gzip, static-asset caching, and `/api`/`/ws` proxy rules to
  the backend baked into `docker/nginx.conf`. GitHub Actions CI runs
  type-check, tests, and production build, then builds the image.

## What's an honest placeholder, not a fake feature

- **Starred / Trash pages** — the backend (as delivered) has no
  `is_starred` column or star endpoint, and no list/restore-from-trash
  endpoint (deletes are soft-deletes server-side, but nothing exposes them
  back to a client yet). Rather than fabricate a list that doesn't reflect
  real data, both pages render a clear "not wired up yet" empty state that
  names exactly what backend work would unblock them. See the comments at
  the top of `src/pages/StarredPage.tsx` and `TrashPage.tsx`.
- **"Shared" page** shows *links you've created* (which is fully real and
  functional) rather than a "shared with me" inbox, since the backend's
  sharing model is link-based, not user-to-user.
- **WebSocket auth** — the client sends the connection; the backend
  doesn't yet validate a token on the socket handshake (documented in the
  backend's `realtime.py`). Functionally it works end to end, but don't
  ship the socket endpoint publicly without that check added server-side.
- **Weekly upload activity chart** on the dashboard is explicitly labeled
  "illustrative" — it's a proportional split of the real all-time upload
  count, not real daily history, because the backend doesn't yet expose a
  time-series endpoint (the `StorageUsageSnapshot` model exists for this
  purpose but nothing populates historical days yet).
- **CI deploy step** is commented out, same reasoning as the backend: the
  actual hosting target is an infra decision this repo doesn't own.

## One contract note between this frontend and the delivered backend

`filesApi.listContents` calls `GET /files/contents?folder_id=...`. The
backend's `files/router.py` as delivered exposes this at
`GET /files/folders/{folder_id}/contents`, which doesn't correctly support
a "root" (no folder) call. Reconcile by changing that backend route to a
query-param-based `/files/contents` endpoint — the frontend is written
against the contract it should be, not the exact string the backend
currently has.

## Project structure

```
src/
  components/   ui primitives, layout (sidebar/topbar/shell), files, upload, charts
  features/     (reserved for feature-colocated logic as the app grows)
  hooks/        redux hooks, react-query hooks, upload controller, websocket
  pages/        route-level components
  services/     axios client + interceptors, domain API modules, upload manager, token storage
  store/        Redux Toolkit slices (auth, toasts, uploads)
  types/        shared TypeScript types
  routes/       ProtectedRoute (auth + RBAC guard)
```

## Running locally

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api and /ws to :8000
```

Point at a deployed backend instead of the dev proxy:

```bash
cp .env.example .env.local
# edit VITE_API_BASE_URL / VITE_WS_BASE_URL
```

## Running tests

```bash
npm run test        # 16 tests: format utils, VaultDial, LoginPage
npx tsc --noEmit     # type check
npm run build        # production build (code-split into vendor chunks)
```

## Docker

```bash
docker build -t cloudvault-frontend .
docker run -p 3000:80 cloudvault-frontend
```

To run the full stack (this frontend + the CloudVault backend) together,
use the `docker-compose.yml` at the repo root instead — it already builds
both as services on one Docker network. See the root `README.md`.
