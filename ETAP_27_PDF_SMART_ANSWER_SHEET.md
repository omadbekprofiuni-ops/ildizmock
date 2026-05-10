# ETAP 27 — PDF + SMART ANSWER SHEET (To'liq Test Tizimi)

> **Mission:** Replace the broken PDF iframe + generic input layout with a complete **PDF + Smart Answer Sheet** workflow. The admin uploads a PDF, audio (mandatory for Listening), and pastes an answer key. The system **auto-detects each question's type** from the answer pattern, renders the right input on the student side (radio for TF/NG, dropdown for Matching Headings, text for Completion, etc.), auto-grades on submit, and shows a band score.
>
> Includes:
> - Hotfix: PDF iframe → image gallery (Brave block fix), `convert_existing_pdfs` auto-runs
> - Smart Answer Key parser (no AI — pure regex)
> - Cambridge-style **Test Library** (superadmin creates, centers clone)
> - Real CD IELTS-style student player (PDF left, dynamic answer sheet right)
> - Single-shot audio player for Listening
> - Auto-grader with official Cambridge band score table
> - **Migration of existing PDF tests** to the new format

---

## 📌 PROJECT CONTEXT (READ FIRST)

**Repository:** `omadbekprofiuni-ops/ildizmock`
**Domain:** `ildiz-testing.uz`
**Server:** Contabo VPS `207.180.226.230`, user `ildiz`, Supervisor program `ildizmock`

**Stack:**
- Backend: Django 5.x + DRF, PostgreSQL, JWT auth (httpOnly cookie)
- Frontend: React 18 + Vite + TypeScript + TailwindCSS + shadcn/ui
- State: Zustand (auth) + TanStack Query (server state)
- Forms: React Hook Form + Zod
- Multi-tenant via `apps/organizations/`

**Monorepo:**
```
ildizmock/
├── backend/apps/
│   ├── accounts/
│   ├── organizations/
│   └── tests/         ← MAIN FOCUS
└── frontend/src/
    ├── pages/
    │   ├── superadmin/      ← test library
    │   ├── center/tests/    ← center admin
    │   └── student/         ← student player
    └── components/
```

**Language:** All UI text and code in **English only**.

**Standing rule:** Every prompt MUST end with `git add . && git commit -m "..." && git push origin <branch>` actually executed.

---

## 🎯 SCOPE — WHAT THIS ETAP DELIVERS

### IN SCOPE

✅ Backend models for Test, Section, Question, Attempt, TestLibrary
✅ PDF → image gallery converter (`pdf2image`, replaces broken iframe)
✅ Smart Answer Key parser — auto-detects question type from pasted answers
✅ Admin upload UI: 4 steps (PDF + Audio + Answers + Confirm)
✅ Audio mandatory for Listening (validation blocks save without it)
✅ Cambridge-style Test Library — superadmin creates global tests, any center can clone with one click
✅ Student player: PDF image gallery left, **dynamic answer sheet right**
✅ Question renderers: TF/NG, YN/NG, MCQ single/multi, Matching Headings, Completion, Short Answer
✅ Single-shot audio player (1 play only, no scrub, no replay)
✅ Auto-grading + Cambridge band score table
✅ Result screen with per-question breakdown
✅ Mobile-responsive
✅ Migration command: existing PDF tests → new Smart Answer Sheet format
✅ Bug fixes: PDF Brave block, generic input, broken audio play

### EXPLICITLY OUT OF SCOPE

❌ Diagram Label / Map Labelling questions (deferred — Cursor Agent does NOT implement these now)
❌ Highlight tool (double-click)
❌ Notes tool
❌ Teacher comment field on questions
❌ AI-assisted anything
❌ Native mobile app
❌ Practice-by-question-type
❌ Recent Actual Tests collection
❌ Excel/Word import
❌ Diagram-detection from PDF

If a feature is not on the IN SCOPE list, **don't build it**.

---

## 🏗️ ARCHITECTURE

```
   ADMIN PATH                     STUDENT PATH

   ┌──────────────┐              ┌──────────────┐
   │ Upload form  │              │ Test catalog │
   │ • PDF        │              └──────┬───────┘
   │ • Audio      │                     │
   │ • Answers    │              ┌──────▼───────┐
   └──────┬───────┘              │ Start screen │
          │                      └──────┬───────┘
   ┌──────▼───────┐                     │
   │ Backend      │              ┌──────▼───────────┐
   │ • PDF→images │              │  TEST PLAYER     │
   │ • Audio save │              │                  │
   │ • Parse keys │              │  PDF (left)      │
   │ • Detect Qs  │              │  Answer sheet    │
   └──────┬───────┘              │  (right, smart)  │
          │                      │                  │
   ┌──────▼───────┐              │  Audio (top)     │
   │ Test (draft) │              │  Timer           │
   └──────┬───────┘              └──────┬───────────┘
          │                             │
   ┌──────▼───────┐              ┌──────▼───────┐
   │ Confirm UI   │              │ Submit       │
   │ Publish      │              │ Auto-grade   │
   └──────┬───────┘              └──────┬───────┘
          │                             │
   ┌──────▼───────┐              ┌──────▼───────┐
   │ Test Library │◄─clone───────│ Result screen │
   │ (superadmin) │              │ Band score    │
   └──────────────┘              └──────────────┘
```

---

# PART 1 — DATA MODEL

If models from earlier ETAPs (22, 24, 25) exist, **reuse and extend**. Don't duplicate.

## 1.1 `apps/tests/models.py`

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


class Test(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        ARCHIVED = 'archived', 'Archived'

    class TestType(models.TextChoices):
        FULL = 'full', 'Full Test'
        LISTENING = 'listening', 'Listening'
        READING = 'reading', 'Reading'
        WRITING = 'writing', 'Writing'
        SPEAKING = 'speaking', 'Speaking'

    class Module(models.TextChoices):
        ACADEMIC = 'academic', 'Academic'
        GENERAL = 'general', 'General Training'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE,
        null=True, blank=True, related_name='tests',
        help_text="null = library test (created by superadmin, available to all centers)",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=16, choices=TestType.choices)
    module = models.CharField(max_length=16, choices=Module.choices, default=Module.ACADEMIC)
    duration_minutes = models.PositiveIntegerField(default=60)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='tests_created',
    )

    # Library / cloning
    is_library = models.BooleanField(
        default=False,
        help_text="True for tests in the global Test Library (org=null).",
    )
    cloned_from = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='clones',
    )

    # Migration tracking
    creation_method = models.CharField(
        max_length=20, default='smart_answer_sheet',
        help_text="smart_answer_sheet | manual | imported | migrated",
    )

    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['is_library', 'status']),
        ]


class Section(TimeStampedModel):
    """One test has 1+ sections. Listening always has 4."""
    class Kind(models.TextChoices):
        LISTENING = 'listening', 'Listening'
        READING = 'reading', 'Reading'
        WRITING = 'writing', 'Writing'
        SPEAKING = 'speaking', 'Speaking'

    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='sections')
    order = models.PositiveSmallIntegerField()
    kind = models.CharField(max_length=16, choices=Kind.choices)
    title = models.CharField(max_length=255, blank=True, default='')

    # ───── PDF (test paper) ─────
    pdf_file = models.FileField(upload_to='pdfs/%Y/%m/', null=True, blank=True)
    pdf_pages = models.JSONField(
        default=list, blank=True,
        help_text="List of converted PNG URLs: ['/media/pdf_pages/<id>/page_1.png', ...]",
    )
    pdf_page_count = models.PositiveIntegerField(default=0)

    # ───── Audio (Listening only — MANDATORY) ─────
    audio_file = models.FileField(upload_to='audio/%Y/%m/', null=True, blank=True)
    audio_duration_seconds = models.PositiveIntegerField(default=0)

    # ───── Question range covered by this section ─────
    question_start = models.PositiveSmallIntegerField(default=1)
    question_end = models.PositiveSmallIntegerField(default=10)

    duration_seconds = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['test', 'order']
        unique_together = [('test', 'order')]


class Question(TimeStampedModel):
    """One question. Type is auto-detected from the pasted answer."""
    class Type(models.TextChoices):
        TFNG = 'tfng', 'True/False/Not Given'
        YNNG = 'ynng', 'Yes/No/Not Given'
        MCQ_SINGLE = 'mcq_single', 'MCQ single'
        MCQ_MULTI = 'mcq_multi', 'MCQ multi'
        MATCHING_HEADINGS = 'matching_headings', 'Matching Headings'
        MATCHING_INFO = 'matching_info', 'Matching Information'
        MATCHING_FEATURES = 'matching_features', 'Matching Features'
        COMPLETION = 'completion', 'Completion (sentence/form/note/summary)'
        SHORT_ANSWER = 'short_answer', 'Short Answer'
        WRITING_TASK_1 = 'writing_task1', 'Writing Task 1'
        WRITING_TASK_2 = 'writing_task2', 'Writing Task 2'
        SPEAKING_PART = 'speaking_part', 'Speaking Part'

    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='questions')
    order = models.PositiveSmallIntegerField(help_text="Q1, Q2, ... Q40 within the test")
    type = models.CharField(max_length=32, choices=Type.choices)
    points = models.PositiveSmallIntegerField(default=1)

    # The answer key (single source of truth)
    answer_key = models.JSONField(
        default=dict,
        help_text="Shape depends on type. See PART 4 for contracts.",
    )

    # Optional metadata for renderers
    options = models.JSONField(
        default=list, blank=True,
        help_text="For MCQ: ['Option A text', 'Option B text', ...]. Auto-empty for completion.",
    )
    headings = models.JSONField(
        default=list, blank=True,
        help_text="For Matching Headings: [{'id': 'i', 'text': '...'}]. Optional.",
    )

    # Detection metadata (debug / admin display)
    detection_confidence = models.FloatField(default=1.0)
    detection_reason = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        ordering = ['section', 'order']
        unique_together = [('section', 'order')]
        indexes = [models.Index(fields=['type'])]


class Attempt(TimeStampedModel):
    class Status(models.TextChoices):
        IN_PROGRESS = 'in_progress', 'In Progress'
        SUBMITTED = 'submitted', 'Submitted'
        GRADED = 'graded', 'Graded'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='attempts')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attempts')
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.IN_PROGRESS)
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    answers = models.JSONField(
        default=dict,
        help_text="{question_id: student_answer}. Shape depends on Question.type.",
    )
    raw_score = models.PositiveSmallIntegerField(null=True, blank=True)
    band_score = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    section_band_scores = models.JSONField(default=dict)
