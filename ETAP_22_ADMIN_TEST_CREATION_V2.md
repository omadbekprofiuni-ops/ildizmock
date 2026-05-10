# ETAP 22 — ADMIN TEST CREATION 2.0 (Examy-Quality)

> **Goal:** Rebuild the test creation system in the ILDIZ Mock admin panel to match the quality and feature set of examy.me, support all 12+ IELTS question types (including Matching Headings, which is currently missing), fix the existing save/edit/refresh bugs, and introduce a wizard-based flow with auto-save, draft state, live preview, and proper validation before publishing.

---

## 📌 PROJECT CONTEXT (DO NOT SKIP — READ FIRST)

**Repository:** `omadbekprofiuni-ops/ildizmock`
**Domain:** `ildiz-testing.uz`
**Server:** Contabo VPS `207.180.226.230`, user `ildiz`, Supervisor program `ildizmock`

**Stack:**
- Backend: Django 5.x + Django REST Framework, PostgreSQL, JWT auth (httpOnly cookie)
- Frontend: React 18 + Vite + TypeScript + TailwindCSS + shadcn/ui
- State: Zustand (auth) + TanStack Query (server state)
- Forms: React Hook Form + Zod
- Multi-tenant: `apps/organizations/` model with `Organization` slug-scoped data

**Monorepo layout:**
```
ildizmock/
├── backend/
│   └── apps/
│       ├── accounts/
│       ├── organizations/
│       ├── tests/         ← MAIN FOCUS OF THIS ETAP
│       ├── attempts/
│       ├── content/
│       ├── ai_feedback/
│       ├── payments/
│       └── analytics/
└── frontend/
    └── src/
        ├── pages/
        │   ├── superadmin/
        │   └── center/
        ├── components/
        ├── hooks/
        ├── lib/
        ├── stores/
        └── types/
```

**Language:** All UI text, model verbose names, comments, and code in **English only**. Do not introduce any Uzbek strings.

---

## 🐛 KNOWN BUGS THIS ETAP MUST FIX

These are blocking current admins. Address them as part of the rewrite:

1. **Test save loses data on refresh** — Test gets created, but reopening edit page shows empty form. Likely: state lives only in client, no draft persistence in DB.
2. **`/edit/tests/:id` returns 404** — Route registered incorrectly, or backend `/api/v1/tests/<id>/` GET endpoint missing for draft tests.
3. **Edit changes don't persist** — User edits a saved test, hits Save, refreshes, edits gone.
4. **Matching Headings question type cannot be added** — UI/model gap. Currently the workaround is to upload a screenshot of the question, which is unacceptable.
5. **Test list shows empty/broken cards** — Frontend `WritingSubmissions.tsx`, `Statistics.tsx` (superadmin) and `Analytics.tsx` (center) are placeholders.

---

## 🎯 BENCHMARK: WHAT EXAMY.ME DOES THAT WE MUST MATCH

- Test creation produces output that on the student side **looks identical to real Computer-Delivered IELTS** (split-pane, question palette at the bottom, timer top-right, highlight by double-click, review screen before submit).
- Every real IELTS question type is supported in the admin and renders correctly to students.
- Tests can be cloned, drafted, previewed, and published — never lost on refresh.
- Audio for Listening plays exactly once (no replay, no scrub) and the admin can mark section boundaries on the timeline.
- Writing Task 1 supports image upload (charts, graphs, maps); student-side word counter enforces 150 / 250 minimums.

---

## 🏗️ ARCHITECTURE OVERVIEW

```
                      ┌──────────────────────────┐
                      │   Test (parent)           │
                      │   status: draft/published │
                      │   type: full/L/R/W/S      │
                      │   organization (tenant)   │
                      └────────────┬──────────────┘
                                   │ 1..N
                      ┌────────────▼──────────────┐
                      │   Section                  │
                      │   order, instructions      │
                      │   passage_id (FK, reuse)   │
                      │   audio_id (FK, reuse)     │
                      │   image_id (FK, Writing)   │
                      └────────────┬──────────────┘
                                   │ 1..N
                      ┌────────────▼──────────────┐
                      │   Question                 │
                      │   type (12 IELTS types)    │
                      │   order, points            │
                      │   payload (JSONB)          │
                      │   answer_key (JSONB)       │
                      └───────────────────────────┘

         ┌──────────────┐     ┌──────────────┐
         │ PassageBank   │     │ AudioBank     │
         │ (reusable)    │     │ (reusable)    │
         └──────────────┘     └──────────────┘
```

The `payload` and `answer_key` are JSONB fields whose schema depends on `type`. This lets us add new question types without migrations.

---

# PART 1 — DATA MODEL CHANGES

## 1.1 Update `apps/tests/models.py`

