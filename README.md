# IELTSation

Uzbekistan's first IELTS computer-delivered mock test platform.
Django 5 REST API + React 18 SPA, PostgreSQL 16 installed natively on WSL.

## Prerequisites

- Ubuntu/WSL with `postgresql`, `postgresql-contrib`, `libpq-dev`,
  `python3-venv`, `python3-dev`, `build-essential`, `nodejs`, `npm`
  installed via `apt`.
- Postgres role `ieltsation` with password `dev123` and database
  `ieltsation` (see below).

## One-time setup

```bash
# PostgreSQL (enabled as a systemd service, autostarts on WSL boot)
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER ieltsation WITH PASSWORD 'dev123';"
sudo -u postgres psql -c "CREATE DATABASE ieltsation OWNER ieltsation;"
sudo -u postgres psql -c "ALTER USER ieltsation CREATEDB;"
```

## Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp ../.env.example .env            # edit as needed
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_tests
.venv/bin/python manage.py createsuperuser
.venv/bin/python manage.py runserver
```

- API root: `http://127.0.0.1:8000/api/v1/`
- Admin: `http://127.0.0.1:8000/admin/`

## Frontend

```bash
cd frontend
npm install
npm run dev       # → http://localhost:5173
```

Stack: Vite 5 + React 18 + TS + Tailwind 3 + shadcn/ui (button, input, card,
label, form, dialog, select, tabs) + sonner (toast) + React Router 6 + axios
+ Zustand + TanStack Query + react-hook-form + zod + lucide-react.

The axios client (`src/lib/api.ts`) uses `withCredentials: true` so JWT
cookies set by the backend are sent on every request, and auto-refreshes a
stale access token via `POST /auth/refresh` on 401.

## Current endpoints

| Method | URL | Notes |
|---|---|---|
| POST | `/api/v1/auth/register` | `{phone, password, first_name, last_name}` → sets JWT cookies |
| POST | `/api/v1/auth/login` | `{phone, password}` → sets JWT cookies |
| POST | `/api/v1/auth/logout` | clears cookies |
| POST | `/api/v1/auth/refresh` | refresh access token |
| GET / PATCH | `/api/v1/auth/me` | current user |
| GET | `/api/v1/tests/?module=reading` | list published tests |
| GET | `/api/v1/tests/:id/` | test detail (no answer leakage) |
| POST | `/api/v1/tests/:test_id/attempts` | start attempt |
| GET | `/api/v1/attempts/` | my history |
| GET | `/api/v1/attempts/:id/` | attempt detail + saved answers |
| PATCH | `/api/v1/attempts/:id/answers/` | bulk save `{answers:[{question_id, answer}]}` |
| POST | `/api/v1/attempts/:id/submit/` | finalise + grade |
| GET | `/api/v1/attempts/:id/result/` | scored result with correct answers |
