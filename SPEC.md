# IELTSation — Texnik Spesifikatsiya

> **Maqsad:** Uzbekistondagi birinchi IELTS kompyuterda topshiriladigan mock test platformasini qurish.
> **Ishlab chiquvchi:** Jasmina (Django + Flutter bilan tajriba)
> **Ishlab chiqish vositasi:** Claude Code (Cursor Agent)
> **Prototip:** `ieltsation-prototype.html` — dizayn va UX uchun reference

---

## 1. Loyiha konteksti

### 1.1 Biznes maqsadlari

- **B2C:** O'quvchilar oylik obuna (149k so'm / oy) to'laydi, 40+ mock test + AI feedback oladi
- **B2B:** Maktab/markazlar yillik litsenziya oladi ($1,200/yil), o'z testlarini qo'sha oladi, o'quvchilarini kuzatib boradi
- **USP:** Haqiqiy IELTS Computer-Delivered test interfeysining aniq nusxasi + Uzbek tilida yo'riqnoma + lokallashtirilgan narxlar

### 1.2 Competitive landscape

- Raqobatchilar: IRBIS 64 (~$13k/yil, faqat universitetlar), britishcouncil.org (ingliz tilida, Uzbekistonda lokalizatsiyasiz)
- **Bizning farqimiz:** Mobile-first, o'zbek tili, tuman/viloyat markazlariga mosligan narx, Telegram orqali autentifikatsiya

---

## 2. Tech stack qarori

### 2.1 Asosiy tanlov

| Qatlam | Tanlov | Sababi |
|--------|--------|--------|
| **Backend** | Django 5.x + Django REST Framework | Jasmina Django bilan ishlaydi (ILDIZ, Qulay Makon) |
| **Database** | PostgreSQL 16 | Allaqachon Contabo serverda bor |
| **Frontend** | React 18 + Vite + TypeScript | Modern SPA, Claude Code bilan yaxshi ishlaydi |
| **Styling** | TailwindCSS + shadcn/ui | Tezlik + konsistent dizayn |
| **Routing** | React Router 6 | Standart SPA routing |
| **State** | Zustand (global) + TanStack Query (server state) | Redux'dan yengilroq |
| **Forms** | React Hook Form + Zod | Validatsiya va type safety |
| **Auth** | JWT (access + refresh) — httpOnly cookie | XSS himoyasi |
| **Deploy (backend)** | Gunicorn + Nginx + Supervisor (Contabo) | Mavjud infra |
| **Deploy (frontend)** | Static build → Nginx | `dist/` ni Nginx serve qiladi |
| **AI feedback** | Anthropic Claude API (Writing/Speaking) | Uzbek tilini yaxshi biladi |
| **Storage** | Contabo lokal diska (audio fayllar) | S3 ga keyin ko'chirish mumkin |
| **Payments** | Click + Payme | Uzbekistondagi eng keng tarqalgan |

### 2.2 Monorepo struktura

```
ieltsation/
├── backend/              # Django project
│   ├── manage.py
│   ├── ieltsation/       # settings
│   ├── apps/
│   │   ├── accounts/     # users, auth
│   │   ├── tests/        # IELTS tests, questions
│   │   ├── attempts/     # test attempts, scoring
│   │   ├── content/      # audio, images
│   │   ├── ai_feedback/  # Claude API integration
│   │   ├── payments/     # Click/Payme
│   │   └── analytics/    # dashboard stats
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/             # React + Vite
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/          # api client, utils
│   │   ├── stores/       # zustand stores
│   │   └── types/        # TypeScript types
│   ├── package.json
│   └── vite.config.ts
│
├── deploy/
│   ├── nginx.conf
│   ├── supervisor.conf
│   └── deploy.sh
│
└── README.md
```

---

## 3. Foydalanuvchi rollari (RBAC)

| Rol | Imkoniyatlari |
|-----|---------------|
| **Guest** | Landing, narxlar, bepul demo testlari |
| **Student** | Barcha testlarni topshirish (subscription status ga qarab), natijalarni ko'rish, tarix |
| **Teacher** | O'z o'quvchilarining natijalarini ko'rish, Writing essay ga qo'lda baho qo'yish |
| **Admin** | Testlar CRUD, foydalanuvchilar CRUD, analytics, sozlamalar |
| **Super Admin** | Barcha Admin huquqlari + billing, multi-tenant |