```python
import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from apps.organizations.models import Organization

User = get_user_model()


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


# ─────────────────────────────────────────────
# REUSABLE BANKS
# ─────────────────────────────────────────────

class PassageBank(TimeStampedModel):
    """Reusable reading passage. Can be referenced by many ReadingSections."""
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='passages',
        null=True, blank=True,  # null = global / shared by superadmin
    )
    title = models.CharField(max_length=255)
    body_html = models.TextField(help_text="Rich HTML; paragraphs marked with <p data-para='A'>")
    word_count = models.PositiveIntegerField(default=0)
    source = models.CharField(max_length=255, blank=True, help_text="e.g. Cambridge IELTS 17 Test 2")
    tags = models.JSONField(default=list, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['organization', '-created_at'])]


class AudioBank(TimeStampedModel):
    """Reusable listening audio with section markers."""
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='audios',
        null=True, blank=True,
    )
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to='audio/listening/%Y/%m/')
    duration_seconds = models.PositiveIntegerField(default=0)
    transcript = models.TextField(blank=True)
    section_markers = models.JSONField(
        default=list, blank=True,
        help_text="[{'section': 1, 'start': 0, 'end': 480}, ...]"
    )
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    class Meta:
        ordering = ['-created_at']


# ─────────────────────────────────────────────
# TEST (PARENT)
# ─────────────────────────────────────────────

class Test(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        ARCHIVED = 'archived', 'Archived'

    class TestType(models.TextChoices):
        FULL = 'full', 'Full Test (L+R+W+S)'
        LISTENING = 'listening', 'Listening Only'
        READING = 'reading', 'Reading Only'
        WRITING = 'writing', 'Writing Only'
        SPEAKING = 'speaking', 'Speaking Only'

    class Module(models.TextChoices):
        ACADEMIC = 'academic', 'Academic'
        GENERAL = 'general', 'General Training'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='tests',
        null=True, blank=True,  # null = global library shared by superadmin
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=16, choices=TestType.choices)
    module = models.CharField(max_length=16, choices=Module.choices, default=Module.ACADEMIC)
    difficulty = models.PositiveSmallIntegerField(default=5, help_text="1-10")
    duration_minutes = models.PositiveIntegerField(default=180)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='tests_created')
    cloned_from = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True)

    # Soft delete (from ETAP 13)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status', '-created_at']),
            models.Index(fields=['type', 'status']),
        ]

    def publish(self, user=None):
        # Validation must pass before publishing — see PART 6
        from .validators import validate_test_for_publish
        validate_test_for_publish(self)
        self.status = self.Status.PUBLISHED
        self.published_at = timezone.now()
        self.save(update_fields=['status', 'published_at'])

    def clone(self, user):
        """Deep clone — new Test with copied Sections and Questions, status=draft."""
        from copy import deepcopy
        new_test = Test.objects.create(
            organization=self.organization,
            title=f"{self.title} (Copy)",
            description=self.description,
            type=self.type,
            module=self.module,
            difficulty=self.difficulty,
            duration_minutes=self.duration_minutes,
            status=Test.Status.DRAFT,
            created_by=user,
            cloned_from=self,
        )
        for section in self.sections.all():
            new_section = Section.objects.create(
                test=new_test,
                order=section.order,
                kind=section.kind,
                instructions=section.instructions,
                passage=section.passage,  # reuse, do not duplicate passage
                audio=section.audio,
                image=section.image,
                duration_seconds=section.duration_seconds,
            )
            for q in section.questions.all():
                Question.objects.create(
                    section=new_section,
                    order=q.order,
                    type=q.type,
                    points=q.points,
                    payload=deepcopy(q.payload),
                    answer_key=deepcopy(q.answer_key),
                )
        return new_test


# ─────────────────────────────────────────────
# SECTION
# ─────────────────────────────────────────────

class Section(TimeStampedModel):
    class Kind(models.TextChoices):
        LISTENING = 'listening', 'Listening'
        READING = 'reading', 'Reading'
        WRITING = 'writing', 'Writing'
        SPEAKING = 'speaking', 'Speaking'

    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='sections')
    order = models.PositiveSmallIntegerField()
    kind = models.CharField(max_length=16, choices=Kind.choices)
    instructions = models.TextField(blank=True)

    # Optional content sources (depending on kind)
    passage = models.ForeignKey(
        PassageBank, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='sections',
    )
    audio = models.ForeignKey(
        AudioBank, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='sections',
    )
    image = models.ImageField(upload_to='writing/task1/%Y/%m/', null=True, blank=True)

    duration_seconds = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['test', 'order']
        unique_together = [('test', 'order')]


# ─────────────────────────────────────────────
# QUESTION (12 IELTS types)
# ─────────────────────────────────────────────

class Question(TimeStampedModel):
    class Type(models.TextChoices):
        # Reading & Listening shared
        TRUE_FALSE_NG = 'tfng', 'True / False / Not Given'
        YES_NO_NG = 'ynng', 'Yes / No / Not Given'
        MCQ_SINGLE = 'mcq_single', 'Multiple Choice (single)'
        MCQ_MULTI = 'mcq_multi', 'Multiple Choice (multiple)'
        MATCHING_HEADINGS = 'matching_headings', 'Matching Headings'
        MATCHING_INFORMATION = 'matching_info', 'Matching Information'
        MATCHING_FEATURES = 'matching_features', 'Matching Features'
        MATCHING_SENTENCE_ENDINGS = 'matching_endings', 'Matching Sentence Endings'
        SENTENCE_COMPLETION = 'sentence_completion', 'Sentence Completion'
        SUMMARY_COMPLETION = 'summary_completion', 'Summary / Note / Table / Flowchart Completion'
        DIAGRAM_LABEL = 'diagram_label', 'Diagram Label Completion'
        SHORT_ANSWER = 'short_answer', 'Short Answer'
        # Listening only
        FORM_COMPLETION = 'form_completion', 'Form Completion'
        MAP_LABELLING = 'map_labelling', 'Plan/Map/Diagram Labelling'
        # Writing
        WRITING_TASK_1 = 'writing_task1', 'Writing Task 1'
        WRITING_TASK_2 = 'writing_task2', 'Writing Task 2'
        # Speaking
        SPEAKING_PART_1 = 'speaking_p1', 'Speaking Part 1'
        SPEAKING_PART_2 = 'speaking_p2', 'Speaking Part 2 (Cue Card)'
        SPEAKING_PART_3 = 'speaking_p3', 'Speaking Part 3'

    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='questions')
    order = models.PositiveSmallIntegerField()
    type = models.CharField(max_length=32, choices=Type.choices)
    points = models.PositiveSmallIntegerField(default=1)

    # Schema depends on type — see PART 3 for payload/answer_key contract per type
    payload = models.JSONField(default=dict)
    answer_key = models.JSONField(default=dict)

    class Meta:
        ordering = ['section', 'order']
        unique_together = [('section', 'order')]
        indexes = [models.Index(fields=['type'])]
```

