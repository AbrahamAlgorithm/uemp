# UEMP: University Education Management Portal

UEMP is a web portal for running a university's academic records: students register for courses, lecturers enter results, departments review and approve them, and administrators manage the whole process. Each of those roles gets its own area. This repository is a monorepo with a Django REST API and a Next.js frontend, deployed as two Google Cloud Run services backed by Cloud SQL for PostgreSQL. The frontend for all four roles is built and currently runs on in-browser mock data behind a single API layer; the Django endpoints are next.

## Stack

| Layer    | Technology                                                                |
| -------- | ------------------------------------------------------------------------- |
| Backend  | Python 3.12, Django 5.2 LTS, Django REST Framework, drf-spectacular        |
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, React Hook Form + Zod, TanStack Table |
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
        ├── app/              # /login, /forbidden and the /student, /lecturer,
        │                     # /department and /admin areas
        ├── components/       # app shell, data table, dialogs, badges, ui/ (shadcn)
        ├── hooks/
        ├── lib/api/          # one function per operation, mock or real
        ├── lib/mock/         # seed data and mock handlers
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
| http://localhost:3000            | Web app (sign in with a demo account)  |
| http://localhost:8000/api/docs/  | Swagger UI                             |
| http://localhost:8000/api/schema/| OpenAPI schema                         |
| http://localhost:8000/api/health/| Health check                           |
| http://localhost:8000/admin/     | Django admin                           |

The compose `api` service runs `migrate` and then `runserver`. That is for local development only; the production image never migrates on start. Postgres is published on host port **5433** so it doesn't collide with a locally installed Postgres.

Create an admin user:

```bash
docker compose exec api python manage.py createsuperuser
```

### Mock data

With `NEXT_PUBLIC_USE_MOCKS=true` (the default in compose and `npm run dev`) the UI reads and writes an in-browser copy of the seed data in `frontend/src/lib/mock`, so changes last until the page is reloaded. Pages only import from `lib/api`; `lib/api/remote.ts` lists the endpoints the UI expects, and setting the flag to `false` switches every page to them.

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

## Test Credentials

Demo accounts while mock data is on. Sign in with the staff or student ID; the password for all of them is `password123`. Account activation and password reset accept the email below, and the emailed code is always `246810`.

| Role             | Staff/Student ID | Email                                      |
| ---------------- | ---------------- | ------------------------------------------ |
| Student          | CSC/2024/0369    | chiamaka.okafor@student.crestview.edu.ng   |
| Lecturer         | CVU/CSC/073      | a.ogunleye@crestview.edu.ng                |
| Department admin | CVU/CSC/017      | csc.admin@crestview.edu.ng                 |
| Super admin      | CVU/REG/010      | registry@crestview.edu.ng                  |

## Architecture

## Database Design

## Deployment