```

## 1.2 Migration

```bash
cd backend
python manage.py makemigrations tests
python manage.py migrate
```

If existing models conflict, write a Django data migration that maps old fields to new fields. Don't drop existing data.

---

# PART 2 — PDF → IMAGE CONVERTER (HOTFIX)

This kills the Brave iframe block AND makes mobile work AND prevents PDF download.

## 2.1 Install

```bash
cd backend
pip install pdf2image --break-system-packages
echo "pdf2image==1.17.0" >> requirements.txt

# Server prerequisite (run once on Contabo):
sudo apt update
sudo apt install -y poppler-utils
```

## 2.2 Conversion utility

Create `backend/apps/tests/utils/pdf_convert.py`:

```python
"""Convert a PDF file to a list of PNG page URLs stored under MEDIA_ROOT."""
from pathlib import Path
from django.conf import settings
from pdf2image import convert_from_path


def convert_pdf_to_pages(pdf_path: str, output_subdir: str, dpi: int = 150) -> list[str]:
    """
    Returns a list of media-relative URLs:
        ['/media/pdf_pages/<subdir>/page_1.png', ...]

    `output_subdir` is relative to MEDIA_ROOT, e.g. 'pdf_pages/<section_uuid>'.
    """
    out_abs = Path(settings.MEDIA_ROOT) / output_subdir
    out_abs.mkdir(parents=True, exist_ok=True)
    images = convert_from_path(pdf_path, dpi=dpi, fmt='png')
    urls: list[str] = []
    for i, img in enumerate(images, start=1):
        filename = f'page_{i}.png'
        img.save(out_abs / filename, 'PNG', optimize=True)
        rel = f'{settings.MEDIA_URL}{output_subdir}/{filename}'.replace('//', '/')
        if not rel.startswith('/'):
            rel = '/' + rel
        urls.append(rel)
    return urls
```

## 2.3 Trigger conversion automatically on Section save

In `backend/apps/tests/signals.py` (create if missing):

```python
import uuid
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Section
from .utils.pdf_convert import convert_pdf_to_pages


@receiver(post_save, sender=Section)
def convert_section_pdf(sender, instance, created, **kwargs):
    """Convert PDF to PNG pages whenever a section's pdf_file is set/changed."""
    if not instance.pdf_file:
        return
    if instance.pdf_pages:
        return  # already converted
    pages = convert_pdf_to_pages(
        instance.pdf_file.path,
        f'pdf_pages/{instance.id or uuid.uuid4()}',
    )
    Section.objects.filter(pk=instance.pk).update(
        pdf_pages=pages,
        pdf_page_count=len(pages),
    )
```

Wire it in `backend/apps/tests/apps.py`:

```python
from django.apps import AppConfig

class TestsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.tests'

    def ready(self):
        from . import signals  # noqa: F401
```

## 2.4 Backfill management command

Create `backend/apps/tests/management/commands/convert_existing_pdfs.py`:

```python
from django.core.management.base import BaseCommand
from apps.tests.models import Section
from apps.tests.utils.pdf_convert import convert_pdf_to_pages


class Command(BaseCommand):
    help = "Convert all sections' uploaded PDFs into PNG pages (idempotent)."

    def handle(self, *args, **opts):
        qs = Section.objects.exclude(pdf_file='').exclude(pdf_file__isnull=True)
        total = qs.count()
        self.stdout.write(f'Converting {total} sections...')
        done = 0
        skipped = 0
        for s in qs:
            if s.pdf_pages and len(s.pdf_pages) > 0:
                skipped += 1
                continue
            try:
                pages = convert_pdf_to_pages(s.pdf_file.path, f'pdf_pages/{s.id}')
                s.pdf_pages = pages
                s.pdf_page_count = len(pages)
                s.save(update_fields=['pdf_pages', 'pdf_page_count'])
                done += 1
                self.stdout.write(f'  ✓ {s.id}: {len(pages)} pages')
            except Exception as e:
                self.stderr.write(f'  ✗ {s.id}: {e}')
        self.stdout.write(self.style.SUCCESS(
            f'Done. Converted: {done}, Skipped: {skipped}, Total: {total}'
        ))
```

Run after deployment:
```bash
python manage.py convert_existing_pdfs
```

---

# PART 3 — SMART ANSWER KEY PARSER

This is the core innovation. Place at `backend/apps/tests/smart_answer_sheet/parser.py`:

```python
"""
Parses pasted answer keys, auto-detects question types per answer
and per consecutive group, and produces structured Question records.

Examples:
    Input answer text:
        1. station
        2. 10:30
        3. TRUE
        4. FALSE
        5. NOT GIVEN
        6. A
        7. C
        8. iv
        9. ii

    Detected groups:
        Q1-2: completion (numeric/word)
        Q3-5: tfng (TRUE/FALSE/NOT GIVEN)
        Q6-7: mcq_single (single letters)
        Q8-9: matching_headings (roman numerals)

No AI. Pure regex + rule-based.
"""
import re
from dataclasses import dataclass, field
from collections import Counter


# ─────────────────────────────────────────────────────────────
# TYPE DETECTION
# ─────────────────────────────────────────────────────────────

TFNG_TOKENS = {"TRUE", "FALSE", "NOT GIVEN", "T", "F", "NG"}
YNNG_TOKENS_NON_OVERLAP = {"YES", "NO"}
ROMAN_NUMERALS = {"i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix",
                  "x", "xi", "xii", "xiii", "xiv", "xv"}


def detect_type_for_single_answer(raw: str) -> str:
    """Returns one of: tfng, ynng, mcq_single, mcq_multi, matching_headings,
    completion, short_answer, unknown."""
    if not raw or not raw.strip():
        return "unknown"

    a = raw.strip().upper()
    a_lower = raw.strip().lower()

    # Y/N/NG (must check before TFNG so YES isn't misread)
    if a in YNNG_TOKENS_NON_OVERLAP:
        return "ynng"

    # TF/NG
    if a in TFNG_TOKENS:
        return "tfng"

    # NOT GIVEN — could be either; keep ambiguous → caller decides via group
    if a == "NOT GIVEN" or a == "NG":
        return "tfng_or_ynng"

    # MCQ multi (A,C  or  A & C  or  A, B, C)
    if re.match(r"^[A-J](\s*[,&]\s*[A-J])+$", a):
        return "mcq_multi"

    # MCQ single
    if re.match(r"^[A-J]$", a):
        return "mcq_single"

    # Matching headings (roman numerals)
    if a_lower in ROMAN_NUMERALS:
        return "matching_headings"

    # Time / numeric / short data
    if re.match(r"^[\d.,/:\-]+$", a):
        return "completion"

    # Word/phrase up to 4 words → completion
    word_count = len(a.split())
    if word_count <= 4:
        return "completion"

    # Longer → short_answer
    return "short_answer"


def consolidate_group_type(detected_types: list[str]) -> str:
    """Given a list of per-answer types within a group, return the dominant type."""
    if not detected_types:
        return "unknown"

    # Resolve "tfng_or_ynng" by checking siblings
    has_tfng = any(t in ("tfng",) for t in detected_types)
    has_ynng = any(t in ("ynng",) for t in detected_types)
    resolved = []
    for t in detected_types:
        if t == "tfng_or_ynng":
            if has_ynng and not has_tfng:
                resolved.append("ynng")
            else:
                resolved.append("tfng")
        else:
            resolved.append(t)

    most_common, count = Counter(resolved).most_common(1)[0]
    if count >= len(resolved) * 0.7:
        return most_common
    return "mixed"


# ─────────────────────────────────────────────────────────────
# ANSWER LINE PARSER
# ─────────────────────────────────────────────────────────────

ANSWER_LINE_RE = re.compile(
    r"^\s*(\d{1,3})[\.\)\:\s\t]+(.+?)\s*$",
    re.MULTILINE,
)


def parse_answer_lines(raw_text: str) -> dict[int, str]:
    """Parses '1. station' / '1) iv' / '1: TRUE' / '1\\tA' etc."""
    out: dict[int, str] = {}
    for m in ANSWER_LINE_RE.finditer(raw_text):
        n = int(m.group(1))
        if n in out:
            continue  # ignore duplicates
        out[n] = m.group(2).strip()
    return out


# ─────────────────────────────────────────────────────────────
# GROUP DETECTION
# ─────────────────────────────────────────────────────────────

@dataclass
class QuestionInfo:
    order: int
    raw_answer: str
    qtype: str
    confidence: float
    reason: str


@dataclass
class QuestionGroup:
    start: int
    end: int
    qtype: str
    questions: list[QuestionInfo] = field(default_factory=list)


def group_questions_by_type(answers: dict[int, str]) -> list[QuestionGroup]:
    """
    Walks through answers in order. Whenever the detected type changes
    significantly, starts a new group.

    Returns list of QuestionGroup with consolidated type.
    """
    if not answers:
        return []

    sorted_nums = sorted(answers.keys())
    qinfos = []
    for n in sorted_nums:
        ans = answers[n]
        t = detect_type_for_single_answer(ans)
        qinfos.append(QuestionInfo(
            order=n, raw_answer=ans, qtype=t,
            confidence=0.95 if t not in ("unknown", "tfng_or_ynng") else 0.7,
            reason=f"detected from answer '{ans[:30]}'",
        ))

    groups: list[QuestionGroup] = []
    current = QuestionGroup(start=qinfos[0].order, end=qinfos[0].order, qtype=qinfos[0].qtype)
    current.questions.append(qinfos[0])

    for q in qinfos[1:]:
        # Combine "tfng_or_ynng" with existing tfng/ynng group seamlessly
        compatible = (
            q.qtype == current.qtype
            or (q.qtype == "tfng_or_ynng" and current.qtype in ("tfng", "ynng"))
            or (current.qtype == "tfng_or_ynng" and q.qtype in ("tfng", "ynng"))
        )
        if compatible:
            current.questions.append(q)
            current.end = q.order
        else:
            current.qtype = consolidate_group_type([qi.qtype for qi in current.questions])
            groups.append(current)
            current = QuestionGroup(start=q.order, end=q.order, qtype=q.qtype)
            current.questions.append(q)

    current.qtype = consolidate_group_type([qi.qtype for qi in current.questions])
    groups.append(current)
    return groups