## 1.2 Migration

```bash
cd backend
python manage.py makemigrations tests
python manage.py migrate
```

If migrating from existing `Test` / `Question` models, **write a data migration** that:
1. Sets every existing test's `status` to `'published'` (preserve current behavior).
2. Wraps existing question content into the new `payload` / `answer_key` JSONB shape.
3. Creates a `PassageBank` row from any embedded reading passage and links the section.

Do not break existing student attempts or results.

---

# PART 2 — QUESTION PAYLOAD CONTRACTS (CRITICAL)

For every IELTS question type, both the admin form AND the student renderer must agree on the JSON shape. Implement these as TypeScript types AND Pydantic-style DRF serializer validators.

## 2.1 True/False/Not Given & Yes/No/Not Given

```json
// payload
{ "statement": "The author believes the experiment was successful." }

// answer_key
{ "answer": "TRUE" }   // one of: TRUE, FALSE, NOT_GIVEN
                       // (or YES, NO, NOT_GIVEN for Y/N/NG)
```

## 2.2 Multiple Choice (single)

```json
// payload
{
  "stem": "What is the main idea of paragraph C?",
  "options": [
    { "id": "A", "text": "Bees navigate by sunlight" },
    { "id": "B", "text": "Bees use pheromones" },
    { "id": "C", "text": "Bees follow scent trails" },
    { "id": "D", "text": "Bees rely on landmarks" }
  ]
}
// answer_key
{ "answer": "B" }
```

## 2.3 Multiple Choice (multiple)

```json
// payload
{ "stem": "...", "options": [...], "select_count": 2 }
// answer_key
{ "answers": ["A", "C"] }   // unordered set; both required
```

## 2.4 Matching Headings ⭐ (CURRENTLY MISSING — must work)

The passage has paragraphs A, B, C, D, E (marked with `data-para` attribute in `PassageBank.body_html`). Admin defines a list of candidate headings (typically 8–10 numbered i, ii, iii, ...). Student drags or selects a heading per paragraph.

```json
// payload (one Question per matching-headings GROUP, not per paragraph)
{
  "headings": [
    { "id": "i",    "text": "The economic impact of bees" },
    { "id": "ii",   "text": "How honey is produced" },
    { "id": "iii",  "text": "Threats to bee populations" },
    { "id": "iv",   "text": "Bee communication systems" },
    { "id": "v",    "text": "Hive structure and roles" },
    { "id": "vi",   "text": "Historical use of beeswax" },
    { "id": "vii",  "text": "The decline in pollination" },
    { "id": "viii", "text": "Genetic diversity of bees" }
  ],
  "paragraphs": ["A", "B", "C", "D", "E"],
  "example": { "paragraph": "A", "heading": "iv" }   // optional shown example
}
// answer_key — one heading per paragraph
{
  "matches": {
    "B": "i",
    "C": "v",
    "D": "iii",
    "E": "vii"
  }
}
```

**Each paragraph counts as 1 point in scoring.** The Question record represents the whole group; the student attempt stores `{B: "i", C: "v", ...}` and we score per paragraph.

## 2.5 Matching Information / Features / Sentence Endings

Similar shape: a list of items and a list of options; `answer_key.matches` maps item → option.

```json
// Matching Information example
{
  "items": [
    { "id": 1, "text": "a description of the queen bee's role" },
    { "id": 2, "text": "a comparison between species" }
  ],
  "options": [
    { "id": "A", "text": "Paragraph A" },
    { "id": "B", "text": "Paragraph B" },
    { "id": "C", "text": "Paragraph C" }
  ],
  "options_can_repeat": true
}
```