**Subscription status:**
- `free` — 3 ta demo test
- `standard` — barcha test (oylik)
- `premium` — barcha test + AI feedback (oylik)
- `enterprise` — B2B (maktab/markaz)

---

## 4. Data Model (Database Schema)

### 4.1 Accounts

```python
class User(AbstractUser):
    # inherits: username, email, first_name, last_name, password
    phone = CharField(max_length=20, unique=True)
    telegram_id = BigIntegerField(null=True, unique=True)
    role = CharField(choices=['student','teacher','admin','super_admin'])
    target_band = DecimalField(max_digits=2, decimal_places=1, null=True)  # e.g. 7.5
    language = CharField(choices=['uz','ru','en'], default='uz')
    created_at = DateTimeField(auto_now_add=True)

class Subscription(Model):
    user = OneToOneField(User)
    plan = CharField(choices=['free','standard','premium','enterprise'])
    status = CharField(choices=['active','expired','cancelled'])
    starts_at = DateTimeField()
    expires_at = DateTimeField()

class Organization(Model):  # B2B clients
    name = CharField()
    domain = CharField(unique=True)  # subdomain for multi-tenant
    owner = ForeignKey(User)
    plan = CharField(choices=['starter','university','enterprise'])
    created_at = DateTimeField(auto_now_add=True)

class OrganizationMember(Model):
    org = ForeignKey(Organization)
    user = ForeignKey(User)
    role = CharField(choices=['student','teacher','admin'])
```

### 4.2 Tests

```python
class Test(Model):
    id = UUIDField(primary_key=True)
    organization = ForeignKey(Organization, null=True)  # null = public test
    name = CharField(max_length=200)
    module = CharField(choices=['listening','reading','writing','speaking'])
    test_type = CharField(choices=['academic','general'], default='academic')
    difficulty = CharField(choices=['easy','medium','hard'])
    duration_minutes = IntegerField()
    description = TextField(blank=True)
    is_published = BooleanField(default=False)
    access_level = CharField(choices=['free','standard','premium'])
    created_by = ForeignKey(User)
    created_at = DateTimeField(auto_now_add=True)

class Passage(Model):  # Reading passage OR Listening transcript
    test = ForeignKey(Test, related_name='passages')
    part_number = IntegerField()  # 1-4 for listening, 1-3 for reading
    title = CharField(max_length=200)
    content = TextField()
    audio_file = FileField(null=True, upload_to='audio/')  # for listening
    audio_duration_seconds = IntegerField(null=True)
    order = IntegerField()

class Task(Model):  # Writing/Speaking tasks
    test = ForeignKey(Test, related_name='tasks')
    task_number = IntegerField()  # 1 or 2
    prompt = TextField()
    image = ImageField(null=True)  # for Task 1 chart/graph
    min_words = IntegerField(default=150)
    time_minutes = IntegerField(default=20)

class Question(Model):
    passage = ForeignKey(Passage, null=True, related_name='questions')
    order = IntegerField()
    question_type = CharField(choices=[
        'mcq',           # multiple choice
        'tfng',          # true/false/not given
        'ynng',          # yes/no/not given
        'fill',          # fill in the blank
        'matching',      # paragraph matching
        'matching_headings',
        'short_answer',
        'summary_completion',
        'form_completion',
        'note_completion',
        'map_labeling',
        'diagram_labeling',
    ])
    text = TextField()
    options = JSONField(default=list)  # for mcq, matching
    correct_answer = JSONField()  # str or list for multiple correct
    acceptable_answers = JSONField(default=list)  # alternatives
    group_id = IntegerField()  # for grouping questions with same instruction
    instruction = TextField(blank=True)
    points = IntegerField(default=1)
```

### 4.3 Attempts (topshirishlar)

