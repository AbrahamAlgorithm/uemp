# UEMP: University Education Management Portal

UEMP is a web portal for running a university's academic records: students register for courses, lecturers enter results, departments review and approve them, and administrators manage the whole process. Each of those roles gets its own area. This repository is a monorepo with a Django REST API and a Next.js frontend, deployed as two Google Cloud Run services backed by Cloud SQL for PostgreSQL. It is currently a skeleton: structure, configuration and an end-to-end health check, with no features yet.

## Stack

| Layer    | Technology                                                                |
| -------- | ------------------------------------------------------------------------- |
| Backend  | Python 3.12, Django 5.2 LTS, Django REST Framework, drf-spectacular        |
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS                         |
| Database | PostgreSQL 16                                                             |
| Auth     | Custom email-based `User` model, Argon2 password hashing                  |
| Hosting  | Google Cloud Run (`uemp-api`, `uemp-web`) + Cloud SQL for PostgreSQL       |
| CI       | GitHub Actions (`api.yml`: pytest, `web.yml`: lint + build)                |

## Repository structure

```
uemp/
├── docker-compose.yml        # postgres:16 + api + web for local dev
├── .env.example              # every environment variable, documented
├── .github/workflows/        # api.yml (pytest), web.yml (lint + build)
├── docs/                     # architecture, database, permissions, result workflow
├── infra/deploy.sh           # placeholder Cloud Build / Cloud Run commands
├── backend/                  # Django API
│   ├── config/               # settings (base/dev/prod), urls, wsgi
│   ├── apps/                 # accounts, academics, courses, registrations,
│   │                         # results, audit, reports
│   ├── core/                 # shared permissions, mixins, exceptions, health view
│   └── tests/
└── frontend/                 # Next.js app
    └── src/
        ├── app/              # /, /login, /student, /lecturer, /department, /admin
        ├── components/
        ├── hooks/
        ├── lib/api.ts        # fetch wrapper for /api/*
        └── middleware.ts     # pass-through; role redirects later
```

The browser only ever talks to the Next.js origin: Next.js proxies `/api/*` to the Django service, so cookies are first-party and CORS isn't needed in normal use.

## Local setup

Requirements: Docker with Compose v2.

```bash
cp .env.example .env    # optional, the defaults work as-is
docker compose up --build
```

| URL                              | What                                   |
| -------------------------------- | -------------------------------------- |
| http://localhost:3000            | Web app (shows API and DB health)      |
| http://localhost:8000/api/docs/  | Swagger UI                             |
| http://localhost:8000/api/schema/| OpenAPI schema                         |
| http://localhost:8000/api/health/| Health check                           |
| http://localhost:8000/admin/     | Django admin                           |

The compose `api` service runs `migrate` and then `runserver`. That is for local development only; the production image never migrates on start. Postgres is published on host port **5433** so it doesn't collide with a locally installed Postgres.

Create an admin user:

```bash
docker compose exec api python manage.py createsuperuser
```

### Backend tests

Tests run against Postgres, so start the database first:

```bash
docker compose up -d db
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest
```

### Frontend without Docker

```bash
cd frontend
npm ci
npm run dev     # proxies /api/* to http://localhost:8000 unless API_URL is set
npm run lint
npm run build
```

## Live URLs

<!-- TODO -->

## Test Credentials

<!-- TODO -->

## Architecture

<!-- TODO: see docs/architecture.md -->

## Database Design

<!-- TODO: see docs/database.md -->

## Deployment

<!-- TODO: see infra/deploy.sh -->