## 2.6 Sentence / Summary / Note / Table / Flow-chart Completion

Use a **template string** with numbered blanks `{{1}}`, `{{2}}`. Optional word_limit per blank.

```json
// payload
{
  "template": "The first beehive was discovered in {{1}} during the {{2}} century.",
  "word_limit": 2,
  "case_sensitive": false
}
// answer_key — array of accepted answers per blank
{
  "blanks": [
    ["Spain", "Spanish caves"],     // blank 1 — any of these accepted
    ["19th", "nineteenth"]          // blank 2
  ]
}
```

For Summary/Note/Table/Flow-chart, store the template as HTML with `<input data-blank="1">` placeholders.

## 2.7 Diagram Label / Map / Plan Labelling

```json
// payload
{
  "image_url": "/media/diagrams/bee_anatomy.png",
  "labels": [
    { "id": 1, "x": 120, "y": 80 },     // pixel coordinates of pin on image
    { "id": 2, "x": 240, "y": 150 }
  ],
  "options": [
    { "id": "A", "text": "thorax" },
    { "id": "B", "text": "abdomen" },
    { "id": "C", "text": "antenna" }
  ]
}
// answer_key
{ "matches": { "1": "C", "2": "A" } }
```

## 2.8 Short Answer

```json
// payload
{ "stem": "What does the author claim is the primary cause of CCD?", "word_limit": 3 }
// answer_key
{ "answers": ["pesticides", "neonicotinoids", "neonicotinoid pesticides"] }
```

## 2.9 Form Completion (Listening)

Same shape as Sentence Completion, but rendered as an HTML form-style layout.

## 2.10 Writing Task 1 / Task 2

```json
// payload
{
  "prompt": "The chart below shows...",
  "min_words": 150,                      // 150 for T1, 250 for T2
  "time_minutes": 20,
  "image_url": "/media/writing/task1/chart_2026.png"   // T1 only
}
// answer_key — empty for AI/teacher grading
{}
```

## 2.11 Speaking Parts

```json
// Part 1
{ "questions": ["Where are you from?", "Do you work or study?", "..."] }

// Part 2 (cue card)
{
  "topic": "Describe a memorable journey you took",
  "bullets": [
    "Where you went",
    "Who you went with",
    "What you did",
    "And explain why it was memorable"
  ],
  "prep_seconds": 60,
  "talk_seconds": 120
}

// Part 3
{ "questions": ["How has travel changed in your country?", "..."] }
```

---

# PART 3 — BACKEND ENDPOINTS

All under `/api/v1/admin/`. Permission class: `IsCenterAdmin OR IsSuperAdmin`. Tenant scoping is automatic via middleware that attaches `request.organization`.

## 3.1 Tests CRUD + lifecycle

```
GET    /api/v1/admin/tests/                  ?status=draft|published|archived&type=...&q=...
POST   /api/v1/admin/tests/                  Create new draft (returns id)
GET    /api/v1/admin/tests/<uuid>/           Full test with sections & questions
PATCH  /api/v1/admin/tests/<uuid>/           Partial update (used by autosave)
DELETE /api/v1/admin/tests/<uuid>/           Soft delete

POST   /api/v1/admin/tests/<uuid>/publish/   Run validators, set status=published
POST   /api/v1/admin/tests/<uuid>/clone/     Deep clone, returns new draft id
POST   /api/v1/admin/tests/<uuid>/archive/   status=archived
POST   /api/v1/admin/tests/<uuid>/restore/   status=draft (from archive)
```

## 3.2 Sections

```
POST   /api/v1/admin/tests/<uuid>/sections/         Create section
GET    /api/v1/admin/sections/<id>/                  Read
PATCH  /api/v1/admin/sections/<id>/                  Update
DELETE /api/v1/admin/sections/<id>/                  Delete (cascades to questions)
POST   /api/v1/admin/sections/reorder/               Body: {test_id, ordered_ids: [..]}
```

## 3.3 Questions

```
POST   /api/v1/admin/sections/<id>/questions/        Create question (validates payload by type)
GET    /api/v1/admin/questions/<id>/                  Read
PATCH  /api/v1/admin/questions/<id>/                  Update (validates if type changes)
DELETE /api/v1/admin/questions/<id>/                  Delete
POST   /api/v1/admin/questions/reorder/               Body: {section_id, ordered_ids: [..]}
POST   /api/v1/admin/questions/bulk-create/           Body: {section_id, questions: [..]}
```

## 3.4 Banks (reusable content)

```
GET    /api/v1/admin/passages/      ?q=&tags=
POST   /api/v1/admin/passages/
GET    /api/v1/admin/passages/<id>/
PATCH  /api/v1/admin/passages/<id>/
DELETE /api/v1/admin/passages/<id>/

GET    /api/v1/admin/audios/        ?q=
POST   /api/v1/admin/audios/        multipart/form-data — file upload
GET    /api/v1/admin/audios/<id>/
PATCH  /api/v1/admin/audios/<id>/   (e.g. update section_markers)
DELETE /api/v1/admin/audios/<id>/
```