```python
class Attempt(Model):
    id = UUIDField(primary_key=True)
    user = ForeignKey(User)
    test = ForeignKey(Test)
    status = CharField(choices=['in_progress','submitted','graded','expired'])
    started_at = DateTimeField(auto_now_add=True)
    submitted_at = DateTimeField(null=True)
    time_spent_seconds = IntegerField(default=0)
    raw_score = IntegerField(null=True)  # correct/total
    band_score = DecimalField(max_digits=2, decimal_places=1, null=True)

class Answer(Model):
    attempt = ForeignKey(Attempt, related_name='answers')
    question = ForeignKey(Question)
    user_answer = JSONField()  # can be str, list, dict
    is_correct = BooleanField(null=True)
    points_earned = DecimalField(max_digits=4, decimal_places=1, default=0)
    flagged = BooleanField(default=False)
    time_spent_seconds = IntegerField(default=0)

class WritingSubmission(Model):
    attempt = ForeignKey(Attempt)
    task = ForeignKey(Task)
    essay_text = TextField()
    word_count = IntegerField()
    ai_feedback = JSONField(null=True)  # from Claude API
    ai_band_score = DecimalField(max_digits=2, decimal_places=1, null=True)
    teacher_feedback = TextField(blank=True)
    teacher_band_score = DecimalField(max_digits=2, decimal_places=1, null=True)
    graded_by = ForeignKey(User, null=True)
    submitted_at = DateTimeField(auto_now_add=True)

class SpeakingSubmission(Model):
    attempt = ForeignKey(Attempt)
    task = ForeignKey(Task)
    audio_file = FileField(upload_to='speaking/')
    transcript = TextField(blank=True)  # Whisper API
    ai_feedback = JSONField(null=True)
    ai_band_score = DecimalField(max_digits=2, decimal_places=1, null=True)
```

### 4.4 Payments

```python
class Payment(Model):
    user = ForeignKey(User)
    amount = DecimalField(max_digits=12, decimal_places=2)
    currency = CharField(default='UZS')
    provider = CharField(choices=['click','payme','manual'])
    provider_txn_id = CharField(max_length=200)
    status = CharField(choices=['pending','paid','failed','refunded'])
    subscription_months = IntegerField(default=1)
    created_at = DateTimeField(auto_now_add=True)
    paid_at = DateTimeField(null=True)
```

---

## 5. API Endpoints (REST)

**Base URL:** `https://api.ieltstation.uz/v1/`

### 5.1 Auth

```
POST   /auth/register              # {phone, password, first_name, last_name}
POST   /auth/login                 # {phone, password} → sets httpOnly cookies
POST   /auth/logout
POST   /auth/refresh               # refresh token → new access token
POST   /auth/telegram              # {telegram_init_data} → JWT
POST   /auth/password/reset
GET    /auth/me                    # current user profile
PATCH  /auth/me                    # update profile
```

### 5.2 Tests (public)

```
GET    /tests?module=reading       # list tests (filtered by subscription)
GET    /tests/:id                  # test details (without answers)
GET    /tests/:id/passages         # passages + questions (no answers)
POST   /tests/:id/attempts         # start new attempt → returns attempt_id
```

### 5.3 Attempts

```
GET    /attempts                   # my attempts history
GET    /attempts/:id               # attempt details
PATCH  /attempts/:id/answers       # save answer (auto-save every 10s)
POST   /attempts/:id/submit        # finalize + grade
GET    /attempts/:id/result        # scored result with breakdown
```

### 5.4 Writing/Speaking AI

```
POST   /writing/submit             # {attempt_id, essay_text}
GET    /writing/:id/feedback       # poll for AI feedback (async)
POST   /speaking/submit            # multipart: audio file
GET    /speaking/:id/feedback
```

### 5.5 Admin

```
# Tests CRUD
GET    /admin/tests
POST   /admin/tests
GET    /admin/tests/:id            # includes correct answers
PATCH  /admin/tests/:id
DELETE /admin/tests/:id
POST   /admin/tests/:id/publish
POST   /admin/tests/:id/duplicate  # copy existing test

# Passages & Questions
POST   /admin/tests/:id/passages
PATCH  /admin/passages/:id
POST   /admin/passages/:id/questions
PATCH  /admin/questions/:id
DELETE /admin/questions/:id

# Media upload
POST   /admin/upload/audio         # multipart → returns {url, duration}
POST   /admin/upload/image

# Users
GET    /admin/users?search=...
POST   /admin/users
PATCH  /admin/users/:id
DELETE /admin/users/:id

# Analytics
GET    /admin/stats/overview       # dashboard stats
GET    /admin/stats/revenue?period=month
GET    /admin/stats/top-tests
```