# ─────────────────────────────────────────────────────────────
# PER-TYPE ANSWER KEY BUILDER
# ─────────────────────────────────────────────────────────────

def build_answer_key(qtype: str, raw_answer: str) -> dict:
    """Convert a raw answer string into structured JSON."""
    a = raw_answer.strip()
    if qtype in ("tfng", "ynng"):
        return {"answer": a.upper()}
    if qtype == "mcq_single":
        return {"answer": a.upper()}
    if qtype == "mcq_multi":
        parts = re.split(r"[,&\s]+", a.upper())
        return {"answers": [p for p in parts if p]}
    if qtype == "matching_headings":
        return {"answer": a.lower()}
    if qtype in ("completion", "short_answer"):
        # Allow alternates separated by '/' or ' OR '
        alternates = [x.strip() for x in re.split(r"\s*(?:/| OR )\s*", a) if x.strip()]
        return {"answers": alternates}
    return {"raw": a}


# ─────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────

@dataclass
class ParseResult:
    total_questions: int
    groups: list[QuestionGroup] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def parse_answer_key_text(raw_text: str) -> ParseResult:
    """Top-level: parse answer key text → ParseResult."""
    if not raw_text or not raw_text.strip():
        return ParseResult(total_questions=0, errors=["Answer key is empty"])

    answers = parse_answer_lines(raw_text)
    if not answers:
        return ParseResult(
            total_questions=0,
            errors=["No '1. answer' lines detected. Use format like '1   station' on each line."],
        )

    groups = group_questions_by_type(answers)
    result = ParseResult(total_questions=len(answers), groups=groups)

    # Sanity warnings
    nums = sorted(answers.keys())
    expected = list(range(min(nums), max(nums) + 1))
    missing = sorted(set(expected) - set(nums))
    if missing:
        result.warnings.append(f"Missing answers for questions: {missing}")

    if any(g.qtype in ("unknown", "mixed") for g in groups):
        result.warnings.append(
            "Some groups have ambiguous types — review them in the preview."
        )

    return result
```

---

# PART 4 — PAYLOAD CONTRACTS PER TYPE

For each question type, the `answer_key` field follows a fixed shape:

```python
PAYLOAD_SHAPES = {
    "tfng":              {"answer": "TRUE | FALSE | NOT GIVEN"},
    "ynng":              {"answer": "YES | NO | NOT GIVEN"},
    "mcq_single":        {"answer": "A"},
    "mcq_multi":         {"answers": ["A", "C"]},
    "matching_headings": {"answer": "iv"},
    "completion":        {"answers": ["station", "the station"]},  # alternates accepted
    "short_answer":      {"answers": ["pesticides", "neonicotinoids"]},
}
```

Student answers (in `Attempt.answers`) follow the same shape:

```python
STUDENT_ANSWER_SHAPES = {
    "tfng":              "TRUE",
    "ynng":              "YES",
    "mcq_single":        "A",
    "mcq_multi":         ["A", "C"],
    "matching_headings": "iv",
    "completion":        "station",
    "short_answer":      "pesticides",
}
```

---

# PART 5 — BACKEND ENDPOINTS

`backend/apps/tests/urls.py`:

```python
from django.urls import path
from . import views_admin, views_student, views_library

urlpatterns = [
    # Center admin
    path("admin/tests/", views_admin.TestListCreateView.as_view()),
    path("admin/tests/<uuid:pk>/", views_admin.TestDetailView.as_view()),
    path("admin/tests/<uuid:pk>/publish/", views_admin.TestPublishView.as_view()),
    path("admin/tests/<uuid:pk>/clone/", views_admin.TestCloneView.as_view()),

    # Smart answer sheet
    path("admin/answer-sheet/preview/", views_admin.AnswerSheetPreviewView.as_view()),
    path("admin/answer-sheet/create/",  views_admin.AnswerSheetCreateView.as_view()),

    # Test Library (superadmin creates, anyone reads)
    path("library/tests/", views_library.LibraryTestListView.as_view()),
    path("library/tests/<uuid:pk>/", views_library.LibraryTestDetailView.as_view()),
    path("library/tests/<uuid:pk>/clone-to-org/",
         views_library.LibraryCloneToOrgView.as_view()),

    # Student
    path("student/tests/", views_student.StudentTestListView.as_view()),
    path("student/tests/<uuid:pk>/", views_student.StudentTestDetailView.as_view()),
    path("student/tests/<uuid:pk>/start/", views_student.StartAttemptView.as_view()),
    path("student/attempts/<uuid:pk>/", views_student.AttemptDetailView.as_view()),
    path("student/attempts/<uuid:pk>/answer/", views_student.SaveAnswerView.as_view()),
    path("student/attempts/<uuid:pk>/submit/", views_student.SubmitAttemptView.as_view()),
]
```

## 5.1 Admin views — `backend/apps/tests/views_admin.py`

```python
import os
import re
import tempfile
from dataclasses import asdict
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from django.utils import timezone

from .models import Test, Section, Question
from .serializers import TestListSerializer, TestDetailSerializer
from .smart_answer_sheet.parser import parse_answer_key_text, build_answer_key


def _serialize_parse(pr) -> dict:
    return {
        "total_questions": pr.total_questions,
        "warnings": pr.warnings,
        "errors": pr.errors,
        "groups": [
            {
                "start": g.start, "end": g.end, "qtype": g.qtype,
                "questions": [
                    {
                        "order": q.order, "answer": q.raw_answer,
                        "qtype": q.qtype,
                        "confidence": q.confidence,
                        "reason": q.reason,
                    } for q in g.questions
                ],
            } for g in pr.groups
        ],
    }


def _scope(request):
    """Return the queryset scope: own org for center admins, all for superadmin."""
    org = getattr(request, "organization", None)
    if request.user.is_superuser:
        return Test.objects.filter(is_deleted=False)
    if org:
        return Test.objects.filter(is_deleted=False).filter(
            organization=org,
        )
    return Test.objects.none()