## 3.5 Validation endpoint (used by Publish button preview)

```
GET /api/v1/admin/tests/<uuid>/validate/
→ {
    "ok": false,
    "errors": [
      { "section_id": "...", "code": "MISSING_AUDIO", "message": "Listening section 1 has no audio." },
      { "question_id": "...", "code": "MISSING_ANSWER_KEY", "message": "Q14 has no correct answer." }
    ],
    "warnings": [...]
  }
```

## 3.6 Bulk Excel/JSON import

```
POST /api/v1/admin/tests/<uuid>/import/  multipart with file= (.xlsx or .json)
→ Validates structure, creates sections + questions, returns errors per row
```

Use `openpyxl` for Excel parsing. Provide a downloadable template:
```
GET /api/v1/admin/import-template.xlsx
```

## 3.7 Serializer rules — CRITICAL

The `TestDetailSerializer` must:
- Nest sections (ordered) and questions (ordered) so the entire test loads in **one request**.
- Return `payload` and `answer_key` as native JSON (not strings).
- Include `validation` summary inline: `{ ok: bool, error_count: int }`.
- Be writable via `PATCH` for autosave (partial updates, no required fields except `id`).

---

# PART 4 — VALIDATORS (`apps/tests/validators.py`)

Run before publish. Return list of errors; if non-empty, refuse publish with HTTP 400.

```python
def validate_test_for_publish(test):
    errors = []

    if not test.title.strip():
        errors.append({'code': 'MISSING_TITLE', 'message': 'Test must have a title.'})

    if not test.sections.exists():
        errors.append({'code': 'NO_SECTIONS', 'message': 'Test has no sections.'})

    for section in test.sections.all():
        # Listening must have audio
        if section.kind == 'listening' and not section.audio:
            errors.append({'section_id': section.id, 'code': 'MISSING_AUDIO',
                           'message': f'Listening section {section.order} has no audio.'})

        # Reading must have passage
        if section.kind == 'reading' and not section.passage:
            errors.append({'section_id': section.id, 'code': 'MISSING_PASSAGE',
                           'message': f'Reading section {section.order} has no passage.'})

        # Writing Task 1 must have image (Academic only)
        if section.kind == 'writing':
            for q in section.questions.filter(type='writing_task1'):
                if not q.payload.get('image_url') and test.module == 'academic':
                    errors.append({'question_id': q.id, 'code': 'MISSING_TASK1_IMAGE',
                                   'message': 'Academic Writing Task 1 needs a chart/graph image.'})

        # Each question must have an answer_key (except writing/speaking which are graded)
        for q in section.questions.all():
            if q.type in ('writing_task1', 'writing_task2', 'speaking_p1', 'speaking_p2', 'speaking_p3'):
                continue
            if not q.answer_key:
                errors.append({'question_id': q.id, 'code': 'MISSING_ANSWER_KEY',
                               'message': f'Q{q.order} has no answer key.'})

    # Per-type payload schema validation
    for section in test.sections.all():
        for q in section.questions.all():
            err = validate_question_payload(q)
            if err:
                errors.append(err)

    if errors:
        raise PublishValidationError(errors)
```

`validate_question_payload(q)` checks the JSON shape per type using JSON Schema (`jsonschema` library) — write one schema per type matching PART 2 contracts.

---

# PART 5 — FRONTEND: ROUTES

Add to `frontend/src/App.tsx` router:

```tsx
{/* Center admin */}
<Route path="/center/tests" element={<TestsList />} />
<Route path="/center/tests/new" element={<TestWizard mode="create" />} />
<Route path="/center/tests/:id/edit" element={<TestWizard mode="edit" />} />
<Route path="/center/tests/:id/preview" element={<TestPreview />} />

{/* Banks */}
<Route path="/center/passages" element={<PassagesList />} />
<Route path="/center/passages/new" element={<PassageEditor />} />
<Route path="/center/passages/:id/edit" element={<PassageEditor />} />
<Route path="/center/audios" element={<AudiosList />} />
<Route path="/center/audios/new" element={<AudioEditor />} />

{/* SuperAdmin equivalents under /super/ — same components, scoped differently */}
```

**This fixes the 404 bug** — `/edit/tests/:id` was wrong. The correct route is `/center/tests/:id/edit`.

---

# PART 6 — FRONTEND: WIZARD UI

`frontend/src/pages/center/tests/TestWizard.tsx`

Five steps. URL-synced step (`?step=2`). Sidebar on the left shows steps + completion checkmarks. Right side: live preview iframe rendering the test exactly as a student would see it.