### 5.6 Organizations (B2B)

```
GET    /org/dashboard              # for org admin
GET    /org/members
POST   /org/members                # invite
GET    /org/tests                  # org-private tests
POST   /org/tests                  # create org test
```

---

## 6. Frontend Pages (React Router)

### 6.1 Public routes

```
/                          # Landing page
/pricing                   # Plans
/login
/register
/tests                     # → redirect to /tests/reading
/tests/:module             # Test list (requires auth)
/tests/:module/:id         # Test preview + start
/take/:attemptId           # Test-taking interface (reading/listening/writing)
/take/:attemptId/speaking  # Speaking interface (mic recording)
/result/:attemptId         # Results page
/history                   # My attempts
/profile                   # User profile & settings
/subscription              # Current plan + upgrade
```

### 6.2 Admin routes (requires admin role)

```
/admin                     # Dashboard
/admin/tests               # Tests list
/admin/tests/new           # Create test (multi-step)
/admin/tests/:id/edit      # Edit test
/admin/tests/:id/questions # Question builder
/admin/users               # Users management
/admin/results             # All submissions
/admin/writing-queue       # Writing essays awaiting grade
/admin/settings            # Platform settings
```

### 6.3 Test-taker interface requirements

**CRITICAL: IELTS CD interface compliance**

Reading/Listening interface must have:
- Top bar: Back | Back to [Module] Tests | IELTS logo | Test taker ID | Show Correct Answers toggle | Fullscreen | Menu | Re-Do test | Submit | Timer
- Part header: Part X title + instruction (+ audio player for listening)
- Split-screen: passage on left, questions on right (resizable divider)
- Bottom navigation: Part tabs with question dots (1-10, 11-20, etc.)
- Question dot states: empty (unanswered), filled black (answered), yellow (current), green (correct after review), red (wrong after review)
- Floating prev/next arrow buttons on right

Writing interface:
- Task prompt panel (left) + textarea (right)
- Word counter (live)
- Auto-save indicator
- Recommendations pills (click to insert phrase)
- Chart/image for Task 1

---

## 7. MVP Scope (Phase 1 — 4 hafta)

**Majburiy (pre-sale demo uchun):**