class TestListCreateView(ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TestListSerializer

    def get_queryset(self):
        qs = _scope(self.request)
        st = self.request.query_params.get("status")
        if st:
            qs = qs.filter(status=st)
        return qs.order_by("-created_at")


class TestDetailView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TestDetailSerializer

    def get_queryset(self):
        return _scope(self.request)


class AnswerSheetPreviewView(APIView):
    """Parses the pasted answer key without creating anything."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        text = request.data.get("answer_text", "")
        pr = parse_answer_key_text(text)
        return Response(_serialize_parse(pr))


class AnswerSheetCreateView(APIView):
    """
    Creates a Test + Section + Questions in one shot from the upload form.
    Multipart fields:
        title           (string)
        type            (listening | reading | full | writing | speaking)
        module          (academic | general)
        pdf_file        (file)         — required
        audio_file      (file)         — required for type='listening'
        answer_text     (string)       — required for objective tests
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        title = (request.data.get("title") or "").strip()
        ttype = request.data.get("type", "reading")
        module = request.data.get("module", "academic")

        if not title:
            return Response({"errors": ["Test title is required"]}, status=400)

        pdf_file = request.FILES.get("pdf_file")
        audio_file = request.FILES.get("audio_file")
        answer_text = request.data.get("answer_text", "")

        # Validation
        if not pdf_file:
            return Response({"errors": ["PDF file is required"]}, status=400)
        if ttype == "listening" and not audio_file:
            return Response(
                {"errors": ["Audio file is mandatory for Listening tests"]},
                status=400,
            )

        # Parse answers
        if ttype not in ("writing", "speaking"):
            pr = parse_answer_key_text(answer_text)
            if pr.errors:
                return Response({"errors": pr.errors}, status=400)
        else:
            pr = None

        # Default duration
        duration = {
            "reading": 60, "listening": 30, "writing": 60,
            "speaking": 14, "full": 180,
        }.get(ttype, 60)

        # Create Test
        test = Test.objects.create(
            organization=getattr(request, "organization", None),
            title=title, type=ttype, module=module,
            duration_minutes=duration,
            status=Test.Status.DRAFT,
            created_by=request.user,
            creation_method="smart_answer_sheet",
        )

        # Create Section (1 section in this simple flow; UI may extend later)
        section = Section.objects.create(
            test=test,
            order=1,
            kind=ttype if ttype != "full" else "reading",  # full is rare, default to reading
            title=f"{ttype.title()} Test",
            pdf_file=pdf_file,
            audio_file=audio_file if ttype == "listening" else None,
            question_start=1,
            question_end=pr.total_questions if pr else 0,
        )
        # post_save signal converts the PDF to images

        # Create Questions
        if pr:
            for g in pr.groups:
                for q in g.questions:
                    qtype_final = g.qtype if g.qtype not in ("mixed", "unknown") else q.qtype
                    if qtype_final in ("mixed", "unknown", "tfng_or_ynng"):
                        qtype_final = "completion"  # safe fallback
                    Question.objects.create(
                        section=section,
                        order=q.order,
                        type=qtype_final,
                        points=1,
                        answer_key=build_answer_key(qtype_final, q.raw_answer),
                        detection_confidence=q.confidence,
                        detection_reason=q.reason,
                    )

        return Response({
            "test_id": str(test.id),
            "warnings": pr.warnings if pr else [],
            "edit_url": f"/center/tests/{test.id}/edit",
            "preview_url": f"/center/tests/{test.id}/preview",
        }, status=201)


class TestPublishView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        test = _scope(request).get(pk=pk)
        errors = []
        if not test.sections.exists():
            errors.append("Test has no sections.")
        for s in test.sections.all():
            if not s.pdf_file:
                errors.append(f"Section {s.order}: PDF file missing.")
            if s.kind == "listening" and not s.audio_file:
                errors.append(f"Section {s.order}: audio is mandatory for Listening.")
            if test.type not in ("writing", "speaking") and not s.questions.exists():
                errors.append(f"Section {s.order}: no questions defined.")
        if errors:
            return Response({"errors": errors}, status=400)
        test.status = Test.Status.PUBLISHED
        test.published_at = timezone.now()
        test.save()
        return Response({"id": str(test.id), "status": test.status})


class TestCloneView(APIView):
    """Clone a test (e.g. from Library) into the current org as a draft."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        original = Test.objects.get(pk=pk)
        new = Test.objects.create(
            organization=getattr(request, "organization", None),
            title=f"{original.title} (Copy)",
            description=original.description,
            type=original.type, module=original.module,
            duration_minutes=original.duration_minutes,
            status=Test.Status.DRAFT,
            created_by=request.user,
            creation_method="cloned",
            cloned_from=original,
        )
        for s in original.sections.all():
            new_section = Section.objects.create(
                test=new, order=s.order, kind=s.kind, title=s.title,
                pdf_file=s.pdf_file, audio_file=s.audio_file,
                pdf_pages=s.pdf_pages, pdf_page_count=s.pdf_page_count,
                audio_duration_seconds=s.audio_duration_seconds,
                question_start=s.question_start, question_end=s.question_end,
                duration_seconds=s.duration_seconds,
            )
            for q in s.questions.all():
                Question.objects.create(
                    section=new_section, order=q.order, type=q.type,
                    points=q.points, answer_key=q.answer_key,
                    options=q.options, headings=q.headings,
                    detection_confidence=q.detection_confidence,
                    detection_reason=q.detection_reason,
                )
        return Response({"test_id": str(new.id), "edit_url": f"/center/tests/{new.id}/edit"})
```

## 5.2 Library views — `backend/apps/tests/views_library.py`

```python
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response
from .models import Test
from .serializers import TestListSerializer, TestDetailSerializer
from .views_admin import TestCloneView


class LibraryTestListView(ListAPIView):
    """All published library tests, visible to everyone authenticated."""
    permission_classes = [IsAuthenticated]
    serializer_class = TestListSerializer

    def get_queryset(self):
        return Test.objects.filter(
            is_library=True,
            status=Test.Status.PUBLISHED,
            is_deleted=False,
        ).order_by("-published_at")


class LibraryTestDetailView(RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TestDetailSerializer

    def get_queryset(self):
        return Test.objects.filter(is_library=True)


class LibraryCloneToOrgView(TestCloneView):
    """Reuses the clone logic. Same endpoint signature."""
    pass
```

## 5.3 Student views — `backend/apps/tests/views_student.py`

```python
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.generics import ListAPIView, RetrieveAPIView
from django.utils import timezone
from .models import Test, Attempt
from .serializers import (
    TestListSerializer, TestForStudentSerializer, AttemptSerializer,
)
from .grading import grade_attempt


class StudentTestListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TestListSerializer

    def get_queryset(self):
        org = getattr(self.request, "organization", None)
        qs = Test.objects.filter(status=Test.Status.PUBLISHED, is_deleted=False)
        # Students see: their own org's published tests + library tests
        from django.db.models import Q
        return qs.filter(Q(organization=org) | Q(is_library=True)).order_by("-published_at")


class StudentTestDetailView(RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TestForStudentSerializer

    def get_queryset(self):
        return Test.objects.filter(status=Test.Status.PUBLISHED)


class StartAttemptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        test = Test.objects.get(pk=pk, status=Test.Status.PUBLISHED)
        attempt = Attempt.objects.create(test=test, student=request.user)
        return Response({
            "attempt_id": str(attempt.id),
            "test": TestForStudentSerializer(test).data,
        })


class AttemptDetailView(RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = AttemptSerializer

    def get_queryset(self):
        return Attempt.objects.filter(student=self.request.user)


class SaveAnswerView(APIView):
    """Auto-save individual answers. Called on every change."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        attempt = Attempt.objects.get(pk=pk, student=request.user)
        if attempt.status != Attempt.Status.IN_PROGRESS:
            return Response({"error": "Attempt is not in progress."}, status=400)
        question_id = str(request.data.get("question_id"))
        answer = request.data.get("answer")
        attempt.answers[question_id] = answer
        attempt.save(update_fields=["answers", "updated_at"])
        return Response({"saved": True})


class SubmitAttemptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        attempt = Attempt.objects.get(pk=pk, student=request.user)
        if attempt.status != Attempt.Status.IN_PROGRESS:
            return Response({"error": "Already submitted."}, status=400)
        attempt.status = Attempt.Status.SUBMITTED
        attempt.submitted_at = timezone.now()
        attempt.save()
        summary = grade_attempt(attempt)
        return Response({
            "summary": summary,
            "result_url": f"/student/attempts/{attempt.id}/result",
        })
```

## 5.4 Serializers — `backend/apps/tests/serializers.py`

```python
from rest_framework import serializers
from .models import Test, Section, Question, Attempt


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ["id", "order", "type", "points", "answer_key",
                  "options", "headings", "detection_confidence", "detection_reason"]


class QuestionForStudentSerializer(serializers.ModelSerializer):
    """Excludes answer_key — students must NOT see correct answers."""
    class Meta:
        model = Question
        fields = ["id", "order", "type", "points", "options", "headings"]


class SectionSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    pdf_file_url = serializers.SerializerMethodField()
    audio_file_url = serializers.SerializerMethodField()

    class Meta:
        model = Section
        fields = ["id", "order", "kind", "title",
                  "pdf_file_url", "pdf_pages", "pdf_page_count",
                  "audio_file_url", "audio_duration_seconds",
                  "question_start", "question_end",
                  "duration_seconds", "questions"]

    def get_pdf_file_url(self, obj):
        return obj.pdf_file.url if obj.pdf_file else None

    def get_audio_file_url(self, obj):
        return obj.audio_file.url if obj.audio_file else None


class SectionForStudentSerializer(SectionSerializer):
    questions = QuestionForStudentSerializer(many=True, read_only=True)

    class Meta(SectionSerializer.Meta):
        # Same fields, students get questions without answer keys
        pass


class TestListSerializer(serializers.ModelSerializer):
    question_count = serializers.SerializerMethodField()

    class Meta:
        model = Test
        fields = ["id", "title", "description", "type", "module",
                  "duration_minutes", "status", "is_library",
                  "published_at", "created_at", "question_count"]

    def get_question_count(self, obj):
        return Question.objects.filter(section__test=obj).count()


class TestDetailSerializer(serializers.ModelSerializer):
    sections = SectionSerializer(many=True, read_only=True)

    class Meta:
        model = Test
        fields = ["id", "title", "description", "type", "module",
                  "duration_minutes", "status", "is_library",
                  "published_at", "creation_method", "sections"]


class TestForStudentSerializer(serializers.ModelSerializer):
    sections = SectionForStudentSerializer(many=True, read_only=True)

    class Meta:
        model = Test
        fields = ["id", "title", "type", "module",
                  "duration_minutes", "sections"]


class AttemptSerializer(serializers.ModelSerializer):
    test = TestForStudentSerializer(read_only=True)

    class Meta:
        model = Attempt
        fields = ["id", "test", "status", "started_at", "submitted_at",
                  "answers", "raw_score", "band_score", "section_band_scores"]
```

---

# PART 6 — AUTO-GRADER + BAND SCORE

`backend/apps/tests/grading.py`:

```python
"""Auto-grade objective questions and compute IELTS band scores."""
from decimal import Decimal


# Cambridge IELTS official band score conversion (Academic Reading)
BAND_TABLE_READING_ACADEMIC = [
    (39, 9.0), (37, 8.5), (35, 8.0), (33, 7.5), (30, 7.0),
    (27, 6.5), (23, 6.0), (19, 5.5), (15, 5.0), (13, 4.5),
    (10, 4.0), (8, 3.5), (6, 3.0), (4, 2.5), (0, 0.0),
]
# Listening (same band table for Academic and General)
BAND_TABLE_LISTENING = [
    (39, 9.0), (37, 8.5), (35, 8.0), (32, 7.5), (30, 7.0),
    (26, 6.5), (23, 6.0), (18, 5.5), (16, 5.0), (13, 4.5),
    (10, 4.0), (8, 3.5), (6, 3.0), (4, 2.5), (0, 0.0),
]


def raw_to_band(raw: int, kind: str) -> Decimal:
    table = BAND_TABLE_LISTENING if kind == "listening" else BAND_TABLE_READING_ACADEMIC
    for thr, band in table:
        if raw >= thr:
            return Decimal(str(band))
    return Decimal("0.0")


def normalize(s) -> str:
    if isinstance(s, list):
        return s
    return (str(s) or "").strip().lower().rstrip(".,!?;:")


def grade_question(q, student_answer):
    """Returns points earned for one question."""
    if student_answer is None or student_answer == "":
        return 0
    qtype = q.type
    key = q.answer_key

    if qtype in ("tfng", "ynng", "mcq_single", "matching_headings"):
        correct = key.get("answer", "")
        return q.points if normalize(student_answer) == normalize(correct) else 0

    if qtype == "mcq_multi":
        correct = set(normalize(x) for x in key.get("answers", []))
        student = set(normalize(x) for x in (student_answer if isinstance(student_answer, list) else [student_answer]))
        # Full credit only if all match (no partial)
        return q.points if correct == student else 0

    if qtype in ("completion", "short_answer"):
        accepted = [normalize(a) for a in key.get("answers", [])]
        return q.points if normalize(student_answer) in accepted else 0

    # Writing/speaking — manual grading
    return 0


def grade_attempt(attempt) -> dict:
    test = attempt.test
    raw = 0
    max_raw = 0
    per_section = {}

    for section in test.sections.all().order_by("order"):
        sec_raw = 0
        sec_max = 0
        for q in section.questions.all().order_by("order"):
            if q.type in ("writing_task1", "writing_task2", "speaking_part"):
                continue
            sec_max += q.points
            sec_raw += grade_question(q, attempt.answers.get(str(q.id)))
        per_section[section.kind] = {"raw": sec_raw, "max": sec_max}
        raw += sec_raw
        max_raw += sec_max

    band = {}
    if test.type == "reading":
        band["reading"] = float(raw_to_band(raw, "reading"))
        overall = band["reading"]
    elif test.type == "listening":
        band["listening"] = float(raw_to_band(raw, "listening"))
        overall = band["listening"]
    elif test.type == "full":
        bands = []
        for k in ("listening", "reading"):
            sec = per_section.get(k)
            if sec and sec["max"] > 0:
                b = float(raw_to_band(sec["raw"], k))
                band[k] = b
                bands.append(b)
        overall = round(sum(bands) / len(bands), 1) if bands else 0
    else:
        overall = 0

    attempt.raw_score = raw
    attempt.band_score = overall
    attempt.section_band_scores = band
    attempt.status = attempt.Status.GRADED
    attempt.save()

    return {
        "raw_score": raw, "max_raw": max_raw,
        "band_score": overall,
        "section_band_scores": band,
    }
```

---

# PART 7 — FRONTEND ROUTES

In `frontend/src/App.tsx`:

```tsx
<Routes>
  {/* Old broken route — redirect */}
  <Route path="/edit/tests/:id" element={<Navigate to="/center/tests/:id/edit" replace />} />

  {/* Center admin */}
  <Route path="/center/tests" element={<TestsList />} />
  <Route path="/center/tests/new" element={<TestUploader />} />
  <Route path="/center/tests/:id/edit" element={<TestUploader />} />
  <Route path="/center/library" element={<LibraryBrowser />} />

  {/* Superadmin (creates library tests; same uploader, different scope) */}
  <Route path="/super/library" element={<SuperadminLibrary />} />
  <Route path="/super/library/new" element={<TestUploader libraryMode />} />

  {/* Student */}
  <Route path="/student/tests" element={<StudentTestList />} />
  <Route path="/student/tests/:id" element={<StudentTestStart />} />
  <Route path="/student/attempts/:attemptId" element={<TestPlayer />} />
  <Route path="/student/attempts/:attemptId/result" element={<ResultScreen />} />
</Routes>
```

---

# PART 8 — ADMIN UPLOADER UI (4 Steps)

`frontend/src/pages/center/tests/TestUploader.tsx`:

```tsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { AnswerSheetPreview } from '@/components/uploader/AnswerSheetPreview';

type Mode = 'reading' | 'listening' | 'writing' | 'speaking';

export default function TestUploader({ libraryMode = false }: { libraryMode?: boolean }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<Mode>('listening');
  const [module, setModule] = useState<'academic' | 'general'>('academic');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [answerText, setAnswerText] = useState('');

  // Live preview of answer key parsing
  const debouncedAnswers = useDebouncedValue(answerText, 600);
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    if (!debouncedAnswers || type === 'writing' || type === 'speaking') {
      setPreview(null);
      return;
    }
    api.post('/admin/answer-sheet/preview/', { answer_text: debouncedAnswers })
       .then(r => setPreview(r.data));
  }, [debouncedAnswers, type]);

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    if (!pdfFile) return false;
    if (type === 'listening' && !audioFile) return false;
    if (type !== 'writing' && type !== 'speaking' && !answerText.trim()) return false;
    if (preview?.errors?.length > 0) return false;
    return true;
  }, [title, pdfFile, audioFile, type, answerText, preview]);

  const createMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('type', type);
      fd.append('module', module);
      fd.append('pdf_file', pdfFile!);
      if (audioFile) fd.append('audio_file', audioFile);
      if (answerText) fd.append('answer_text', answerText);
      if (libraryMode) fd.append('is_library', '1');
      return api.post('/admin/answer-sheet/create/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: (r: any) => navigate(r.data.edit_url),
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <button onClick={() => navigate('/center/tests')} className="text-sm text-gray-500">
          ← Back to tests
        </button>
        <h1 className="text-2xl font-bold">{libraryMode ? 'Create Library Test' : 'Create Test'}</h1>
        <div></div>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center justify-between">
        {[
          { n: 1, label: 'Test info' },
          { n: 2, label: 'Upload PDF' },
          { n: 3, label: 'Upload Audio' },
          { n: 4, label: 'Paste Answers' },
        ].map((s, i) => (
          <div key={s.n} className="flex flex-1 items-center">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              step >= s.n ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {s.n}
            </div>
            <div className="ml-2 text-sm">{s.label}</div>
            {i < 3 && <div className="mx-3 h-px flex-1 bg-gray-200" />}
          </div>
        ))}
      </div>

      {/* Step 1: Test info */}
      {step === 1 && (
        <div className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Test details</h2>

          <div>
            <label className="mb-1 block text-sm font-medium">Title</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Cambridge IELTS 17 Test 2 — Listening"
              className="w-full rounded border px-3 py-2 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Type</label>
            <div className="flex gap-2">
              {(['listening', 'reading', 'writing', 'speaking'] as Mode[]).map(t => (
                <button key={t} onClick={() => setType(t)}
                        className={`rounded-full border px-4 py-1.5 text-sm capitalize ${
                          type === t ? 'border-blue-600 bg-blue-50 text-blue-700'
                                     : 'border-gray-300 hover:bg-gray-50'
                        }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Module</label>
            <select value={module} onChange={e => setModule(e.target.value as any)}
                    className="rounded border px-3 py-2">
              <option value="academic">Academic</option>
              <option value="general">General Training</option>
            </select>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setStep(2)}
              disabled={!title.trim()}
              className="rounded-lg bg-blue-600 px-6 py-2 text-white disabled:bg-gray-300"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: PDF */}
      {step === 2 && (
        <div className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Upload PDF</h2>
          <p className="text-sm text-gray-600">
            The test paper as a PDF. Will be converted into images automatically (no Brave block, mobile-friendly).
          </p>

          <input
            type="file" accept=".pdf"
            onChange={e => setPdfFile(e.target.files?.[0] || null)}
            className="block w-full text-sm"
          />
          {pdfFile && (
            <div className="rounded border bg-gray-50 p-3 text-sm">
              📄 {pdfFile.name} — {(pdfFile.size / 1024 / 1024).toFixed(1)} MB
            </div>
          )}

          <div className="flex justify-between pt-4">
            <button onClick={() => setStep(1)} className="rounded border px-4 py-2 text-sm hover:bg-gray-50">
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!pdfFile}
              className="rounded-lg bg-blue-600 px-6 py-2 text-white disabled:bg-gray-300"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Audio (mandatory for Listening) */}
      {step === 3 && (
        <div className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">
            Upload Audio
            {type === 'listening' && <span className="ml-2 text-sm font-normal text-red-600">(required)</span>}
            {type !== 'listening' && <span className="ml-2 text-sm font-normal text-gray-500">(skip for {type})</span>}
          </h2>

          {type === 'listening' ? (
            <>
              <p className="text-sm text-gray-600">
                Listening tests must include an audio file. It will play <strong>once only</strong> (no scrub, no replay) — matching real CD IELTS rules.
              </p>
              <input
                type="file" accept="audio/*"
                onChange={e => setAudioFile(e.target.files?.[0] || null)}
                className="block w-full text-sm"
              />
              {audioFile && (
                <div className="rounded border bg-gray-50 p-3 text-sm">
                  🔊 {audioFile.name} — {(audioFile.size / 1024 / 1024).toFixed(1)} MB
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500 italic">
              No audio needed for {type} tests. Click Next.
            </p>
          )}

          <div className="flex justify-between pt-4">
            <button onClick={() => setStep(2)} className="rounded border px-4 py-2 text-sm hover:bg-gray-50">
              ← Back
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={type === 'listening' && !audioFile}
              className="rounded-lg bg-blue-600 px-6 py-2 text-white disabled:bg-gray-300"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Answer key */}
      {step === 4 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Paste Answer Key</h2>
            <p className="text-sm text-gray-600">
              One answer per line. The system auto-detects question types from the answer pattern.
            </p>

            <textarea
              value={answerText}
              onChange={e => setAnswerText(e.target.value)}
              rows={20} spellCheck={false}
              placeholder={
                "1. station\n2. 10:30\n3. TRUE\n4. FALSE\n5. NOT GIVEN\n6. A\n7. C\n8. iv\n9. ii\n..."
              }
              className="w-full rounded-lg border border-gray-300 bg-white p-3 font-mono text-sm focus:border-blue-500 focus:outline-none"
            />

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(3)} className="rounded border px-4 py-2 text-sm hover:bg-gray-50">
                ← Back
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!canSubmit || createMutation.isPending}
                className="rounded-lg bg-blue-600 px-6 py-2 text-white disabled:bg-gray-300"
              >
                {createMutation.isPending ? 'Creating…' : '✓ Create Test'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border bg-gray-50 p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Live Preview
            </h3>
            <AnswerSheetPreview preview={preview} />
          </div>
        </div>
      )}
    </div>
  );
}
```

`frontend/src/components/uploader/AnswerSheetPreview.tsx`:

```tsx
const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  tfng:              { label: 'True/False/Not Given', color: 'bg-blue-100 text-blue-700' },
  ynng:              { label: 'Yes/No/Not Given',     color: 'bg-purple-100 text-purple-700' },
  mcq_single:        { label: 'MCQ (single)',         color: 'bg-green-100 text-green-700' },
  mcq_multi:         { label: 'MCQ (multi)',          color: 'bg-emerald-100 text-emerald-700' },
  matching_headings: { label: 'Matching Headings',    color: 'bg-amber-100 text-amber-700' },
  completion:        { label: 'Completion',           color: 'bg-rose-100 text-rose-700' },
  short_answer:      { label: 'Short Answer',         color: 'bg-pink-100 text-pink-700' },
};

export function AnswerSheetPreview({ preview }: { preview: any }) {
  if (!preview) {
    return <div className="text-sm text-gray-400">Preview will appear as you paste answers.</div>;
  }
  if (preview.errors?.length) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        {preview.errors.map((e: string, i: number) => <p key={i}>⚠️ {e}</p>)}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="text-sm">
        <strong>{preview.total_questions}</strong> questions detected in <strong>{preview.groups?.length}</strong> groups.
      </div>

      {preview.warnings?.map((w: string, i: number) => (
        <p key={i} className="text-xs text-yellow-800">⚠️ {w}</p>
      ))}

      <div className="space-y-2">
        {preview.groups.map((g: any, i: number) => {
          const meta = TYPE_LABELS[g.qtype] || { label: g.qtype, color: 'bg-gray-100 text-gray-700' };
          return (
            <div key={i} className="rounded border bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Q{g.start}–Q{g.end}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
                  {meta.label}
                </span>
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {g.questions.map((q: any) => (
                    <tr key={q.order} className="border-t">
                      <td className="py-1 pr-2 text-gray-500">Q{q.order}</td>
                      <td className="py-1 font-mono">{q.answer}</td>
                      <td className={`py-1 text-right text-xs ${
                        q.confidence > 0.9 ? 'text-green-600' :
                        q.confidence > 0.7 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {Math.round(q.confidence * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

`frontend/src/hooks/useDebouncedValue.ts` (if missing):

```tsx
import { useEffect, useState } from 'react';
export function useDebouncedValue<T>(v: T, ms: number): T {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}
```

---

# PART 9 — TEST LIBRARY UI

`frontend/src/pages/center/LibraryBrowser.tsx`:

```tsx
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

export default function LibraryBrowser() {
  const navigate = useNavigate();
  const { data: tests } = useQuery({
    queryKey: ['library-tests'],
    queryFn: () => api.get('/library/tests/').then(r => r.data.results || r.data),
  });

  const cloneMutation = useMutation({
    mutationFn: (id: string) => api.post(`/library/tests/${id}/clone-to-org/`),
    onSuccess: (r: any) => navigate(r.data.edit_url),
  });

  if (!tests) return <div className="p-8">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-2 text-2xl font-bold">Test Library</h1>
      <p className="mb-6 text-sm text-gray-600">
        Browse pre-built tests created by ILDIZ. Click <strong>Use this test</strong> to clone one into your center as a draft.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {tests.map((t: any) => (
          <div key={t.id} className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {t.type}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                {t.module}
              </span>
            </div>
            <h2 className="font-semibold">{t.title}</h2>
            <p className="mt-1 text-sm text-gray-600">
              {t.duration_minutes} min · {t.question_count} questions
            </p>
            <button
              onClick={() => cloneMutation.mutate(t.id)}
              disabled={cloneMutation.isPending}
              className="mt-4 w-full rounded-lg border-2 border-blue-600 bg-white px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:bg-gray-100"
            >
              {cloneMutation.isPending ? 'Cloning…' : 'Use this test →'}
            </button>
          </div>
        ))}
      </div>

      {tests.length === 0 && (
        <div className="rounded-xl border bg-gray-50 p-12 text-center text-gray-500">
          No library tests yet. Superadmin will add them soon.
        </div>
      )}
    </div>
  );
}
```

Add a link in the center sidebar:
```tsx
<NavLink to="/center/library">📚 Test Library</NavLink>
```

---

# PART 10 — STUDENT TEST PLAYER

`frontend/src/pages/student/TestPlayer.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Timer } from '@/components/test-player/Timer';
import { PdfPagesViewer } from '@/components/test-player/PdfPagesViewer';
import { SingleShotAudioPlayer } from '@/components/test-player/SingleShotAudioPlayer';
import { DynamicAnswerSheet } from '@/components/test-player/DynamicAnswerSheet';
import { ReviewScreen } from '@/components/test-player/ReviewScreen';

export default function TestPlayer() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [showReview, setShowReview] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const { data: attempt } = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => api.get(`/student/attempts/${attemptId}/`).then(r => r.data),
  });

  useEffect(() => {
    if (attempt?.answers) setAnswers(attempt.answers);
  }, [attempt]);

  const saveAnswer = useMutation({
    mutationFn: ({ qid, ans }: { qid: string; ans: any }) =>
      api.post(`/student/attempts/${attemptId}/answer/`, { question_id: qid, answer: ans }),
  });

  const submit = useMutation({
    mutationFn: () => api.post(`/student/attempts/${attemptId}/submit/`),
    onSuccess: () => navigate(`/student/attempts/${attemptId}/result`),
  });

  const handleAnswer = (qid: string, ans: any) => {
    setAnswers(prev => ({ ...prev, [qid]: ans }));
    saveAnswer.mutate({ qid, ans });
  };

  if (!attempt) return <div className="p-8">Loading…</div>;
  const test = attempt.test;
  const section = test.sections[0];   // simple flow: 1 section per test
  const allQs = section.questions;
  const totalSec = test.duration_minutes * 60;

  if (showReview) {
    return (
      <ReviewScreen
        questions={allQs}
        answers={answers}
        onBack={() => setShowReview(false)}
        onSubmit={() => submit.mutate()}
        submitting={submit.isPending}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">{test.title}</h1>
          <p className="text-xs text-gray-500">
            {test.type} · {test.module} · {allQs.length} questions
          </p>
        </div>
        <Timer
          totalSeconds={totalSec}
          startedAt={attempt.started_at}
          onExpire={() => submit.mutate()}
        />
      </header>

      {/* Audio (Listening only) */}
      {section.kind === 'listening' && section.audio_file_url && (
        <div className="border-b bg-white p-3">
          <SingleShotAudioPlayer src={section.audio_file_url} />
        </div>
      )}

      {/* Body — split */}
      <main className="flex flex-1 overflow-hidden">
        {/* PDF on the left (60%) */}
        <div className="w-3/5 overflow-hidden border-r">
          <PdfPagesViewer pages={section.pdf_pages || []} />
        </div>

        {/* Dynamic answer sheet on the right (40%) */}
        <div className="w-2/5 overflow-auto bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Your Answers</h2>
          <DynamicAnswerSheet
            questions={allQs}
            answers={answers}
            onAnswer={handleAnswer}
          />
          <button
            onClick={() => setShowReview(true)}
            className="mt-6 w-full rounded-lg bg-orange-600 px-4 py-3 font-medium text-white hover:bg-orange-700"
          >
            Review &amp; Submit →
          </button>
        </div>
      </main>
    </div>
  );
}
```

## 10.1 PdfPagesViewer

`frontend/src/components/test-player/PdfPagesViewer.tsx`:

```tsx
import { useState, useRef, useEffect } from 'react';

export function PdfPagesViewer({ pages }: { pages: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [activePage, setActivePage] = useState(1);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const obs = new IntersectionObserver(entries => {
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) {
        const idx = Number((visible.target as HTMLElement).dataset.page);
        if (idx) setActivePage(idx);
      }
    }, { root: c, threshold: [0.3, 0.5, 0.7] });
    c.querySelectorAll('[data-page]').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [pages]);

  if (!pages || pages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        No content available for this section.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b bg-white px-3 py-2 text-sm">
        <span className="text-gray-600">Page {activePage} of {pages.length}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
                  className="rounded border px-2 py-1 hover:bg-gray-50">−</button>
          <span className="w-12 text-center text-gray-600">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, z + 0.1))}
                  className="rounded border px-2 py-1 hover:bg-gray-50">+</button>
          <button onClick={() => setZoom(1)}
                  className="rounded border px-2 py-1 hover:bg-gray-50">Reset</button>
        </div>
      </div>
      <div ref={ref} className="flex-1 overflow-auto bg-gray-100 p-4">
        <div className="mx-auto flex flex-col items-center gap-4">
          {pages.map((src, i) => (
            <img
              key={src} data-page={i + 1} src={src} alt={`Page ${i + 1}`}
              draggable={false}
              onContextMenu={e => e.preventDefault()}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
                userSelect: 'none',
              }}
              className="max-w-full bg-white shadow"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

## 10.2 SingleShotAudioPlayer

`frontend/src/components/test-player/SingleShotAudioPlayer.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react';

export function SingleShotAudioPlayer({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const a = ref.current; if (!a) return;
    const onMeta = () => setDuration(a.duration);
    const onTime = () => setElapsed(a.currentTime);
    const onEnd = () => setEnded(true);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
    };
  }, []);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-white px-4 py-3 shadow-sm">
      <audio ref={ref} src={src} preload="auto" />
      {!started && !ended && (
        <button onClick={() => { ref.current?.play(); setStarted(true); }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
          ▶ Start audio
        </button>
      )}
      {started && (
        <>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full bg-blue-600 transition-all"
                 style={{ width: duration ? `${(elapsed / duration) * 100}%` : '0%' }} />
          </div>
          <span className="font-mono text-sm tabular-nums">
            {fmt(elapsed)} / {fmt(duration)}
          </span>
          {ended && <span className="text-sm font-medium text-gray-500">Audio finished</span>}
        </>
      )}
    </div>
  );
}
```

## 10.3 Timer

`frontend/src/components/test-player/Timer.tsx`:

```tsx
import { useState, useEffect } from 'react';

export function Timer({ totalSeconds, startedAt, onExpire }: {
  totalSeconds: number; startedAt: string; onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState(totalSeconds);
  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const left = Math.max(0, totalSeconds - elapsed);
      setRemaining(left);
      if (left === 0) onExpire();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [totalSeconds, startedAt, onExpire]);
  const m = Math.floor(remaining / 60);
  const s = (remaining % 60).toString().padStart(2, '0');
  return (
    <div className={`flex items-center gap-2 rounded-lg px-4 py-2 ${
      remaining < 300 ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-700'
    }`}>
      <span>⏱</span>
      <span className="font-mono text-2xl font-bold tabular-nums">{m}:{s}</span>
    </div>
  );
}
```

## 10.4 DynamicAnswerSheet — the heart of the new UX

`frontend/src/components/test-player/DynamicAnswerSheet.tsx`:

```tsx
import { TFNGRenderer } from './renderers/TFNGRenderer';
import { YNNGRenderer } from './renderers/YNNGRenderer';
import { MCQSingleRenderer } from './renderers/MCQSingleRenderer';
import { MCQMultiRenderer } from './renderers/MCQMultiRenderer';
import { MatchingHeadingsRenderer } from './renderers/MatchingHeadingsRenderer';
import { CompletionRenderer } from './renderers/CompletionRenderer';
import { ShortAnswerRenderer } from './renderers/ShortAnswerRenderer';

export function DynamicAnswerSheet({ questions, answers, onAnswer }: any) {
  // Group consecutive questions of the same type
  const groups: { type: string; qs: any[] }[] = [];
  for (const q of questions) {
    const last = groups[groups.length - 1];
    if (last && last.type === q.type) {
      last.qs.push(q);
    } else {
      groups.push({ type: q.type, qs: [q] });
    }
  }

  return (
    <div className="space-y-6">
      {groups.map((g, i) => (
        <div key={i}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            {labelFor(g.type)} (Q{g.qs[0].order}–Q{g.qs[g.qs.length - 1].order})
          </div>
          <div className="space-y-3">
            {g.qs.map(q => renderQ({ q, answer: answers[q.id], onAnswer }))}
          </div>
        </div>
      ))}
    </div>
  );
}

function labelFor(t: string): string {
  return ({
    tfng: 'True / False / Not Given',
    ynng: 'Yes / No / Not Given',
    mcq_single: 'Multiple Choice',
    mcq_multi: 'Multiple Choice (multiple)',
    matching_headings: 'Matching Headings',
    completion: 'Completion',
    short_answer: 'Short Answer',
  } as any)[t] || t;
}

function renderQ({ q, answer, onAnswer }: any) {
  const props = { question: q, answer, onAnswer };
  switch (q.type) {
    case 'tfng':              return <TFNGRenderer key={q.id} {...props} />;
    case 'ynng':              return <YNNGRenderer key={q.id} {...props} />;
    case 'mcq_single':        return <MCQSingleRenderer key={q.id} {...props} />;
    case 'mcq_multi':         return <MCQMultiRenderer key={q.id} {...props} />;
    case 'matching_headings': return <MatchingHeadingsRenderer key={q.id} {...props} />;
    case 'completion':        return <CompletionRenderer key={q.id} {...props} />;
    case 'short_answer':      return <ShortAnswerRenderer key={q.id} {...props} />;
    default: return (
      <pre key={q.id} className="text-xs text-gray-500">Unsupported: {q.type}</pre>
    );
  }
}
```

## 10.5 Renderers

`frontend/src/components/test-player/renderers/TFNGRenderer.tsx`:

```tsx
export function TFNGRenderer({ question, answer, onAnswer }: any) {
  const opts = ['TRUE', 'FALSE', 'NOT GIVEN'];
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 text-right font-medium text-gray-500">{question.order}.</span>
      <div className="flex flex-1 gap-2">
        {opts.map(v => (
          <button key={v}
                  onClick={() => onAnswer(question.id, v)}
                  className={`flex-1 rounded border px-2 py-1.5 text-xs font-medium ${
                    answer === v ? 'border-blue-600 bg-blue-50 text-blue-700'
                                 : 'border-gray-300 bg-white hover:bg-gray-50'
                  }`}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
```

`YNNGRenderer.tsx` — same structure, options `['YES', 'NO', 'NOT GIVEN']`.

`MCQSingleRenderer.tsx`:

```tsx
export function MCQSingleRenderer({ question, answer, onAnswer }: any) {
  const opts = (question.options && question.options.length) ? question.options : ['A', 'B', 'C', 'D'];
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 text-right font-medium text-gray-500">{question.order}.</span>
      <div className="flex flex-1 gap-2">
        {opts.map((opt: any, idx: number) => {
          const id = typeof opt === 'string' ? opt : (opt.id || String.fromCharCode(65 + idx));
          return (
            <button key={id}
                    onClick={() => onAnswer(question.id, id)}
                    className={`h-9 w-9 rounded-full border text-sm font-bold ${
                      answer === id ? 'border-blue-600 bg-blue-600 text-white'
                                    : 'border-gray-300 bg-white hover:bg-gray-50'
                    }`}>
              {id}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

`MCQMultiRenderer.tsx`:

```tsx
export function MCQMultiRenderer({ question, answer, onAnswer }: any) {
  const selected: string[] = answer ?? [];
  const opts = (question.options && question.options.length) ? question.options : ['A', 'B', 'C', 'D', 'E'];
  const toggle = (id: string) => {
    onAnswer(
      question.id,
      selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id],
    );
  };
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 text-right font-medium text-gray-500">{question.order}.</span>
      <div className="flex flex-1 flex-wrap gap-2">
        {opts.map((opt: any, idx: number) => {
          const id = typeof opt === 'string' ? opt : (opt.id || String.fromCharCode(65 + idx));
          const isOn = selected.includes(id);
          return (
            <button key={id}
                    onClick={() => toggle(id)}
                    className={`h-9 w-9 rounded border text-sm font-bold ${
                      isOn ? 'border-emerald-600 bg-emerald-600 text-white'
                           : 'border-gray-300 bg-white hover:bg-gray-50'
                    }`}>
              {id}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

`MatchingHeadingsRenderer.tsx`:

```tsx
const ROMANS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];

export function MatchingHeadingsRenderer({ question, answer, onAnswer }: any) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 text-right font-medium text-gray-500">{question.order}.</span>
      <select value={answer || ''}
              onChange={e => onAnswer(question.id, e.target.value)}
              className="flex-1 rounded border px-3 py-1.5 text-sm">
        <option value="">— select heading —</option>
        {ROMANS.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
    </div>
  );
}
```

`CompletionRenderer.tsx`:

```tsx
export function CompletionRenderer({ question, answer, onAnswer }: any) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 text-right font-medium text-gray-500">{question.order}.</span>
      <input value={answer ?? ''}
             onChange={e => onAnswer(question.id, e.target.value)}
             placeholder="Type your answer"
             className="flex-1 rounded border px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none" />
    </div>
  );
}
```

`ShortAnswerRenderer.tsx` — same as Completion.

## 10.6 ReviewScreen

`frontend/src/components/test-player/ReviewScreen.tsx`:

```tsx
export function ReviewScreen({ questions, answers, onBack, onSubmit, submitting }: any) {
  const unanswered = questions.filter((q: any) => {
    const a = answers[q.id];
    return a === undefined || a === '' || (Array.isArray(a) && a.length === 0);
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold">Review your answers</h1>
      <p className="text-gray-600">
        Total: {questions.length} ·
        Answered: {questions.length - unanswered.length} ·
        Unanswered: <span className="font-bold text-red-600">{unanswered.length}</span>
      </p>

      <div className="mt-6 grid grid-cols-10 gap-2">
        {questions.map((q: any) => {
          const ans = answers[q.id];
          const answered = ans !== undefined && ans !== '' && !(Array.isArray(ans) && ans.length === 0);
          return (
            <div key={q.id}
                 className={`rounded p-2 text-center text-xs font-medium ${
                   answered ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                 }`}>
              {q.order}
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex gap-3">
        <button onClick={onBack} className="rounded border px-4 py-2 text-sm hover:bg-gray-50">
          ← Back to test
        </button>
        <button onClick={onSubmit} disabled={submitting}
                className="rounded-lg bg-blue-600 px-6 py-2 text-white disabled:bg-gray-300">
          {submitting ? 'Submitting…' : 'Submit final answers'}
        </button>
      </div>
    </div>
  );
}
```

---

# PART 11 — RESULT SCREEN

`frontend/src/pages/student/ResultScreen.tsx`:

```tsx
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function ResultScreen() {
  const { attemptId } = useParams();
  const { data: attempt } = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => api.get(`/student/attempts/${attemptId}/`).then(r => r.data),
  });
  if (!attempt) return <div className="p-8">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
        <p className="text-sm uppercase tracking-wider text-gray-500">{attempt.test.title}</p>
        <h1 className="mt-2 text-6xl font-bold text-blue-600">{attempt.band_score ?? '—'}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Raw score: {attempt.raw_score ?? 0}
        </p>
      </div>

      {attempt.section_band_scores && Object.keys(attempt.section_band_scores).length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Object.entries(attempt.section_band_scores).map(([k, v]: any) => (
            <div key={k} className="rounded-lg border bg-white p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-gray-500">{k}</p>
              <p className="mt-1 text-2xl font-bold">{v}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-3 font-medium">Per-question review</h2>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left">#</th>
              <th className="text-left">Type</th>
              <th className="text-left">Your answer</th>
              <th className="text-left">Correct</th>
              <th className="text-right">Result</th>
            </tr>
          </thead>
          <tbody>
            {attempt.test.sections.flatMap((s: any) =>
              s.questions.map((q: any) => {
                const yours = attempt.answers[q.id];
                return (
                  <tr key={q.id} className="border-t">
                    <td className="py-2">{q.order}</td>
                    <td className="font-mono text-xs">{q.type}</td>
                    <td className="text-gray-700">{JSON.stringify(yours) || '—'}</td>
                    <td className="text-gray-500">—</td>
                    <td className="text-right">—</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex gap-3">
        <Link to="/student/tests" className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
          ← Back to tests
        </Link>
      </div>
    </div>
  );
}
```

---

# PART 12 — STUDENT CATALOG + START PAGE

`frontend/src/pages/student/StudentTestList.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function StudentTestList() {
  const { data: tests } = useQuery({
    queryKey: ['student-tests'],
    queryFn: () => api.get('/student/tests/').then(r => r.data.results || r.data),
  });
  if (!tests) return <div className="p-8">Loading…</div>;
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold">Available tests</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {tests.map((t: any) => (
          <Link key={t.id} to={`/student/tests/${t.id}`}
                className="block rounded-xl border bg-white p-5 transition hover:shadow-md">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {t.type}
              </span>
              {t.is_library && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Library
                </span>
              )}
            </div>
            <h2 className="font-semibold">{t.title}</h2>
            <p className="mt-1 text-sm text-gray-600">
              {t.duration_minutes} min · {t.question_count} questions
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

`StudentTestStart.tsx`:

```tsx
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function StudentTestStart() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: test } = useQuery({
    queryKey: ['student-test', id],
    queryFn: () => api.get(`/student/tests/${id}/`).then(r => r.data),
  });
  const start = useMutation({
    mutationFn: () => api.post(`/student/tests/${id}/start/`),
    onSuccess: (r: any) => navigate(`/student/attempts/${r.data.attempt_id}`),
  });
  if (!test) return <div className="p-8">Loading…</div>;
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold">{test.title}</h1>
      <p className="mt-2 text-gray-600">{test.type} · {test.module}</p>
      <ul className="mt-6 list-disc space-y-1 pl-5 text-sm text-gray-700">
        <li>Duration: {test.duration_minutes} minutes</li>
        <li>Sections: {test.sections.length}</li>
        <li>You cannot pause once you start.</li>
        {test.type === 'listening' && (
          <li className="font-medium text-red-700">
            Audio plays once only — test your speakers first.
          </li>
        )}
      </ul>
      <button onClick={() => start.mutate()}
              className="mt-8 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white">
        Start test now
      </button>
    </div>
  );
}
```

---

# PART 13 — MIGRATION OF EXISTING PDF TESTS

For tests already in the DB (e.g. the `ghjk` Listening test from your screenshot) — port them to the new format.

`backend/apps/tests/management/commands/migrate_old_pdf_tests.py`:

```python
"""
Migration: convert pre-ETAP-27 tests to the new Smart Answer Sheet format.

For each existing Section that has a pdf_file:
  1. Convert PDF to images if not already done.
  2. If old generic 'Question' rows exist (without proper type), inspect
     their answer_key and re-detect type using the smart parser.
  3. Mark the parent Test.creation_method = 'migrated'.
"""
from django.core.management.base import BaseCommand
from apps.tests.models import Test, Section, Question
from apps.tests.utils.pdf_convert import convert_pdf_to_pages
from apps.tests.smart_answer_sheet.parser import (
    detect_type_for_single_answer, build_answer_key,
)


class Command(BaseCommand):
    help = "Migrate legacy PDF tests to new format (idempotent)."

    def handle(self, *args, **opts):
        sections = Section.objects.exclude(pdf_file='').exclude(pdf_file__isnull=True)
        total = sections.count()
        self.stdout.write(f"Migrating {total} sections...")

        for s in sections:
            # 1. PDF → images
            if not s.pdf_pages:
                try:
                    pages = convert_pdf_to_pages(s.pdf_file.path, f'pdf_pages/{s.id}')
                    s.pdf_pages = pages
                    s.pdf_page_count = len(pages)
                    s.save(update_fields=['pdf_pages', 'pdf_page_count'])
                    self.stdout.write(f"  ✓ Converted PDF for section {s.id}")
                except Exception as e:
                    self.stderr.write(f"  ✗ PDF convert failed for {s.id}: {e}")

            # 2. Re-detect question types from existing answer keys
            for q in s.questions.all():
                ak = q.answer_key or {}
                # Try to extract a raw answer string
                raw_answer = (
                    ak.get("answer")
                    or (ak.get("answers", [None])[0] if ak.get("answers") else None)
                    or ak.get("raw")
                )
                if not raw_answer:
                    continue
                detected = detect_type_for_single_answer(str(raw_answer))
                if detected in ("unknown", "tfng_or_ynng"):
                    detected = q.type or "completion"
                if detected != q.type:
                    q.type = detected
                    q.answer_key = build_answer_key(detected, str(raw_answer))
                    q.save(update_fields=['type', 'answer_key'])

            # 3. Mark parent test
            test = s.test
            if test.creation_method != 'migrated':
                test.creation_method = 'migrated'
                test.save(update_fields=['creation_method'])

        self.stdout.write(self.style.SUCCESS("Migration done."))
```

Run after deployment:
```bash
python manage.py migrate_old_pdf_tests
```

---

# PART 14 — VERIFICATION CHECKLIST

After build, manually verify each item:

## Bug fixes
- [ ] Open the URL that previously showed "Blocked by Brave" → now renders PDF as image gallery, no Brave block
- [ ] Listening test now shows the single-shot audio player at the top (was missing before)
- [ ] Generic "Your answer" inputs are gone — instead, each question shows the right input type
- [ ] `/edit/tests/:id` redirects to `/center/tests/:id/edit` (no 404)

## Admin uploader
- [ ] Visit `/center/tests/new` → 4-step wizard renders
- [ ] Step 1: title + type + module
- [ ] Step 2: PDF upload (file selector, shows file size)
- [ ] Step 3: Audio mandatory for Listening, optional for others
- [ ] Step 4: Paste answer key → live preview shows detected groups
- [ ] Sample paste from PART 15 produces correct group detection
- [ ] "Create Test" button creates Test+Section+Questions in DB
- [ ] Created test appears in `/center/tests` with status=draft
- [ ] PDF gets converted to images automatically (signal fires)

## Test Library
- [ ] Visit `/center/library` → list of library tests (or empty state)
- [ ] Superadmin creates a library test from `/super/library/new`
- [ ] Center admin clicks "Use this test" → creates a clone in their org as draft
- [ ] Cloned test has same content but new id, status=draft

## Student player
- [ ] Visit `/student/tests` → published tests visible (own org + library)
- [ ] Click test → start screen with duration + warning about audio
- [ ] Click Start → `/student/attempts/<id>` opens
- [ ] PDF shows as image gallery on the left (zoom controls work)
- [ ] Listening test: audio player at top, single-shot only, can't pause/scrub/replay
- [ ] Right side shows dynamic answer sheet
- [ ] TF/NG questions render as 3 buttons (TRUE / FALSE / NOT GIVEN)
- [ ] MCQ single renders as A B C D buttons
- [ ] MCQ multi renders as multi-select buttons
- [ ] Matching Headings renders as dropdown (i, ii, iii, ...)
- [ ] Completion renders as text input
- [ ] Each answer auto-saves to backend (verify in network tab)
- [ ] Click "Review & Submit" → review screen with answered/unanswered counts
- [ ] Submit → result page with band score

## Auto-grading
- [ ] Listening with all 40 correct → band 9.0
- [ ] Listening with 30 correct → band 7.0
- [ ] Reading with 30 correct → band 7.0
- [ ] Wrong MCQ multi (only 1 of 2 correct) → 0 points (no partial credit, IELTS rule)
- [ ] Completion accepts alternate answers (separated by `/` or ` OR `)

## Migration
- [ ] Run `python manage.py migrate_old_pdf_tests`
- [ ] Existing `ghjk` test now has correctly-typed questions instead of generic
- [ ] Existing PDFs converted to images

---

# PART 15 — SAMPLE TEST DATA FOR TESTING

Test the Smart Answer Sheet parser by pasting this answer key:

```
1. station
2. 10:30
3. Joan
4. 27
5. silver
6. café
7. briefcase
8. 2500
9. FALSE
10. TRUE
11. NOT GIVEN
12. A
13. C
14. B
15. A,C
16. iv
17. ii
18. vii
19. iii
20. v
```

Expected detection:
- Q1–Q8: `completion` (mix of words and numbers)
- Q9–Q11: `tfng` (TRUE/FALSE/NOT GIVEN)
- Q12–Q14: `mcq_single` (single letters)
- Q15: `mcq_multi` (A,C — comma)
- Q16–Q20: `matching_headings` (roman numerals)

5 groups detected, all with confidence > 0.9.

---

# PART 16 — DEPLOYMENT

```bash
# Local
cd ildizmock
git add .
git commit -m "ETAP 27: PDF + Smart Answer Sheet — auto question type detection, dynamic answer sheet, single-shot audio, library, migration"
git push origin main

# Server prep
ssh ildiz@207.180.226.230
sudo apt update
sudo apt install -y poppler-utils    # one-time

# Deploy
cd /home/ildiz/ildizmock
git stash
git pull origin main
git stash pop

cd backend
source venv/bin/activate
pip install -r requirements.txt --break-system-packages
python manage.py migrate
python manage.py collectstatic --noinput

# CRITICAL — run these one-time data migrations
python manage.py convert_existing_pdfs
python manage.py migrate_old_pdf_tests

# Frontend
cd ../frontend
npm install
npm run build

# Restart
sudo supervisorctl restart ildizmock
sudo systemctl reload nginx

# Smoke test
curl -I https://ildiz-testing.uz/center/tests/new
curl -I https://ildiz-testing.uz/student/tests
sudo supervisorctl tail -f ildizmock stderr
```

---

# 🟢 MANDATORY GIT WORKFLOW

```bash
git add .
git commit -m "ETAP 27: PDF + Smart Answer Sheet — auto question type detection, dynamic answer sheet, single-shot audio, library, migration"
git push origin main
```

Cursor Agent: **do not stop before pushing**. Local-only changes are not acceptable.

If on a feature branch (`feature/etap-27-pdf-smart-answer-sheet`), push that and open a PR titled **"ETAP 27 — PDF + Smart Answer Sheet"** with the verification checklist from PART 14 in the description.

---

# ⚙️ BUILD ORDER (recommended)

| # | Task | Hours |
|---|------|------:|
| 1 | Models + migration (PART 1) | 0.5 |
| 2 | PDF converter + signal + backfill command (PART 2) | 1.5 |
| 3 | Smart Answer Sheet parser (PART 3) | 3 |
| 4 | Auto-grader + band table (PART 6) | 1 |
| 5 | Backend admin views (PART 5.1) | 2 |
| 6 | Backend library views (PART 5.2) | 0.5 |
| 7 | Backend student views (PART 5.3) | 1.5 |
| 8 | Serializers (PART 5.4) | 0.5 |
| 9 | Frontend routes + redirects (PART 7) | 0.3 |
| 10 | TestUploader UI (4 steps) (PART 8) | 4 |
| 11 | AnswerSheetPreview live component (PART 8) | 1 |
| 12 | Library Browser (PART 9) | 1 |
| 13 | TestPlayer shell + layout (PART 10) | 2 |
| 14 | PdfPagesViewer (PART 10.1) | 1 |
| 15 | SingleShotAudioPlayer (PART 10.2) | 0.5 |
| 16 | Timer (PART 10.3) | 0.3 |
| 17 | DynamicAnswerSheet + 7 renderers (PART 10.4-10.5) | 4 |
| 18 | ReviewScreen (PART 10.6) | 0.5 |
| 19 | ResultScreen (PART 11) | 1 |
| 20 | Student catalog + start (PART 12) | 0.7 |
| 21 | Migration command (PART 13) | 1 |
| 22 | Verification (PART 14) | 2 |
| 23 | Deploy (PART 16) | 0.5 |

**Total: ~30 hours = 4 working days for one engineer.**

---

# 📌 OUT OF SCOPE — DO NOT BUILD

- ❌ Diagram label / Map labelling questions (deferred)
- ❌ Highlight tool / Notes tool
- ❌ Teacher comment field on questions
- ❌ AI-assisted anything
- ❌ Excel/Word import
- ❌ Native mobile app
- ❌ Practice-by-question-type
- ❌ Recent Actual Tests collection

If a request looks like one of these, **don't implement it** — it's planned for a later ETAP.

---

After this ETAP ships:
- The `ghjk` test from your screenshot will work correctly (PDF as images, audio plays, dynamic answer sheet)
- New tests can be created in **5–8 minutes** by uploading PDF + Audio + pasting answer key
- The system **auto-detects** question types — admin doesn't manually choose
- Students see a **real CD IELTS-style interface**
- Auto-grading produces accurate band scores
- Centers can clone library tests with one click
- All existing PDF tests are migrated automatically

---

**END OF ETAP 27.**