```
┌────────────────────────────────────────────────────────────────┐
│  ILDIZ Mock — Edit Test: Cambridge 17 Test 2                  │
├──────────────┬─────────────────────────────┬──────────────────┤
│  ① Metadata ✓│                              │                  │
│  ② Content ✓ │   STEP 3 — Questions          │   LIVE PREVIEW  │
│  ③ Questions │                              │                  │
│  ④ Answers   │   Section: Reading 1         │   [iframe of    │
│  ⑤ Publish   │   Passage: Bee navigation    │    student view] │
│              │                              │                  │
│              │   [+ Add Question]           │                  │
│              │   Q1 [TF/NG]    edit │ ⇅ │ ✕ │                  │
│              │   Q2 [Match Headings] ...    │                  │
│              │                              │                  │
│              │                              │                  │
├──────────────┴─────────────────────────────┴──────────────────┤
│ Auto-saved 4s ago     [< Back]  [Save Draft]  [Next >]        │
└────────────────────────────────────────────────────────────────┘
```

## 6.1 Auto-save hook — fixes refresh bug

`frontend/src/hooks/useAutosave.ts`:

```tsx
import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAutosaveTest(testId: string, data: any, enabled: boolean) {
  const qc = useQueryClient();
  const lastSerialized = useRef<string>('');

  const mutation = useMutation({
    mutationFn: (patch: any) => api.patch(`/admin/tests/${testId}/`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['test', testId] });
    },
  });

  useEffect(() => {
    if (!enabled || !testId) return;
    const serialized = JSON.stringify(data);
    if (serialized === lastSerialized.current) return;
    const t = setTimeout(() => {
      mutation.mutate(data);
      lastSerialized.current = serialized;
    }, 1500);  // debounce 1.5s
    return () => clearTimeout(t);
  }, [data, testId, enabled]);

  // Also save on tab close
  useEffect(() => {
    const handler = () => {
      navigator.sendBeacon(
        `/api/v1/admin/tests/${testId}/`,
        new Blob([JSON.stringify(data)], { type: 'application/json' }),
      );
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [testId, data]);

  return mutation;
}
```

The wizard wraps every step's data in this hook. **Refresh-loses-data bug is now fixed:** the server holds the latest draft state.

## 6.2 Step 1 — Metadata

Fields: title, description, type (Full/L/R/W/S radio), module (Academic/General), difficulty (1–10 slider), duration_minutes (auto-filled by type).

POST creates a draft on first save → URL becomes `/center/tests/<new-id>/edit?step=2`.

## 6.3 Step 2 — Content (Passages / Audio / Images)

For each section the test type needs (e.g. Full Test = 3 Reading passages + 4 Listening sections + 2 Writing tasks + 3 Speaking parts), present a content slot.

Each slot offers two options:
- **Pick from library** (modal showing PassageBank / AudioBank, searchable)
- **Create new** (opens an editor; saves to library on submit)

Audio editor: HTML5 `<audio>` + waveform (use `wavesurfer.js`) + section markers UI — admin clicks "Mark Section 1 here" to set timestamps stored in `audio.section_markers`.

## 6.4 Step 3 — Questions

For each Section, an accordion. Inside the accordion, list of questions with order/type/preview/edit/delete actions.

`[+ Add Question]` opens a modal:
1. Pick a type (12 IELTS types in a grid with icons + descriptions)
2. Form for that type (PART 2 contracts; one form component per type)
3. Save → POST creates Question; appears in list

**Reorder** via drag-and-drop (`@dnd-kit/sortable`); saves order via `POST /reorder/`.

### 6.4.1 Matching Headings form ⭐ (CURRENTLY MISSING — must work)

Single component `MatchingHeadingsForm.tsx`:

```
Headings (define candidate headings — typically 8 for 5 paragraphs):
  i.    [The economic impact of bees           ] [✕]
  ii.   [How honey is produced                  ] [✕]
  ...
  [+ Add heading]

Paragraphs to match:
  Paragraph B → [Select heading ▼]
  Paragraph C → [Select heading ▼]
  Paragraph D → [Select heading ▼]
  Paragraph E → [Select heading ▼]

  ☑ Show example: Paragraph A is matched to heading [iv ▼]

[Save]
```

Headings come from admin input. Paragraph IDs come from the linked `Passage.body_html` — parse it for `data-para` attributes. If the passage doesn't have paragraph markers, show a helper button "Auto-mark paragraphs A, B, C…" that wraps each `<p>` with `data-para`.

The form saves one Question with the full payload + answer_key in the shape from PART 2.4.

### 6.4.2 Other type forms

Build one component per type:
- `TFNGForm`, `YNNGForm`
- `MCQSingleForm`, `MCQMultiForm`
- `MatchingInformationForm`, `MatchingFeaturesForm`, `MatchingEndingsForm`
- `SentenceCompletionForm` (with `{{1}}` blank syntax)
- `SummaryCompletionForm` (rich-text editor with insert-blank button → puts `<input data-blank="N">`)
- `DiagramLabelForm` (image upload + click-to-add-pin)
- `ShortAnswerForm`
- `FormCompletionForm`
- `MapLabellingForm`
- `WritingTask1Form`, `WritingTask2Form`
- `SpeakingPart1Form`, `SpeakingPart2Form` (cue card builder), `SpeakingPart3Form`

All under `frontend/src/components/admin/question-forms/`.

