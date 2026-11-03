# UEMP: University Education Management Portal

UEMP is a web portal for running a university's academic records: students register for courses, lecturers enter results, departments review and approve them, and administrators manage the whole process. Each of those roles gets its own area. This repository is a monorepo with a Django REST API and a Next.js frontend, deployed as two Google Cloud Run services backed by Cloud SQL for PostgreSQL. Every page for all four roles runs against the Django API, which authenticates with cookie-based JWTs.

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
        ├── lib/api/          # one function per api operation
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

### Demo data

```bash
docker compose exec api python manage.py seed_demo           # safe to run again
docker compose exec api python manage.py seed_demo --reset   # wipe the demo rows first
```

Run it once before signing in to the web app. It loads two faculties, three departments, sessions from 2022/2023 to 2026/2027 (only the last two have semesters), courses, registrations and result sheets in every state, and 31 accounts on the `uemp.test` domain. Every account uses the password in `SEED_PASSWORD` (default `Demo@2026`), and the command prints the full list of logins when it finishes.

## Pages by role

| Role             | Pages                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Student          | Dashboard, My Courses (registration, grades by session, result statement), Profile                                        |
| Lecturer         | Dashboard, My Courses (course page, score entry, Excel/CSV import), Profile                                              |
| Department admin | Dashboard, Students, Lecturers, Programs, Courses, Allocations, Registrations, Results, Reports                          |
| Super admin      | Dashboard, Academic Structure, Academic Calendar, Users, Registrations, Results, Reports, Audit Log, Grading Scale        |

Only approved results ever reach students, the statement and the reports. Reports can be downloaded as CSV with `?format=csv`.

Fee payment and other student services are not part of this release; they would be a separate module.

## Live URLs

## Test Credentials

Created by `seed_demo` (see [Demo data](#demo-data)). Sign in with the email, matric number or staff ID, in any letter case; the password for all of them is `Demo@2026` unless `SEED_PASSWORD` was set. The command prints all 31 accounts.

| Role             | Matric no. / Staff ID | Email                   |
| ---------------- | --------------------- | ----------------------- |
| Student          | CSC/2024/0001         | student1@uemp.test      |
| Lecturer         | CVU/CSC/073           | lecturer1.csc@uemp.test |
| Department admin | CVU/CSC/017           | admin.csc@uemp.test     |
| Super admin      | CVU/REG/010           | superadmin@uemp.test    |

There is no self-service activation or password reset, since email and SMS are out of scope; the login page tells users to ask their department administrator.

## Architecture

## Database Design

## Deployment

