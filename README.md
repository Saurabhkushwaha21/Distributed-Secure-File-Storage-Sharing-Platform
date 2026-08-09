# CloudVault — Secure File Storage & Sharing Platform

> A full-stack file storage and sharing application built as a hands-on software engineering project.

CloudVault is a Dropbox-style platform where users can upload, store, manage, download, and securely share files. The project combines a **FastAPI + MySQL + Redis + Celery backend** with a **React + TypeScript frontend** and Docker-based local deployment.

The project focuses on practical backend engineering concepts: authentication, authorization, encrypted file storage, share-link security, background jobs, caching, API design, testing, and CI/CD.

## Why I Built This

I built CloudVault to understand how a real-world file platform is structured beyond basic CRUD operations — especially how authentication, file ownership, secure sharing, asynchronous processing, databases, and frontend/backend communication work together.

## Key Features

- 🔐 JWT authentication with refresh-token rotation
- 👤 User-owned files and authorization checks
- 📁 File upload, download, management, and versioning
- 🔒 AES-256-GCM envelope encryption for stored files
- 🔗 Secure file-sharing links with expiration controls
- 🔑 Password-protected sharing
- ⏱️ Download-limit controls
- ⚡ Redis-backed services and Celery background workers
- 🗄️ MySQL database with SQLAlchemy
- 📊 Backend metrics with Prometheus and optional Grafana monitoring
- 🧪 Backend and frontend automated tests
- 🐳 Docker Compose for the complete stack
- 🔄 GitHub Actions CI/CD
- 🌐 React + TypeScript frontend

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Backend | Python, FastAPI, SQLAlchemy |
| Database | MySQL |
| Cache / Session Services | Redis |
| Background Jobs | Celery |
| Security | JWT, password hashing, AES-256-GCM |
| Testing | Pytest, Vitest |
| DevOps | Docker, Docker Compose, GitHub Actions |
| Monitoring | Prometheus, Grafana, Sentry integration |

## Architecture

```text
React + TypeScript
        │
        │ HTTP / WebSocket
        ▼
Nginx / API Gateway
        │
        ▼
FastAPI Backend
   ┌────┼───────────┐
   │    │           │
   ▼    ▼           ▼
MySQL Redis     Celery Worker
   │                │
   └────────┬───────┘
            ▼
       File Storage
       + Encryption
```

In development, Vite proxies API requests to FastAPI. In the Docker setup, the frontend nginx container serves the React application and proxies API/WebSocket traffic to the backend, giving the browser a single origin.

## Security Highlights

Security was treated as a core engineering requirement rather than an afterthought.

- Authentication is handled by JWT access/refresh tokens.
- Refresh tokens are rotated instead of being reused indefinitely.
- File operations enforce authenticated ownership.
- Share tokens use secure random values rather than predictable IDs.
- Shared files can have expiration and download limits.
- Password-protected shares require an additional secret.
- Stored file content uses AES-256-GCM encryption.
- Secrets and encryption keys are supplied through environment variables.
- Production credentials are not committed to the repository.

> This project is an educational/portfolio implementation. Before production use, the remaining documented limitations should be reviewed and hardened further.

## Project Structure

```text
.
├── backend/          # FastAPI application, database, auth and services
├── frontend/         # React + TypeScript application
├── monitoring/       # Prometheus/Grafana configuration
├── .github/          # CI workflows
├── docker-compose.yml
├── .env.example
└── README.md
```

## Run Locally

### Option 1 — Docker Compose

```bash
cp .env.example .env
# Fill in the required environment variables.
docker compose --env-file .env up -d --build
```

Then open:

```text
http://localhost
```

The Compose stack includes MySQL, Redis, FastAPI, Celery workers/beat, and the React/nginx frontend.

### Option 2 — Run Frontend and Backend Separately

Start MySQL and Redis locally, then:

```bash
cd backend
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

For local non-Docker development, make sure the database and Redis URLs point to `localhost` rather than Docker service names.

## Testing

### Backend

```bash
cd backend
pytest tests/ -v --cov=app --cov-report=term-missing
```

### Frontend

```bash
cd frontend
npm install
npm run test
npm run build
```

GitHub Actions runs backend/frontend checks and an integration smoke test on repository changes. The integration test exercises the Docker stack through the nginx frontend path rather than testing only isolated services.

## CI/CD

The repository includes GitHub Actions workflows for:

- Backend tests
- Frontend tests/build
- Docker-related checks
- Integration smoke testing

The goal is to catch both code-level failures and frontend/backend wiring problems before changes are merged.

## Monitoring

Optional monitoring is available with Prometheus and Grafana:

```bash
docker compose --profile monitoring up -d
```

The backend also contains optional Sentry integration for error monitoring when a Sentry DSN is configured.

## Engineering Challenges I Worked On

Some of the most useful engineering problems in this project were:

- Designing authentication and refresh-token flows
- Enforcing file ownership and authorization
- Protecting share links from predictable access
- Handling encrypted file storage
- Coordinating Redis and Celery services
- Connecting a React frontend with a FastAPI backend
- Building reproducible Docker environments
- Writing automated tests and CI checks
- Diagnosing integration failures across multiple services

## Known Limitations

This is a portfolio project, not a claim of a fully hardened enterprise production system. Some advanced capabilities are intentionally incomplete or documented as future work, including certain scanning/thumbnail functionality, some frontend pages awaiting backend endpoints, and additional production hardening.

These limitations are kept explicit so the repository reflects the actual implementation rather than overstating its capabilities.

## Future Improvements

- Complete remaining file-processing services
- Add stronger WebSocket authentication
- Expand integration and security test coverage
- Add richer file search/filtering
- Improve production observability dashboards
- Add object-storage support for large-scale deployments
- Add automated security/dependency scanning

## What This Project Demonstrates

**Backend:** FastAPI, REST APIs, authentication, authorization, SQLAlchemy, MySQL, Redis, Celery

**Frontend:** React, TypeScript, API integration, application state and responsive UI

**Security:** JWT, password protection, file ownership, secure sharing, encryption

**DevOps:** Docker Compose, CI/CD, environment configuration and monitoring

**Testing:** Unit/integration testing and automated CI validation

## Author

**Saurabh Kushwaha**  
B.Tech — Artificial Intelligence & Machine Learning

GitHub: [Saurabhkushwaha21](https://github.com/Saurabhkushwaha21)

---

If you are reviewing this project as a recruiter or interviewer, the most interesting areas to explore are the authentication flow, file ownership/authorization, encrypted storage, secure sharing, asynchronous jobs, and the CI/integration setup.