## 6.5 Step 4 — Answer Keys Review

A read-only consolidated table of every question and its answer_key, color-coded green (filled) / red (missing). Each row links back to edit. This is the last sanity-check before publish.

## 6.6 Step 5 — Preview & Publish

- "Open Student Preview" → opens `/center/tests/:id/preview` in a new tab; renders test exactly as a student would see it (next ETAP — ETAP 23 — for the full Examy-style player; for now reuse whatever exists).
- Validation summary: green if validators pass, red list if not.
- `[Publish]` button — disabled until validators pass. Calls `POST /publish/`. On success → status badge flips to `Published`, test becomes available to assign to sessions.

---

# PART 7 — FRONTEND: TESTS LIST PAGE (replaces broken placeholder)

`frontend/src/pages/center/tests/TestsList.tsx`

Replaces the current empty page. Layout:

```
┌────────────────────────────────────────────────────────────────┐
│  Tests                                  [+ New Test]  [Import] │
│  ─────────────────────────────────────────────────────────     │
│  Filters: [Status ▼] [Type ▼] [Module ▼]  [Search...]          │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Cambridge 17 Test 2          Full · Academic · Published │  │
│  │ 40 Q · 180 min · Created 3d ago                          │  │
│  │ [Preview] [Clone] [Edit] [Archive]                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Custom Reading Practice 5    Reading · Academic · DRAFT  │  │
│  │ 13 Q · 60 min · Auto-saved 2 min ago                     │  │
│  │ [Continue editing] [Delete draft]                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

Use TanStack Query for the list, with status tabs (`?status=draft`, `?status=published`, `?status=archived`).

---

# PART 8 — STUDENT-SIDE COMPATIBILITY

Even though full Examy-style student player is ETAP 23, the new payload shapes from PART 2 must already render. Update the student test-taking page (`frontend/src/pages/student/test/...`) to:
- Read `payload` and dispatch by `type` to the matching renderer component.
- For Matching Headings: render a list of headings on the right and paragraph slots on the left, drag-and-drop or `<select>` per paragraph.
- For all other new shapes: render basic but correct UI (polish in ETAP 23).

The renderer component family lives at `frontend/src/components/test-runner/renderers/` and mirrors the question forms one-to-one (`MatchingHeadingsRenderer.tsx`, etc.).

---

# PART 9 — STATISTICS / WRITING SUBMISSIONS / ANALYTICS PLACEHOLDERS

Replace these three placeholder pages with real (minimal but functional) implementations:

## 9.1 `frontend/src/pages/superadmin/Statistics.tsx`

Show:
- Total tests (by status)
- Total attempts (last 30 days, line chart with Recharts)
- Active organizations count
- Top 10 organizations by attempt count

Endpoint: `GET /api/v1/admin/stats/overview/`

## 9.2 `frontend/src/pages/superadmin/WritingSubmissions.tsx`

List every Writing attempt awaiting grading. Filters: organization, date range, status (ungraded / graded). Click row → opens grading interface (band score 0–9 with criteria sliders, comment box). Endpoint: `GET /api/v1/admin/writing-submissions/`.

## 9.3 `frontend/src/pages/center/Analytics.tsx`

Center-scoped version of statistics: own students, own attempts, own band score distribution. Recharts pie/bar.

Endpoint: `GET /api/v1/center/stats/overview/`

---

# PART 10 — ACCEPTANCE CRITERIA

A reviewer must be able to verify all of these. Mark each one as you complete it.

## Bug fixes
- [ ] Creating a test, refreshing the page, returning to the test → **all entered data is preserved**.
- [ ] Editing a saved test, hitting Save, refreshing → **edits persist**.
- [ ] `/center/tests/:id/edit` loads (no 404). Old `/edit/tests/:id` redirects.
- [ ] All three placeholder pages (Statistics, WritingSubmissions, Analytics) render real data.

## Data model
- [ ] `Test`, `Section`, `Question`, `PassageBank`, `AudioBank` migrations applied cleanly.
- [ ] Existing tests continue to work (data migration succeeded).
- [ ] `Test.status` defaults to `draft`. `published_at` set on publish.
- [ ] `Question.payload` and `answer_key` are JSONB; per-type validators reject malformed payloads.

## Question types
- [ ] All 12+ IELTS question types listed in PART 2 are creatable from the admin UI.
- [ ] **Matching Headings works end-to-end**: admin defines headings, picks paragraphs, sets answers; student sees draggable matching UI; correct answers score.
- [ ] Diagram Label: admin uploads image, clicks to drop pin, types coord, picks correct option; student sees pinned image with dropdown per pin.
- [ ] Sentence/Summary completion `{{1}}`, `{{2}}` syntax renders as `<input>` blanks for student.
- [ ] Writing Task 1 image upload works; image displays on student side.
- [ ] Speaking Part 2 cue card displays bullets and prep/talk timers.

## Wizard / UX
- [ ] 5-step wizard with URL-synced `?step=N`.
- [ ] Auto-save fires every ≤2s of inactivity, plus on tab close (sendBeacon).
- [ ] Live preview iframe updates within 3s of edits.
- [ ] Drag-and-drop reorder works for sections AND questions.
- [ ] Clone test creates a new draft with `(Copy)` suffix and identical content.

## Banks
- [ ] PassageBank list, search, create, edit, delete pages work.
- [ ] AudioBank: upload, waveform, section markers, transcript, delete.
- [ ] One passage can be referenced by multiple Sections without duplication.

## Validation / Publish
- [ ] Publishing a test with missing answer key fails with HTTP 400 + clear error list.
- [ ] Publishing a Listening test with no audio fails.
- [ ] Publishing an Academic Writing Task 1 without an image fails.
- [ ] After publishing, status badge flips and the test appears in the student-facing assignable list.

## Multi-tenancy
- [ ] Center A's admin cannot list/read/edit Center B's tests via API (403).
- [ ] SuperAdmin can create global passages/audio (organization=null) which any center can use.

## Bulk import
- [ ] `/api/v1/admin/import-template.xlsx` downloads a working template.
- [ ] Importing a filled template creates sections + questions correctly; errors reported per row.

---

# PART 11 — TESTING

After implementation, run these manually and log results:

1. **Round-trip a 13-question Reading test**
   - Create draft → add passage → add 13 questions across 3 types (TF/NG, Matching Headings, Sentence Completion) → save answers → publish → take it as a student → submit → check scoring.

2. **Audio test**
   - Upload a 30-min .mp3 → mark 4 section boundaries → add 40 questions across the 4 sections → publish → student attempt plays audio once and shows section indicator.

3. **Refresh resilience**
   - Create test, fill 5 questions, hard-refresh browser → reopen → all 5 present.
   - Crash browser tab mid-edit → reopen → last autosave restored.

4. **Validation**
   - Try to publish a test with one missing answer_key → expect 400 + error pointing to that question.

5. **Clone**
   - Clone a 40-question test → confirm new draft has 40 questions and identical payloads.

6. **Multi-tenant**
   - Center A admin creates Test A. Log in as Center B admin. `GET /api/v1/admin/tests/<Test A id>/` → expect 403.

---

# PART 12 — DEPLOYMENT

After all acceptance criteria pass locally:

```bash
# Local — final commit
cd ildizmock
git add .
git commit -m "ETAP 22: Admin Test Creation 2.0 — all IELTS question types, wizard flow, autosave, banks, validation, bug fixes"
git push origin main