1. ✅ Auth (phone + password, Telegram Login Widget)
2. ✅ Landing page (prototipdagi dizaynda)
3. ✅ Home (4 module cards)
4. ✅ Test ro'yxati (har modul uchun)
5. ✅ Reading test taker (to'liq ishlaydigan — matching, T/F/NG, MCQ, fill)
6. ✅ Listening test taker (audio player + fill + MCQ)
7. ✅ Auto-scoring + band conversion
8. ✅ Results page (band score + review mode)
9. ✅ Attempt history
10. ✅ Admin: Dashboard (stats)
11. ✅ Admin: Test CRUD (nom, modul, passage, savollar)
12. ✅ Admin: Question builder (4 savol turi: mcq, tfng, fill, matching)
13. ✅ Admin: Audio upload
14. ✅ Admin: Users list

## 8. Phase 2 (sotib bo'lgandan keyin — 6 hafta)

1. Writing test + Claude API integration (AI feedback + band score)
2. Speaking test + OpenAI Whisper + Claude
3. Payments (Click + Payme)
4. Subscription logic (free/standard/premium gating)
5. Teacher role (grade writing manually)
6. Telegram bot integration (natijalar va eslatmalar)
7. Multi-tenant (subdomain per organization)
8. B2B admin panel (teacher management, student analytics)
9. Flutter mobile app (reuse auth + test-taker)

---

## 9. Deployment (Contabo VPS)

### 9.1 Infra

```
┌─────────────────────────────────────────┐
│  Nginx (443)                            │
│  ├─ ieltstation.uz          → React     │
│  ├─ api.ieltstation.uz      → Gunicorn  │
│  ├─ media.ieltstation.uz    → static    │
│  └─ admin.ieltstation.uz    → React     │
└─────────────────────────────────────────┘
           │
           ├─ Gunicorn (Django) — Supervisor
           ├─ PostgreSQL 16
           ├─ Redis (Celery queue)
           └─ Celery workers — Supervisor
              └─ tasks: AI feedback, email, etc.
```

### 9.2 Environment variables

```env
# backend/.env
DJANGO_SECRET_KEY=...
DATABASE_URL=postgresql://ieltsation:password@localhost:5432/ieltsation
REDIS_URL=redis://localhost:6379/0
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...          # for Whisper
CLICK_SERVICE_ID=...
CLICK_MERCHANT_ID=...
CLICK_SECRET_KEY=...
PAYME_MERCHANT_ID=...
PAYME_SECRET_KEY=...
TELEGRAM_BOT_TOKEN=...
ALLOWED_HOSTS=ieltstation.uz,api.ieltstation.uz
CORS_ALLOWED_ORIGINS=https://ieltstation.uz
```

### 9.3 Nginx config skeleton

```nginx
server {
    listen 443 ssl http2;
    server_name ieltstation.uz;
    root /var/www/ieltsation/frontend/dist;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /media/ {
        alias /var/www/ieltsation/backend/media/;
        expires 30d;
    }
}

server {
    listen 443 ssl http2;
    server_name api.ieltstation.uz;

    location / {
        proxy_pass http://unix:/run/ieltsation-gunicorn.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 10. Security checklist

- [ ] HTTPS (Let's Encrypt)
- [ ] JWT in httpOnly + Secure cookie (not localStorage)
- [ ] CSRF token for mutations
- [ ] Rate limiting (django-ratelimit)
- [ ] SQL injection (Django ORM — by default)
- [ ] XSS (React escaping by default + DOMPurify for user HTML)
- [ ] Secure password hashing (Django default: PBKDF2)
- [ ] Multi-tenant data isolation (Organization filter middleware)
- [ ] Test answer leakage prevention (never send `correct_answer` to student endpoints)
- [ ] Audio URL signing (prevent direct downloads)
- [ ] Admin panel: separate subdomain + IP allow-list (optional)

---

# 🎯 Phase 0: CLAUDE CODE STARTER PROMPT

**Quyidagi matnni Claude Code'ga yuboring (birinchi turn):**

---

```
CONTEXT:
Men IELTSation nomli IELTS mock test platformasini quraman. To'liq texnik spec `SPEC.md` faylida (yuqoridagi hujjat). Prototip dizayni `ieltsation-prototype.html` faylida (reference uchun).

Tech stack: Django 5 + DRF (backend) + React 18 + Vite + TypeScript + TailwindCSS (frontend). PostgreSQL. Deploy Contabo VPS (Nginx + Gunicorn + Supervisor).

TASK — Phase 0: Loyiha scaffolding

Quyidagilarni qilib ber:

1. Monorepo strukturasini yarat: `ieltsation/backend/` va `ieltsation/frontend/`

2. BACKEND setup:
   - Django 5.x project `ieltsation` nomi bilan
   - Apps yarat: accounts, tests, attempts, content, ai_feedback, payments, analytics
   - DRF o'rnat va sozla (authentication: JWT via simplejwt, httpOnly cookie)
   - PostgreSQL connection (DATABASE_URL env variable)
   - CORS sozlamasi (frontend uchun)
   - django-environ bilan .env fayl
   - apps/accounts/models.py da User modeli (spec 4.1 ga qarab)
   - requirements.txt ga: django, djangorestframework, djangorestframework-simplejwt,
     django-cors-headers, django-environ, psycopg2-binary, pillow, celery, redis,
     anthropic (SDK)
   - Base settings bo'linadi: base.py, dev.py, prod.py
   - Initial migration yarat va ishlatgan bo'l

3. FRONTEND setup:
   - Vite + React 18 + TypeScript template
   - TailwindCSS o'rnat
   - shadcn/ui init qil (button, input, form, toast, dialog, select, tabs, card)
   - React Router 6 sozla
   - Zustand store yarat: auth store (user, isAuthenticated, login, logout)
   - TanStack Query sozla
   - API client yarat: `src/lib/api.ts` (axios instance + refresh token interceptor)
   - Folder strukturasi: pages/, components/, hooks/, lib/, stores/, types/
   - Basic route setup: / (landing), /login, /register
   - Placeholder pages (haqiqiy content keyingi bosqichda)

4. SHARED:
   - Root README.md — qanday lokal ishlatish, env variables
   - .gitignore (Python + Node)
   - `docker-compose.yml` — lokal dev uchun (postgres + redis)
   - `Makefile` — shortcutlar: `make dev-backend`, `make dev-frontend`, `make migrate`

MUHIM:
- O'zbekcha commentlar yozma, English ishlat
- Har bir fayl tugagandan keyin `README.md` ga setup instruksiya qo'sh
- Testdan oldin nimalar kerakligini (DATABASE, REDIS) aniq ayt
- Har bir qadamdan keyin `git commit` qilaman — atomik commitlar qil

BOSHLASH:
1-qadam: Monorepo yarat, git init, .gitignore yoz

Keyin menga ayt — keyingi qadamga o'taman.
```

---

# Keyingi promptlar (Phase 1 tasks — tartib bilan)

Har bir qadamdan keyin git commit qil, keyin keyingi promptga o't:

### Task 1: User model va JWT auth (backend)

```
Task 1: Authentication system

accounts/ app ichida User modelini SPEC.md 4.1 ga mos yarat. Keyin serializers.py, views.py, urls.py yoz:

- POST /api/v1/auth/register (phone, password, first_name, last_name)
- POST /api/v1/auth/login (phone, password) → httpOnly cookies (access+refresh)
- POST /api/v1/auth/logout (clears cookies)
- POST /api/v1/auth/refresh
- GET /api/v1/auth/me (requires auth)

Custom JWT authentication class — cookie dan o'qiydi, Authorization header emas.

Rate limiting qo'sh: login uchun 5 ta/daqiqa.

Phone validation: uzbek format (+998XXXXXXXXX).

Testlar yoz: tests/test_auth.py — har endpoint uchun smoke test.

Migrations yarat.
```

### Task 2: Test model va admin CRUD (backend)

```
Task 2: Test models & admin CRUD API

tests/ app: SPEC 4.2 bo'yicha Test, Passage, Task, Question modellari.

admin/ viewlar: DRF ViewSet bilan
- POST/GET/PATCH/DELETE /api/v1/admin/tests
- Nested endpoints: passages, questions
- Permission: IsAdminUser

Question.options va correct_answer JSONField — lekin validatsiya yoz:
- mcq: options = list[str], correct_answer = str (bitta)
- tfng: correct_answer in ['TRUE','FALSE','NOT GIVEN']
- fill: correct_answer = str, acceptable_answers = list[str]
- matching: correct_answer = str (letter)

Student API (GET /api/v1/tests) — `correct_answer` FIELDINI JAVOBGA QO'SHMA. Admin API qo'shadi.

Testlar yoz. Fixture yarat — spec dagi "South City Cycling Club" va "The Concept of Intelligence" testlarini seed qilsin.
```

### Task 3: Frontend auth flow

```
Task 3: Frontend auth pages

pages/auth/LoginPage.tsx, RegisterPage.tsx — prototypedagi dizaynda (ieltsation-prototype.html # /login sahifasi reference).

- React Hook Form + Zod validation
- Telegram Login Widget (script-based)
- After login: redirect to intended URL yoki /
- Auth store (Zustand): user state, login(), logout(), refreshUser()
- ProtectedRoute component: auth required bo'lsa /login ga redirect
- AdminRoute: role === 'admin' tekshiradi

API client interceptor:
- 401 response → refresh token → retry
- Refresh fail → logout

UI: shadcn Form components, o'zbekcha error messagelar.
```

### Task 4: Test listing va test taker UI

```
Task 4: Test taker interface (MVP core)

pages/TestListPage.tsx (# /tests/:module):
- TanStack Query: useTests(module)
- Card grid (prototypedagi dizaynda)
- Filter: difficulty, duration

pages/TakeTestPage.tsx (# /take/:attemptId):
- Reading va Listening uchun
- Split-screen layout (resizable - react-split-pane yoki custom)
- Question dots navigation
- Auto-save answers (debounce 2s)
- Timer (backend dan kelgan remainingSeconds)
- Submit confirmation modal

Question turlari — har biri uchun alohida component:
- <MCQQuestion />
- <TFNGQuestion />
- <FillBlankQuestion />
- <MatchingQuestion />

Prototipdagi exact UI ni saqla — faqat ma'lumotlar API dan keladi.

Backend tomondan: GET /api/v1/tests/:id/attempt-data (passages + questions, no answers).
POST /api/v1/attempts/:id/answers (bulk save).
POST /api/v1/attempts/:id/submit → grading → redirect to /result/:id.
```

### Task 5: Grading engine + Results page

```
Task 5: Grading & results

backend/apps/attempts/grading.py:
- grade_attempt(attempt) funksiya: har savolni tekshiradi, band scoreni hisoblaydi
- Band conversion table (SPEC da bor)
- Fuzzy matching for fill-in-blank (capitalize-insensitive, stripe whitespace,
  acceptable_answers ham tekshiradi)

frontend pages/ResultPage.tsx:
- Band score big number
- Breakdown (correct/wrong per section)
- Review mode: "Show Correct Answers" toggle → question-by-question review
- Prototype dagi UI

Celery task yoki synchronous? — MVP uchun synchronous. Writing uchun keyin asynchronous qilamiz.
```

### Task 6: Admin panel UI

```
Task 6: Admin panel

pages/admin/ folder:
- DashboardPage (stat cards + recent attempts)
- TestsListPage (table + search + filter)
- TestEditorPage — multi-step form:
  - Step 1: Metadata (name, module, duration)
  - Step 2: Passage/audio upload
  - Step 3: Question builder (add/edit/delete/reorder)
  - Step 4: Review & publish

Question builder — drag-and-drop reorder (react-beautiful-dnd).

Audio upload: multipart, progress bar.

Auto-save drafts.

Prototip `admin.html` va `admin-add-test.html` ni reference qil.
```

### Task 7: Landing page

```
Task 7: Marketing landing page

pages/LandingPage.tsx — prototype `landing.html` ga qara.

- Hero: giant headline + CTA
- Stats (12,400+ students)
- Feature grid
- How it works (3 steps)
- Testimonial
- Pricing (3 ta plan + B2B)
- Footer

SEO: react-helmet, meta tags, og: tags.

Responsive: mobile-first.
```

### Task 8: Deployment

```
Task 8: Deploy to Contabo

deploy/ papkasida:
- nginx.conf (SPEC 9.3)
- supervisor/ielts-gunicorn.conf
- supervisor/ielts-celery.conf
- deploy.sh — pull, migrate, collectstatic, build frontend, restart services

GitHub Actions .github/workflows/deploy.yml (optional):
- On push to main: SSH to Contabo, run deploy.sh

Env setup:
- /var/www/ieltsation/
- systemd service (optional, supervisor OK)
- Let's Encrypt certbot
- Log rotation

Domain sozlash: ieltstation.uz (yoki yangi sotib olgan domen).
```

---

## Ishga tushirish protokoli

1. **Claude Code sessiyasini boshla**, yuqoridagi "Phase 0 Starter Prompt" ni yubor
2. Har qadamdan keyin test qil, ishlasa `git commit -m "Task N: ..."` qil
3. Xatolik bo'lsa — **Claude ga xatolik matnini yubor**, tuzatsin
4. Har bosqich tugagach, keyingi Task promptini yubor
5. Phase 1 tugagach (~2-3 hafta) → Contabo ga deploy qil, domain qo'sh, SSL sozla
6. **Pre-sale boshla** (4-5 ta maktab/markazga demo ko'rsat, kamida bittadan pul ol)
7. Pul kelganda Phase 2 ni boshla (AI feedback, Payments, Flutter app)

## Xatoliklar uchun

Har bir vaziyatda Claude Code'ga xatolikni to'liq yubor:
- Xatolik matni (terminal output)
- Qaysi faylda sodir bo'ldi
- Nimani ishlatmoqchi edingiz
- Qanday natija kutgan edingizClaude Code o'zi debug qiladi va tuzatib beradi.

## Budget

- Claude API (Writing AI): ~$0.10 per essay, 1000 essay/oy = $100/oy
- OpenAI Whisper (Speaking): ~$0.006/min, 500 min/oy = $3/oy
- Contabo VPS (mavjud): $0 qo'shimcha
- Domain (.uz): ~$30/yil
- Click/Payme komissiya: 2-3% har tranzaksiyadan

**MVP boshlanishiga cheksiz:** faqat vaqt va elektr. Deploy bepul (mavjud VPS).

---

*Oxirgi yangilanish: 2026-04-24*