# Server
ssh ildiz@207.180.226.230
cd /home/ildiz/ildizmock   # or actual path
git stash
git pull origin main
git stash pop

# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt --break-system-packages
python manage.py migrate
python manage.py collectstatic --noinput

# Frontend
cd ../frontend
npm install
npm run build

# Restart
sudo supervisorctl restart ildizmock
sudo systemctl reload nginx

# Smoke test
curl -I https://ildiz-testing.uz/admin
sudo supervisorctl tail -f ildizmock stderr
```

---

# 🟢 MANDATORY GIT WORKFLOW (DO NOT SKIP)

Per the standing rule for all Cursor Agent work in this project, **every prompt must end with these commands actually executed**:

```bash
git add .
git commit -m "ETAP 22: Admin Test Creation 2.0 — all IELTS question types, wizard flow, autosave, banks, validation, bug fixes"
git push origin main
```

Cursor Agent: **do not stop before pushing.** Local-only changes are not acceptable.

If the working branch is not `main`, replace with the correct branch name. If a feature branch is preferred for this large change, use `feature/etap-22-admin-tests-v2` and open the PR description with the acceptance-criteria checklist from PART 10.

---

# 📌 OUT OF SCOPE FOR THIS ETAP

These are explicitly **next** etaps; do not implement them here:
- ETAP 23 — Real Computer-Delivered IELTS student player (split-pane, question palette, highlight-by-double-click, review screen, single-play audio)
- ETAP 24 — AI-Assisted question generation via Anthropic Claude API
- Proctoring (camera, screen recording)
- Click / Payme payment integration

---

# ⚙️ BUILD ORDER — RECOMMENDED

1. PART 1 — Models + migrations (1–2 hours)
2. PART 3 — Backend endpoints + serializers + permissions (4–6 hours)
3. PART 4 — Validators (1–2 hours)
4. PART 6.1 — Autosave hook (fixes refresh bug — quick win) (1 hour)
5. PART 5 — Routes (10 minutes; this fixes the 404)
6. PART 7 — Tests list page (2–3 hours)
7. PART 6.2–6.3 — Wizard steps 1–2 (2–3 hours)
8. PART 6.4 — Question forms (one type at a time; **start with Matching Headings** because it's the blocking bug) (1 day)
9. PART 6.5–6.6 — Steps 4–5 + publish flow (2–3 hours)
10. PART 8 — Student renderer compatibility (4–6 hours)
11. PART 9 — Replace placeholder pages (3–4 hours)
12. PART 10 — Acceptance criteria walkthrough
13. PART 12 — Deploy

Total: ~5–7 working days for one engineer.

---

**END OF ETAP 22 PROMPT.**
