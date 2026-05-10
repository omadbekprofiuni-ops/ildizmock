# ETAP 25 — MOCK TEST CORE (Mukammal Test Platformasi)

> **Mission:** Build the complete end-to-end mock test experience and **stop there**. No multi-tenant features added, no billing, no analytics dashboards — those exist already or come later. Just the **core mock test loop**:
>
> 1. Admin pastes a Cambridge-style test into 3 textareas → test exists in 5–8 minutes
> 2. Student opens the test → sees a real CD IELTS interface (split-pane, question palette, single-play audio, timer)
> 3. Student submits → auto-graded objective questions → instant band score
>
> Everything else is out of scope for this ETAP. The platform's mock-test functionality must be **production-quality and indistinguishable from examy.me / IELTS Online Tests on the test-taking screen**.

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
    │   ├── center/tests/   ← admin
    │   └── student/        ← student
    ├── components/
    └── hooks/
```

**Language:** All UI text and code in **English only**.

**Standing rule:** Every prompt MUST end with `git add . && git commit -m "..." && git push origin <branch>` actually executed.

---

## 🎯 SCOPE — WHAT THIS ETAP DELIVERS

### IN SCOPE (must work end-to-end)

✅ Backend data model with all 14 IELTS question types (incl. Matching Headings)
✅ Smart Paste test creator — 3 textareas, parses Cambridge-style content automatically
✅ Auto-save on admin edit (refresh-safe)
✅ Real CD IELTS test player for **all 4 skills** (Reading, Listening, Writing, Speaking)
✅ Question palette at the bottom (1–40 with status)
✅ Single-play audio for Listening (no pause, no scrub, no replay)
✅ Word counter for Writing
✅ Microphone recording for Speaking
✅ Review screen before submit
✅ Auto-grading for objective questions (everything except Writing & Speaking)
✅ Result screen with band score + per-question breakdown
✅ Mobile-responsive (Reading and Listening must work on phones)
✅ Bug fixes: PDF Brave block, `/edit/tests/:id` 404, refresh data loss

### EXPLICITLY OUT OF SCOPE (defer to future ETAPs)

❌ Highlight tool (double-click to mark text)
❌ Notes tool (personal notes during test)
❌ Excel template import
❌ Word .docx import
❌ Practice-by-question-type
❌ Recent Actual Tests collection
❌ Vocabulary builder
❌ Daily streak / question of the day
❌ AI-assisted Writing/Speaking grading
❌ Native mobile app
❌ Multi-tenant billing changes
❌ Center-side analytics dashboards (placeholder is acceptable)

When in doubt: **if it's not on the IN SCOPE list above, don't build it.**

---

## 🏗️ ARCHITECTURE

```
┌────────────────────────────────────────────────────────┐
│                       FLOW                              │
└────────────────────────────────────────────────────────┘

  ADMIN PATH                          STUDENT PATH
  ──────────                          ────────────

  /center/tests/new                   /student/tests
       │                                   │
       ▼                                   ▼
  Smart Paste UI                      Test catalog
  (3 textareas)                            │
       │                                   ▼
       ▼                              Click test
  Backend parser                           │
  (detector + builder)                     ▼
       │                              /student/tests/:id/start
       ▼                              (instructions, audio test)
  Test (status=draft)                      │
       │                                   ▼
       ▼                              /student/attempts/:id
  Live preview                        REAL CD IELTS PLAYER
       │                                   │
       ▼                                   ▼
  Publish                             Submit → review screen
  (status=published)                       │
                                           ▼
                                      Auto-grader (Reading/Listening)
                                           │
                                           ▼
                                      Result screen with band score
```

---

# PART 1 — BACKEND DATA MODEL

If models from earlier ETAPs already exist, only add what's missing. Otherwise create from scratch.

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
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE,
                                     null=True, blank=True, related_name='tests')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=16, choices=TestType.choices)
    module = models.CharField(max_length=16, choices=Module.choices, default=Module.ACADEMIC)
    duration_minutes = models.PositiveIntegerField(default=60)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True,
                                    related_name='tests_created')
    creation_method = models.CharField(max_length=20, default='smart_paste')


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
    # Reading content — stored inline for simplicity (no PassageBank in this ETAP)
    passage_html = models.TextField(blank=True)
    # Listening content
    audio_file = models.FileField(upload_to='audio/%Y/%m/', null=True, blank=True)
    transcript = models.TextField(blank=True)
    # Writing content
    image = models.ImageField(upload_to='writing/%Y/%m/', null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(default=0)


class Question(TimeStampedModel):
    class Type(models.TextChoices):
        TFNG = 'tfng', 'True/False/Not Given'
        YNNG = 'ynng', 'Yes/No/Not Given'
        MCQ_SINGLE = 'mcq_single', 'MCQ single'
        MCQ_MULTI = 'mcq_multi', 'MCQ multi'
        MATCHING_HEADINGS = 'matching_headings', 'Matching Headings'
        MATCHING_INFO = 'matching_info', 'Matching Information'
        MATCHING_FEATURES = 'matching_features', 'Matching Features'
        MATCHING_ENDINGS = 'matching_endings', 'Matching Sentence Endings'
        SENTENCE_COMPLETION = 'sentence_completion', 'Sentence Completion'
        SUMMARY_COMPLETION = 'summary_completion', 'Summary/Note/Table/Flowchart'
        DIAGRAM_LABEL = 'diagram_label', 'Diagram Label'
        SHORT_ANSWER = 'short_answer', 'Short Answer'
        FORM_COMPLETION = 'form_completion', 'Form Completion'
        MAP_LABELLING = 'map_labelling', 'Map/Plan Labelling'
        WRITING_TASK_1 = 'writing_task1', 'Writing Task 1'
        WRITING_TASK_2 = 'writing_task2', 'Writing Task 2'
        SPEAKING_P1 = 'speaking_p1', 'Speaking Part 1'
        SPEAKING_P2 = 'speaking_p2', 'Speaking Part 2'
        SPEAKING_P3 = 'speaking_p3', 'Speaking Part 3'

    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='questions')
    order = models.PositiveSmallIntegerField()
    type = models.CharField(max_length=32, choices=Type.choices)
    points = models.PositiveSmallIntegerField(default=1)
    payload = models.JSONField(default=dict)        # question content
    answer_key = models.JSONField(default=dict)     # correct answers


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
    answers = models.JSONField(default=dict)        # {question_id: answer}
    raw_score = models.PositiveSmallIntegerField(null=True, blank=True)
    band_score = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    section_band_scores = models.JSONField(default=dict)
    # Recordings for Speaking (uploaded separately)
    speaking_recordings = models.JSONField(default=dict)  # {question_id: file_url}


class WritingSubmission(TimeStampedModel):
    """Manual grading by teachers."""
    attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name='writing_submissions')
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    text = models.TextField()
    word_count = models.PositiveIntegerField(default=0)
    band_score = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    teacher_comment = models.TextField(blank=True)
    graded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='graded_writings')
    graded_at = models.DateTimeField(null=True, blank=True)
```

```bash
cd backend
python manage.py makemigrations tests
python manage.py migrate
```

---

# PART 2 — QUESTION TYPE PAYLOAD CONTRACTS

For each question type, define the JSON shape. **Both the admin parser and the student renderer must agree on this shape.**

Place this in `backend/apps/tests/payload_schemas.py` as documentation + JSON Schema validators:

```python
# Each entry: {qtype: {payload_schema, answer_key_schema}}

PAYLOAD_SHAPES = {
    "tfng": {
        "payload": {"statement": "string"},
        "answer_key": {"answer": "TRUE|FALSE|NOT GIVEN"},
    },
    "ynng": {
        "payload": {"statement": "string"},
        "answer_key": {"answer": "YES|NO|NOT GIVEN"},
    },
    "mcq_single": {
        "payload": {"stem": "string", "options": [{"id": "A", "text": "..."}]},
        "answer_key": {"answer": "A"},
    },
    "mcq_multi": {
        "payload": {"stem": "...", "options": [...], "select_count": 2},
        "answer_key": {"answers": ["A", "C"]},
    },
    "matching_headings": {
        # ONE Question per group covers all paragraphs
        "payload": {
            "headings": [{"id": "i", "text": "..."}, ...],
            "paragraphs": ["B", "C", "D", "E"],
            "example": {"paragraph": "A", "heading": "iv"},  # optional
        },
        "answer_key": {"matches": {"B": "i", "C": "v", ...}},
    },
    "matching_info": {
        "payload": {
            "items": [{"id": 1, "text": "..."}, ...],
            "options": [{"id": "A", "text": "Paragraph A"}, ...],
            "options_can_repeat": True,
        },
        "answer_key": {"matches": {"1": "A", "2": "C", ...}},
    },
    "matching_features": {
        "payload": {
            "items": [{"id": 1, "text": "..."}, ...],
            "options": [{"id": "A", "text": "..."}, ...],
            "options_can_repeat": False,
        },
        "answer_key": {"matches": {"1": "A", ...}},
    },
    "matching_endings": {
        "payload": {
            "starts": [{"id": 1, "text": "Bees use scent..."}, ...],
            "endings": [{"id": "A", "text": "...to navigate."}, ...],
        },
        "answer_key": {"matches": {"1": "A", ...}},
    },
    "sentence_completion": {
        "payload": {"template": "Bees were first studied in {{1}}.", "word_limit": 2},
        "answer_key": {"blanks": [["Spain", "Andalusia"]]},
    },
    "summary_completion": {
        "payload": {"template_html": "<p>...{{1}}...{{2}}...</p>", "word_limit": 2,
                    "from_list": False,
                    "list_options": []},   # if from_list=True, choose from these
        "answer_key": {"blanks": [["Spain"], ["19th"]]},
    },
    "diagram_label": {
        "payload": {
            "image_url": "/media/...",
            "labels": [{"id": 1, "x": 120, "y": 80}, ...],
            "options": [{"id": "A", "text": "thorax"}, ...],
        },
        "answer_key": {"matches": {"1": "A", ...}},
    },
    "short_answer": {
        "payload": {"stem": "What...?", "word_limit": 3},
        "answer_key": {"answers": ["pesticides", "neonicotinoids"]},
    },
    "form_completion": {
        # Like sentence_completion but rendered as form-style layout
        "payload": {"template_html": "<table>...</table>", "word_limit": 2},
        "answer_key": {"blanks": [["..."], ["..."]]},
    },
    "map_labelling": {
        "payload": {
            "image_url": "/media/...",
            "labels": [{"id": 1, "x": 100, "y": 200}, ...],
            "options": [{"id": "A", "text": "library"}, ...],
        },
        "answer_key": {"matches": {"1": "A", ...}},
    },
    "writing_task1": {
        "payload": {"prompt": "...", "min_words": 150, "time_minutes": 20,
                    "image_url": "/media/..."},
        "answer_key": {},
    },
    "writing_task2": {
        "payload": {"prompt": "...", "min_words": 250, "time_minutes": 40},
        "answer_key": {},
    },
    "speaking_p1": {
        "payload": {"questions": ["Where are you from?", ...]},
        "answer_key": {},
    },
    "speaking_p2": {
        "payload": {
            "topic": "Describe a memorable journey",
            "bullets": ["where you went", "who you went with", ...],
            "prep_seconds": 60, "talk_seconds": 120,
        },
        "answer_key": {},
    },
    "speaking_p3": {
        "payload": {"questions": ["How has travel changed?", ...]},
        "answer_key": {},
    },
}
```

---

# PART 3 — SMART PASTE PARSER

The parser turns 3 textareas into structured `Test → Section → Question` data.

## 3.1 Detector — `backend/apps/tests/smart_paste/detector.py`

```python
"""Detect IELTS question type from instruction text + answer pattern."""
import re
from dataclasses import dataclass


@dataclass
class DetectionResult:
    qtype: str
    confidence: float
    reason: str
    needs_confirm: bool = False


# Standardized IELTS instruction phrases — ordered most → least specific
INSTRUCTION_PATTERNS = [
    (r"choose the most suitable heading", "matching_headings"),
    (r"list of headings", "matching_headings"),
    (r"do the following statements agree with the (claims|views|opinions) of the writer", "ynng"),
    (r"do the following statements agree with the information", "tfng"),
    (r"choose (TWO|THREE|FOUR|2|3|4) letters", "mcq_multi"),
    (r"choose THE correct letter,? [A-Z],?\s*[A-Z]", "mcq_single"),
    (r"which paragraph contains", "matching_info"),
    (r"in which (section|paragraph)", "matching_info"),
    (r"complete each sentence with the correct ending", "matching_endings"),
    (r"complete the sentences? below", "sentence_completion"),
    (r"complete the summary below", "summary_completion"),
    (r"complete the (notes|table|flow.?chart) below", "summary_completion"),
    (r"complete the form below", "form_completion"),
    (r"label the diagram", "diagram_label"),
    (r"label the (map|plan)", "map_labelling"),
    (r"answer the questions below", "short_answer"),
    (r"write at least 150 words", "writing_task1"),
    (r"write at least 250 words", "writing_task2"),
    (r"match each .{1,40} with .{1,40}", "matching_features"),
]


TFNG_TOKENS = {"TRUE", "FALSE", "NOT GIVEN", "T", "F", "NG"}
YNNG_TOKENS = {"YES", "NO", "NOT GIVEN", "Y", "N", "NG"}
ROMAN_NUMERALS = {"i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"}


def _all(answers: list[str], pred) -> bool:
    return bool(answers) and all(pred(a.strip()) for a in answers if a.strip())


def detect_from_answers(answers: list[str]) -> DetectionResult | None:
    if not answers:
        return None
    cleaned = [a.strip() for a in answers if a and a.strip()]
    if not cleaned:
        return None

    if _all(cleaned, lambda a: a.upper() in YNNG_TOKENS) and any(a.upper() in {"YES", "NO"} for a in cleaned):
        return DetectionResult("ynng", 0.95, "answers contain YES/NO/NOT GIVEN")
    if _all(cleaned, lambda a: a.upper() in TFNG_TOKENS):
        return DetectionResult("tfng", 0.95, "answers contain TRUE/FALSE/NOT GIVEN")
    if _all(cleaned, lambda a: a.lower() in ROMAN_NUMERALS):
        return DetectionResult("matching_headings", 0.95, "roman numerals (i, ii, iii…)")
    if _all(cleaned, lambda a: bool(re.match(r"^[A-J](\s*[,&]\s*[A-J])+$", a.upper()))):
        return DetectionResult("mcq_multi", 0.9, "multiple letters")
    if _all(cleaned, lambda a: bool(re.match(r"^[A-J]$", a.upper()))):
        return DetectionResult("mcq_single", 0.5,
                               "single letters — may be Matching Info/Features",
                               needs_confirm=True)
    if _all(cleaned, lambda a: bool(re.match(r"^[\d.,/:]+$", a))):
        return DetectionResult("sentence_completion", 0.7, "numeric answers")
    if _all(cleaned, lambda a: 1 <= len(a.split()) <= 3):
        return DetectionResult("sentence_completion", 0.6,
                               "short text — completion or short answer",
                               needs_confirm=True)
    return DetectionResult("short_answer", 0.5, "fallback", needs_confirm=True)


def detect_question_type(instructions: str, answers: list[str]) -> DetectionResult:
    instr = instructions or ""
    for pattern, qtype in INSTRUCTION_PATTERNS:
        if re.search(pattern, instr, re.IGNORECASE | re.DOTALL):
            ans = detect_from_answers(answers)
            if ans and ans.qtype != qtype and ans.confidence > 0.85:
                return DetectionResult(qtype, 0.65,
                                       f"instruction says {qtype}, answers say {ans.qtype} — confirm",
                                       needs_confirm=True)
            return DetectionResult(qtype, 0.95, f"matched: {pattern[:40]}")
    fallback = detect_from_answers(answers)
    return fallback or DetectionResult("unknown", 0.0, "no signals", needs_confirm=True)
```

## 3.2 Parser — `backend/apps/tests/smart_paste/parser.py`

```python
"""Parse 3 pasted blocks into ParseResult."""
import re
from dataclasses import dataclass, field
from .detector import detect_question_type, DetectionResult


@dataclass
class ParsedQuestion:
    order: int
    qtype: str
    payload: dict
    answer_key: dict
    detection: DetectionResult | None = None
    raw_text: str = ""


@dataclass
class ParsedSection:
    instructions: str
    questions: list[ParsedQuestion] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass
class ParseResult:
    passage_html: str = ""
    transcript: str = ""
    paragraphs: list[str] = field(default_factory=list)
    sections: list[ParsedSection] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def question_count(self) -> int:
        return sum(len(s.questions) for s in self.sections)


PARAGRAPH_RE = re.compile(
    r"^\s*(?:Paragraph\s+)?\[?([A-Z])\]?[\s\.\)]\s+(.+?)(?=^\s*(?:Paragraph\s+)?\[?[A-Z]\]?[\s\.\)]\s+|\Z)",
    re.MULTILINE | re.DOTALL,
)
ANSWER_LINE_RE = re.compile(r"^\s*(\d{1,3})[\.\)\:\s\t]+(.+?)\s*$", re.MULTILINE)
SECTION_HEADER_RE = re.compile(
    r"^\s*Questions?\s+(\d{1,3})\s*[\-–—to]+\s*(\d{1,3})(.*)$", re.MULTILINE)
QUESTION_LINE_RE = re.compile(r"^\s*(\d{1,3})[\.\)]\s+(.+?)$", re.MULTILINE)
OPTION_LINE_RE = re.compile(r"^\s*([A-J])[\.\)]\s+(.+?)$", re.MULTILINE)
HEADING_LINE_RE = re.compile(
    r"^\s*(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)\s+(.+?)$",
    re.MULTILINE | re.IGNORECASE)


def parse_passage(raw: str) -> tuple[str, list[str]]:
    text = raw.strip()
    if not text:
        return ("", [])
    matches = PARAGRAPH_RE.findall(text)
    if len(matches) < 2:
        # Auto-label if no markers
        chunks = [c.strip() for c in re.split(r"\n\s*\n", text) if c.strip()]
        matches = [(chr(ord("A") + i), body) for i, body in enumerate(chunks)]
    html_parts, paras = [], []
    for label, body in matches:
        body = re.sub(r"\s+", " ", body).strip()
        paras.append(label)
        html_parts.append(f'<p data-para="{label}"><strong>{label}</strong> {body}</p>')
    return ("\n".join(html_parts), paras)


def parse_answer_key(raw: str) -> dict[int, str]:
    return {int(m.group(1)): m.group(2).strip() for m in ANSWER_LINE_RE.finditer(raw)}


def split_blocks(qtext: str) -> list[tuple[int, int, str, str]]:
    headers = list(SECTION_HEADER_RE.finditer(qtext))
    if not headers:
        nums = [int(m.group(1)) for m in QUESTION_LINE_RE.finditer(qtext)]
        return [(min(nums), max(nums), "", qtext)] if nums else []
    blocks = []
    for i, h in enumerate(headers):
        start = int(h.group(1)); end = int(h.group(2))
        body_start = h.end()
        body_end = headers[i + 1].start() if i + 1 < len(headers) else len(qtext)
        body = h.group(0).strip() + "\n" + qtext[body_start:body_end].strip()
        blocks.append((start, end, h.group(0).strip(), body))
    return blocks


def build_payload(qtype: str, q_text: str, options: list[tuple[str, str]]) -> dict:
    if qtype in ("tfng", "ynng"):
        return {"statement": q_text}
    if qtype == "mcq_single":
        return {"stem": q_text, "options": [{"id": a, "text": b} for a, b in options]}
    if qtype == "mcq_multi":
        return {"stem": q_text,
                "options": [{"id": a, "text": b} for a, b in options],
                "select_count": 2}
    if qtype in ("matching_info", "matching_features", "matching_endings"):
        return {"items": [{"id": 1, "text": q_text}],
                "options": [{"id": a, "text": b} for a, b in options],
                "options_can_repeat": qtype == "matching_info"}
    if qtype in ("sentence_completion", "summary_completion", "form_completion"):
        return {"template": q_text, "word_limit": 2, "case_sensitive": False}
    if qtype == "short_answer":
        return {"stem": q_text, "word_limit": 3}
    return {"raw": q_text}


def build_answer_key(qtype: str, q_num: int, raw: str) -> dict:
    a = raw.strip()
    if qtype in ("tfng", "ynng"):
        return {"answer": a.upper()}
    if qtype == "mcq_single":
        return {"answer": a.upper()}
    if qtype == "mcq_multi":
        return {"answers": [p for p in re.split(r"[,&\s]+", a.upper()) if p]}
    if qtype in ("matching_headings", "matching_info", "matching_features", "matching_endings"):
        return {"matches": {str(q_num): a}}
    alternates = re.split(r"\s*(?:/| OR )\s*", a)
    if qtype == "short_answer":
        return {"answers": alternates}
    return {"blanks": [alternates]}


def parse_block(body: str, answer_map: dict[int, str]) -> ParsedSection:
    section = ParsedSection(instructions=body.split("\n", 1)[0])
    options = OPTION_LINE_RE.findall(body)
    headings = HEADING_LINE_RE.findall(body)
    q_matches = list(QUESTION_LINE_RE.finditer(body))
    sample_answers = [answer_map[int(m.group(1))] for m in q_matches[:3] if int(m.group(1)) in answer_map]
    block_det = detect_question_type(section.instructions, sample_answers)

    # Matching Headings — single Question per group
    if block_det.qtype == "matching_headings":
        targets = []
        for m in q_matches:
            qn = int(m.group(1))
            text = m.group(2).strip()
            para_match = re.search(r"\bParagraph\s+([A-Z])\b", text, re.IGNORECASE)
            para = para_match.group(1).upper() if para_match else None
            targets.append((qn, para))
        matches = {p: answer_map[q].strip() for q, p in targets if q in answer_map and p}
        first_q = min(t[0] for t in targets) if targets else 1
        payload = {
            "headings": [{"id": h[0].lower(), "text": h[1].strip()} for h in headings],
            "paragraphs": [t[1] for t in targets if t[1]],
        }
        section.questions.append(ParsedQuestion(
            order=first_q, qtype="matching_headings",
            payload=payload, answer_key={"matches": matches},
            detection=block_det,
        ))
        if not headings:
            section.warnings.append("Matching Headings: no roman-numeral headings list found.")
        return section

    # All other types
    for m in q_matches:
        qn = int(m.group(1))
        q_text = m.group(2).strip()
        q_text = re.sub(r"\n\s*[A-J][\.\)]\s+.+", "", q_text).strip()
        raw = answer_map.get(qn)
        if raw is None:
            section.warnings.append(f"Q{qn}: no answer in answer key")
            qtype = block_det.qtype
            akey = {}
        else:
            per_q = detect_question_type(section.instructions, [raw])
            qtype = per_q.qtype if per_q.confidence > 0.85 else block_det.qtype
            akey = build_answer_key(qtype, qn, raw)
        section.questions.append(ParsedQuestion(
            order=qn, qtype=qtype,
            payload=build_payload(qtype, q_text, options),
            answer_key=akey,
            detection=block_det,
            raw_text=q_text,
        ))
    return section


def parse_reading(passage: str, questions: str, answers: str) -> ParseResult:
    result = ParseResult()
    if not passage.strip():
        result.errors.append("Passage is empty.")
    if not questions.strip():
        result.errors.append("Questions block is empty.")
    if not answers.strip():
        result.errors.append("Answer key is empty.")
    if result.errors:
        return result

    html, paras = parse_passage(passage)
    result.passage_html = html
    result.paragraphs = paras

    answer_map = parse_answer_key(answers)
    if not answer_map:
        result.errors.append("No answers detected. Use '1   answer' lines.")
        return result

    blocks = split_blocks(questions)
    if not blocks:
        result.errors.append("No 'Questions X-Y' headers found.")
        return result

    declared = set()
    for _, _, _, body in blocks:
        sec = parse_block(body, answer_map)
        result.sections.append(sec)
        for q in sec.questions:
            declared.add(q.order)
    missing = declared - set(answer_map.keys())
    extra = set(answer_map.keys()) - declared
    if missing:
        result.warnings.append(f"Questions without answers: {sorted(missing)}")
    if extra:
        result.warnings.append(f"Extra answers (no matching question): {sorted(extra)}")
    return result


def parse_listening(transcript: str, questions: str, answers: str) -> ParseResult:
    """4 sections by question ranges 1-10, 11-20, 21-30, 31-40."""
    result = ParseResult(transcript=transcript or "")
    if not questions.strip() or not answers.strip():
        result.errors.append("Questions and answer key are required.")
        return result
    answer_map = parse_answer_key(answers)
    if not answer_map:
        result.errors.append("No answers detected.")
        return result

    blocks = split_blocks(questions)
    SEC = [(1, 10), (11, 20), (21, 30), (31, 40)]
    sections: dict[int, ParsedSection] = {
        i: ParsedSection(instructions=f"Section {i + 1}") for i in range(4)
    }
    for start, _, _, body in blocks:
        for idx, (lo, hi) in enumerate(SEC):
            if lo <= start <= hi:
                parsed = parse_block(body, answer_map)
                sections[idx].questions.extend(parsed.questions)
                sections[idx].warnings.extend(parsed.warnings)
                if parsed.instructions:
                    sections[idx].instructions = parsed.instructions
                break
    result.sections = [sections[i] for i in range(4) if sections[i].questions]
    return result


def parse_writing(t1: str, t2: str, t1_image: str = "") -> ParseResult:
    result = ParseResult()
    if t1.strip():
        sec = ParsedSection(instructions="Writing Task 1")
        sec.questions.append(ParsedQuestion(
            order=1, qtype="writing_task1",
            payload={"prompt": t1.strip(), "min_words": 150,
                     "time_minutes": 20, "image_url": t1_image},
            answer_key={},
        ))
        result.sections.append(sec)
    if t2.strip():
        sec = ParsedSection(instructions="Writing Task 2")
        sec.questions.append(ParsedQuestion(
            order=2, qtype="writing_task2",
            payload={"prompt": t2.strip(), "min_words": 250, "time_minutes": 40},
            answer_key={},
        ))
        result.sections.append(sec)
    if not result.sections:
        result.errors.append("Both Writing tasks are empty.")
    return result


CUE_BULLET_RE = re.compile(r"^\s*[\-•·]\s*(.+)$", re.MULTILINE)


def parse_speaking(p1: str, p2: str, p3: str) -> ParseResult:
    result = ParseResult()

    def extract(raw):
        out = []
        for ln in raw.splitlines():
            ln = re.sub(r"^\s*\d+[\.\)]\s*", "", ln.strip())
            ln = re.sub(r"^\s*[\-•·]\s*", "", ln)
            if ln:
                out.append(ln)
        return out

    if p1.strip():
        sec = ParsedSection(instructions="Speaking Part 1")
        sec.questions.append(ParsedQuestion(
            order=1, qtype="speaking_p1",
            payload={"questions": extract(p1)}, answer_key={},
        ))
        result.sections.append(sec)
    if p2.strip():
        lines = [l.strip() for l in p2.splitlines() if l.strip()]
        topic = lines[0] if lines else "Describe something memorable"
        bullets = CUE_BULLET_RE.findall(p2)
        sec = ParsedSection(instructions="Speaking Part 2")
        sec.questions.append(ParsedQuestion(
            order=2, qtype="speaking_p2",
            payload={"topic": topic, "bullets": bullets,
                     "prep_seconds": 60, "talk_seconds": 120},
            answer_key={},
        ))
        result.sections.append(sec)
    if p3.strip():
        sec = ParsedSection(instructions="Speaking Part 3")
        sec.questions.append(ParsedQuestion(
            order=3, qtype="speaking_p3",
            payload={"questions": extract(p3)}, answer_key={},
        ))
        result.sections.append(sec)
    if not result.sections:
        result.errors.append("All Speaking parts are empty.")
    return result
```

---

# PART 4 — AUTO-GRADER

`backend/apps/tests/grading.py`:

```python
"""Auto-grade objective questions and convert raw score → IELTS band."""
from decimal import Decimal


# Official IELTS band score conversion (Cambridge IELTS books)
BAND_TABLE_READING_ACADEMIC = [
    (39, 9.0), (37, 8.5), (35, 8.0), (33, 7.5), (30, 7.0),
    (27, 6.5), (23, 6.0), (19, 5.5), (15, 5.0), (13, 4.5),
    (10, 4.0), (8, 3.5), (6, 3.0), (4, 2.5), (0, 0.0),
]
BAND_TABLE_LISTENING = [
    (39, 9.0), (37, 8.5), (35, 8.0), (32, 7.5), (30, 7.0),
    (26, 6.5), (23, 6.0), (18, 5.5), (16, 5.0), (13, 4.5),
    (10, 4.0), (8, 3.5), (6, 3.0), (4, 2.5), (0, 0.0),
]


def raw_to_band(raw_score: int, kind: str) -> Decimal:
    table = BAND_TABLE_LISTENING if kind == "listening" else BAND_TABLE_READING_ACADEMIC
    for threshold, band in table:
        if raw_score >= threshold:
            return Decimal(str(band))
    return Decimal("0.0")


def normalize(s: str) -> str:
    return (s or "").strip().lower().rstrip(".,!?;:")


def grade_question(question, student_answer) -> int:
    """Returns points earned (0 to question.points). For Matching Headings,
    each paragraph counts as 1 point."""
    qtype = question.type
    key = question.answer_key

    if qtype in ("tfng", "ynng", "mcq_single"):
        if not student_answer:
            return 0
        return question.points if normalize(student_answer) == normalize(key.get("answer", "")) else 0

    if qtype == "mcq_multi":
        correct = set(normalize(x) for x in key.get("answers", []))
        student = set(normalize(x) for x in (student_answer or []))
        # IELTS: full credit only if all correct, no partial
        return question.points if correct == student else 0

    if qtype == "matching_headings":
        # student_answer is {"B": "i", "C": "ii", ...}; one point per correct match
        correct = key.get("matches", {})
        student = student_answer or {}
        return sum(
            1 for para, h in correct.items()
            if normalize(student.get(para, "")) == normalize(h)
        )

    if qtype in ("matching_info", "matching_features", "matching_endings"):
        correct = key.get("matches", {})
        student = student_answer or {}
        # student_answer is {"1": "A", ...}
        return sum(
            1 for k, v in correct.items()
            if normalize(student.get(str(k), "")) == normalize(v)
        )

    if qtype in ("sentence_completion", "summary_completion", "form_completion"):
        # Each blank counts as 1 point
        blanks = key.get("blanks", [])     # [["Spain", "Andalusia"], ["19th"]]
        student_blanks = student_answer or []  # ["Spain", "19th"]
        score = 0
        for i, accepted in enumerate(blanks):
            if i >= len(student_blanks):
                continue
            if any(normalize(student_blanks[i]) == normalize(a) for a in accepted):
                score += 1
        return score

    if qtype == "short_answer":
        accepted = [normalize(a) for a in key.get("answers", [])]
        return question.points if normalize(student_answer or "") in accepted else 0

    if qtype in ("diagram_label", "map_labelling"):
        correct = key.get("matches", {})
        student = student_answer or {}
        return sum(1 for k, v in correct.items() if normalize(student.get(str(k), "")) == normalize(v))

    # Writing & Speaking — manual grading
    return 0


def grade_attempt(attempt) -> dict:
    """Grades all auto-gradable questions, returns summary, persists to attempt."""
    test = attempt.test
    raw = 0
    max_raw = 0
    per_section: dict[str, dict] = {}

    for section in test.sections.all().order_by("order"):
        sec_raw = 0
        sec_max = 0
        for question in section.questions.all().order_by("order"):
            if question.type in ("writing_task1", "writing_task2",
                                 "speaking_p1", "speaking_p2", "speaking_p3"):
                continue
            # Determine question max points
            if question.type == "matching_headings":
                qmax = len(question.answer_key.get("matches", {}))
            elif question.type in ("matching_info", "matching_features",
                                   "matching_endings", "diagram_label", "map_labelling"):
                qmax = len(question.answer_key.get("matches", {}))
            elif question.type in ("sentence_completion", "summary_completion", "form_completion"):
                qmax = len(question.answer_key.get("blanks", []))
            else:
                qmax = question.points
            sec_max += qmax

            student_ans = attempt.answers.get(str(question.id))
            sec_raw += grade_question(question, student_ans)

        per_section[section.kind] = {"raw": sec_raw, "max": sec_max}
        per_section[f"section_{section.order}"] = {"raw": sec_raw, "max": sec_max}
        raw += sec_raw
        max_raw += sec_max

    # Convert to IELTS band per section
    band_per_section = {}
    overall_raw_for_band = 0
    test_kind = test.type
    if test_kind == "reading":
        band_per_section["reading"] = float(raw_to_band(raw, "reading"))
        overall_band = band_per_section["reading"]
    elif test_kind == "listening":
        band_per_section["listening"] = float(raw_to_band(raw, "listening"))
        overall_band = band_per_section["listening"]
    elif test_kind == "full":
        # Compute per skill and average (Writing/Speaking deferred to teacher)
        bands = []
        for kind in ("listening", "reading"):
            sec = per_section.get(kind)
            if sec and sec["max"] > 0:
                b = float(raw_to_band(sec["raw"], kind))
                band_per_section[kind] = b
                bands.append(b)
        overall_band = round(sum(bands) / len(bands), 1) if bands else 0
    else:
        overall_band = 0

    attempt.raw_score = raw
    attempt.band_score = overall_band
    attempt.section_band_scores = band_per_section
    attempt.status = attempt.Status.GRADED
    attempt.save()

    return {
        "raw_score": raw,
        "max_raw": max_raw,
        "band_score": overall_band,
        "section_band_scores": band_per_section,
    }
```

---

# PART 5 — BACKEND ENDPOINTS

`backend/apps/tests/urls.py`:

```python
from django.urls import path
from . import views_admin, views_student

urlpatterns = [
    # Admin
    path("admin/tests/", views_admin.TestListCreateView.as_view()),
    path("admin/tests/<uuid:pk>/", views_admin.TestDetailView.as_view()),
    path("admin/tests/<uuid:pk>/publish/", views_admin.TestPublishView.as_view()),
    path("admin/smart-paste/preview/", views_admin.SmartPastePreviewView.as_view()),
    path("admin/smart-paste/create/", views_admin.SmartPasteCreateView.as_view()),

    # Student
    path("student/tests/", views_student.StudentTestListView.as_view()),
    path("student/tests/<uuid:pk>/", views_student.StudentTestDetailView.as_view()),
    path("student/tests/<uuid:pk>/start/", views_student.StartAttemptView.as_view()),
    path("student/attempts/<uuid:pk>/", views_student.AttemptDetailView.as_view()),
    path("student/attempts/<uuid:pk>/answer/", views_student.SaveAnswerView.as_view()),
    path("student/attempts/<uuid:pk>/submit/", views_student.SubmitAttemptView.as_view()),
    path("student/attempts/<uuid:pk>/upload-recording/",
         views_student.UploadSpeakingRecordingView.as_view()),
]
```

`backend/apps/tests/views_admin.py`:

```python
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from .models import Test, Section, Question
from .serializers import TestListSerializer, TestDetailSerializer
from .smart_paste.parser import (
    parse_reading, parse_listening, parse_writing, parse_speaking,
)


def _serialize_parse(pr):
    return {
        "passage_html": pr.passage_html,
        "paragraphs": pr.paragraphs,
        "transcript": pr.transcript,
        "question_count": pr.question_count,
        "warnings": pr.warnings,
        "errors": pr.errors,
        "sections": [
            {
                "instructions": s.instructions,
                "warnings": s.warnings,
                "questions": [
                    {
                        "order": q.order, "qtype": q.qtype,
                        "payload": q.payload, "answer_key": q.answer_key,
                        "raw_text": q.raw_text,
                        "detection": (
                            {"qtype": q.detection.qtype,
                             "confidence": q.detection.confidence,
                             "reason": q.detection.reason,
                             "needs_confirm": q.detection.needs_confirm}
                            if q.detection else None
                        ),
                    } for q in s.questions
                ],
            } for s in pr.sections
        ],
    }


class TestListCreateView(ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TestListSerializer

    def get_queryset(self):
        qs = Test.objects.filter(is_deleted=False) if hasattr(Test, 'is_deleted') else Test.objects.all()
        org = getattr(self.request, "organization", None)
        if org:
            qs = qs.filter(organization=org)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        return qs.order_by("-created_at")


class TestDetailView(RetrieveUpdateDestroyAPIView):
    """PATCH supports partial updates — used by autosave."""
    permission_classes = [IsAuthenticated]
    serializer_class = TestDetailSerializer
    queryset = Test.objects.all()


class TestPublishView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        test = Test.objects.get(pk=pk)
        # Basic validation
        errors = []
        if not test.sections.exists():
            errors.append("Test has no sections.")
        for s in test.sections.all():
            if s.kind == "listening" and not s.audio_file:
                errors.append(f"Listening section {s.order}: no audio.")
            if s.kind == "reading" and not s.passage_html:
                errors.append(f"Reading section {s.order}: no passage.")
            for q in s.questions.all():
                if q.type in ("writing_task1", "writing_task2",
                              "speaking_p1", "speaking_p2", "speaking_p3"):
                    continue
                if not q.answer_key:
                    errors.append(f"Q{q.order}: no answer key.")
        if errors:
            return Response({"errors": errors}, status=400)
        from django.utils import timezone
        test.status = Test.Status.PUBLISHED
        test.published_at = timezone.now()
        test.save()
        return Response({"id": str(test.id), "status": test.status})


class SmartPastePreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        mode = request.data.get("mode", "reading")
        if mode == "reading":
            pr = parse_reading(request.data.get("passage", ""),
                               request.data.get("questions", ""),
                               request.data.get("answers", ""))
        elif mode == "listening":
            pr = parse_listening(request.data.get("transcript", ""),
                                 request.data.get("questions", ""),
                                 request.data.get("answers", ""))
        elif mode == "writing":
            pr = parse_writing(request.data.get("task1_prompt", ""),
                               request.data.get("task2_prompt", ""),
                               request.data.get("task1_image_url", ""))
        elif mode == "speaking":
            pr = parse_speaking(request.data.get("part1", ""),
                                request.data.get("part2", ""),
                                request.data.get("part3", ""))
        else:
            return Response({"error": "Invalid mode"}, status=400)
        return Response(_serialize_parse(pr))


class SmartPasteCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        title = request.data.get("title") or "Untitled Test"
        mode = request.data.get("mode", "reading")
        module = request.data.get("module", "academic")

        if mode == "reading":
            pr = parse_reading(request.data.get("passage", ""),
                               request.data.get("questions", ""),
                               request.data.get("answers", ""))
        elif mode == "listening":
            pr = parse_listening(request.data.get("transcript", ""),
                                 request.data.get("questions", ""),
                                 request.data.get("answers", ""))
        elif mode == "writing":
            pr = parse_writing(request.data.get("task1_prompt", ""),
                               request.data.get("task2_prompt", ""),
                               request.data.get("task1_image_url", ""))
        elif mode == "speaking":
            pr = parse_speaking(request.data.get("part1", ""),
                                request.data.get("part2", ""),
                                request.data.get("part3", ""))
        else:
            return Response({"error": "Invalid mode"}, status=400)

        if pr.errors:
            return Response({"errors": pr.errors,
                             "preview": _serialize_parse(pr)}, status=400)

        type_map = {"reading": "reading", "listening": "listening",
                    "writing": "writing", "speaking": "speaking"}
        test = Test.objects.create(
            organization=getattr(request, "organization", None),
            title=title, type=type_map[mode], module=module,
            status=Test.Status.DRAFT, created_by=request.user,
            creation_method="smart_paste",
            duration_minutes={"reading": 60, "listening": 30,
                              "writing": 60, "speaking": 14}[mode],
        )
        for sec_idx, parsed_section in enumerate(pr.sections):
            section = Section.objects.create(
                test=test, order=sec_idx + 1, kind=type_map[mode],
                instructions=parsed_section.instructions,
                passage_html=pr.passage_html if mode == "reading" else "",
                transcript=pr.transcript if mode == "listening" else "",
            )
            if mode == "listening" and "audio_file" in request.FILES and sec_idx == 0:
                section.audio_file = request.FILES["audio_file"]
                section.save()
            for pq in parsed_section.questions:
                Question.objects.create(
                    section=section, order=pq.order, type=pq.qtype,
                    points=1, payload=pq.payload, answer_key=pq.answer_key,
                )
        return Response({
            "test_id": str(test.id),
            "warnings": pr.warnings,
            "edit_url": f"/center/tests/{test.id}/edit",
        }, status=201)
```

`backend/apps/tests/views_student.py`:

```python
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.parsers import MultiPartParser
from .models import Test, Section, Question, Attempt, WritingSubmission
from .serializers import (
    TestListSerializer, TestForStudentSerializer,
    AttemptSerializer,
)
from .grading import grade_attempt


class StudentTestListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TestListSerializer

    def get_queryset(self):
        return Test.objects.filter(status=Test.Status.PUBLISHED).order_by("-published_at")


class StudentTestDetailView(RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TestForStudentSerializer
    queryset = Test.objects.all()

    def get_object(self):
        obj = super().get_object()
        if obj.status != Test.Status.PUBLISHED:
            from rest_framework.exceptions import NotFound
            raise NotFound()
        return obj


class StartAttemptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        test = Test.objects.get(pk=pk, status=Test.Status.PUBLISHED)
        attempt = Attempt.objects.create(test=test, student=request.user)
        return Response({"attempt_id": str(attempt.id),
                         "test": TestForStudentSerializer(test).data})


class AttemptDetailView(RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = AttemptSerializer
    queryset = Attempt.objects.all()


class SaveAnswerView(APIView):
    """Auto-save individual answers as the student types."""
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
        from django.utils import timezone
        attempt = Attempt.objects.get(pk=pk, student=request.user)
        if attempt.status != Attempt.Status.IN_PROGRESS:
            return Response({"error": "Already submitted."}, status=400)
        attempt.status = Attempt.Status.SUBMITTED
        attempt.submitted_at = timezone.now()
        attempt.save()

        # Auto-grade objective parts
        summary = grade_attempt(attempt)

        # Persist Writing submissions for teacher review
        for section in attempt.test.sections.all():
            for q in section.questions.filter(type__in=["writing_task1", "writing_task2"]):
                text = attempt.answers.get(str(q.id), "") or ""
                if text.strip():
                    WritingSubmission.objects.create(
                        attempt=attempt, question=q, text=text,
                        word_count=len(text.split()),
                    )

        return Response({"summary": summary,
                         "result_url": f"/student/attempts/{attempt.id}/result"})


class UploadSpeakingRecordingView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request, pk):
        attempt = Attempt.objects.get(pk=pk, student=request.user)
        question_id = request.data.get("question_id")
        recording = request.FILES.get("audio")
        if not (question_id and recording):
            return Response({"error": "Missing fields"}, status=400)
        # Save to media/speaking/<attempt>/<qid>.webm
        from django.core.files.storage import default_storage
        path = f"speaking/{attempt.id}/{question_id}.webm"
        saved_path = default_storage.save(path, recording)
        attempt.speaking_recordings[str(question_id)] = default_storage.url(saved_path)
        attempt.save(update_fields=["speaking_recordings", "updated_at"])
        return Response({"saved": True, "url": default_storage.url(saved_path)})
```

`backend/apps/tests/serializers.py`:

```python
from rest_framework import serializers
from .models import Test, Section, Question, Attempt


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ["id", "order", "type", "points", "payload", "answer_key"]


class QuestionForStudentSerializer(serializers.ModelSerializer):
    """Excludes answer_key — students must not see correct answers."""
    class Meta:
        model = Question
        fields = ["id", "order", "type", "points", "payload"]


class SectionSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Section
        fields = ["id", "order", "kind", "instructions",
                  "passage_html", "audio_file", "transcript", "image",
                  "duration_seconds", "questions"]


class SectionForStudentSerializer(serializers.ModelSerializer):
    questions = QuestionForStudentSerializer(many=True, read_only=True)

    class Meta:
        model = Section
        fields = ["id", "order", "kind", "instructions",
                  "passage_html", "audio_file", "image",
                  "duration_seconds", "questions"]


class TestListSerializer(serializers.ModelSerializer):
    question_count = serializers.SerializerMethodField()

    class Meta:
        model = Test
        fields = ["id", "title", "description", "type", "module",
                  "duration_minutes", "status", "published_at",
                  "created_at", "question_count"]

    def get_question_count(self, obj):
        return Question.objects.filter(section__test=obj).count()


class TestDetailSerializer(serializers.ModelSerializer):
    sections = SectionSerializer(many=True, read_only=True)

    class Meta:
        model = Test
        fields = ["id", "title", "description", "type", "module",
                  "duration_minutes", "status", "published_at",
                  "creation_method", "sections"]


class TestForStudentSerializer(serializers.ModelSerializer):
    sections = SectionForStudentSerializer(many=True, read_only=True)

    class Meta:
        model = Test
        fields = ["id", "title", "type", "module", "duration_minutes", "sections"]


class AttemptSerializer(serializers.ModelSerializer):
    test = TestForStudentSerializer(read_only=True)

    class Meta:
        model = Attempt
        fields = ["id", "test", "status", "started_at", "submitted_at",
                  "answers", "raw_score", "band_score", "section_band_scores"]
```

---

# PART 6 — FRONTEND ROUTES

```tsx
// App.tsx
<Routes>
  {/* Admin */}
  <Route path="/center/tests" element={<TestsList />} />
  <Route path="/center/tests/new" element={<TestCreator />} />
  <Route path="/center/tests/:id/edit" element={<TestCreator />} />

  {/* Student */}
  <Route path="/student/tests" element={<StudentTestList />} />
  <Route path="/student/tests/:id" element={<StudentTestStart />} />
  <Route path="/student/attempts/:attemptId" element={<TestPlayer />} />
  <Route path="/student/attempts/:attemptId/result" element={<ResultScreen />} />

  {/* Bug fix — old broken route redirects */}
  <Route path="/edit/tests/:id" element={<Navigate to="/center/tests/:id/edit" replace />} />
</Routes>
```

---

# PART 7 — FRONTEND: ADMIN TEST CREATOR (Smart Paste Primary)

`frontend/src/pages/center/tests/TestCreator.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { LivePreview } from '@/components/test-creator/LivePreview';

type Mode = 'reading' | 'listening' | 'writing' | 'speaking';

export default function TestCreator() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  // Existing test data if editing
  const { data: existing } = useQuery({
    queryKey: ['test', id],
    queryFn: () => api.get(`/admin/tests/${id}/`).then(r => r.data),
    enabled: isEdit,
  });

  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<Mode>('reading');
  const [module, setModule] = useState<'academic' | 'general'>('academic');
  const [passage, setPassage] = useState('');
  const [transcript, setTranscript] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [questions, setQuestions] = useState('');
  const [answers, setAnswers] = useState('');
  const [task1, setTask1] = useState('');
  const [task2, setTask2] = useState('');
  const [task1Image, setTask1Image] = useState<File | null>(null);
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [p3, setP3] = useState('');

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setMode(existing.type);
      setModule(existing.module);
      // ... reconstruct paste areas from sections if needed
    }
  }, [existing]);

  const formData = { mode, passage, transcript, questions, answers,
                     task1_prompt: task1, task2_prompt: task2,
                     part1: p1, part2: p2, part3: p3 };

  const debounced = useDebouncedValue(formData, 800);
  const [preview, setPreview] = useState<any>(null);

  // Live preview
  useEffect(() => {
    const hasContent =
      (mode === 'reading' && (debounced.passage || debounced.questions || debounced.answers)) ||
      (mode === 'listening' && (debounced.questions || debounced.answers)) ||
      (mode === 'writing' && (debounced.task1_prompt || debounced.task2_prompt)) ||
      (mode === 'speaking' && (debounced.part1 || debounced.part2 || debounced.part3));
    if (!hasContent) return;
    api.post('/admin/smart-paste/preview/', debounced).then(r => setPreview(r.data));
  }, [debounced, mode]);

  // Auto-save (only after test exists, in edit mode)
  const saveMutation = useMutation({
    mutationFn: (patch: any) => api.patch(`/admin/tests/${id}/`, patch),
  });
  useEffect(() => {
    if (!isEdit) return;
    const t = setTimeout(() => {
      saveMutation.mutate({ title });
    }, 1500);
    return () => clearTimeout(t);
  }, [title, isEdit]);

  const createMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      Object.entries(formData).forEach(([k, v]) => fd.append(k, String(v ?? '')));
      fd.append('title', title);
      fd.append('module', module);
      if (audioFile) fd.append('audio_file', audioFile);
      if (task1Image) fd.append('task1_image', task1Image);
      return api.post('/admin/smart-paste/create/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: (r: any) => navigate(`/center/tests/${r.data.test_id}/edit`),
  });

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/center/tests')} className="text-gray-500">←</button>
          <input
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Test title (e.g. Cambridge IELTS 17 Test 2)"
            className="w-96 border-b border-transparent bg-transparent text-lg font-medium focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <select value={mode} onChange={e => setMode(e.target.value as Mode)}
                  className="rounded border px-3 py-1.5 text-sm">
            <option value="reading">Reading</option>
            <option value="listening">Listening</option>
            <option value="writing">Writing</option>
            <option value="speaking">Speaking</option>
          </select>
          <select value={module} onChange={e => setModule(e.target.value as any)}
                  className="rounded border px-3 py-1.5 text-sm">
            <option value="academic">Academic</option>
            <option value="general">General Training</option>
          </select>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!title || !preview || (preview?.errors?.length ?? 0) > 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300"
          >
            {createMutation.isPending ? 'Creating…' : 'Save and Open'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: paste areas */}
        <div className="w-1/2 overflow-auto border-r bg-gray-50 p-6">
          {mode === 'reading' && <ReadingForm
            passage={passage} setPassage={setPassage}
            questions={questions} setQuestions={setQuestions}
            answers={answers} setAnswers={setAnswers}
          />}
          {mode === 'listening' && <ListeningForm
            audioFile={audioFile} setAudioFile={setAudioFile}
            transcript={transcript} setTranscript={setTranscript}
            questions={questions} setQuestions={setQuestions}
            answers={answers} setAnswers={setAnswers}
          />}
          {mode === 'writing' && <WritingForm
            t1={task1} setT1={setTask1}
            t2={task2} setT2={setTask2}
            t1Image={task1Image} setT1Image={setTask1Image}
          />}
          {mode === 'speaking' && <SpeakingForm
            p1={p1} setP1={setP1} p2={p2} setP2={setP2} p3={p3} setP3={setP3}
          />}
        </div>

        {/* Right: live preview */}
        <div className="w-1/2 overflow-auto p-6">
          <LivePreview preview={preview} />
        </div>
      </div>
    </div>
  );
}


function PasteArea({ label, hint, value, onChange, rows = 12 }: any) {
  return (
    <div className="mb-5">
      <label className="mb-1 flex items-center justify-between">
        <span className="font-medium text-gray-900">{label}</span>
        <span className="text-xs text-gray-500">{value.length} chars</span>
      </label>
      {hint && <p className="mb-2 text-xs text-gray-500">{hint}</p>}
      <textarea
        value={value} onChange={e => onChange(e.target.value)}
        rows={rows} spellCheck={false}
        className="w-full rounded-lg border border-gray-300 bg-white p-3 font-mono text-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}

function ReadingForm(p: any) {
  return (<>
    <PasteArea
      label="📖 Passage"
      hint="Paragraphs auto-detected from blank lines or A/B/C markers."
      value={p.passage} onChange={p.setPassage} rows={14}
    />
    <PasteArea
      label="❓ Questions"
      hint="Use 'Questions 1-5: Choose...' headers like Cambridge IELTS books."
      value={p.questions} onChange={p.setQuestions} rows={14}
    />
    <PasteArea
      label="✅ Answer Key"
      hint="One per line: '1   iv', '6   TRUE', '11   B'"
      value={p.answers} onChange={p.setAnswers} rows={10}
    />
  </>);
}

function ListeningForm(p: any) {
  return (<>
    <div className="mb-5">
      <label className="mb-1 block font-medium">🔊 Audio file (.mp3, .wav)</label>
      <input type="file" accept="audio/*"
             onChange={e => p.setAudioFile(e.target.files?.[0] || null)} />
      {p.audioFile && (
        <p className="mt-1 text-xs text-gray-500">
          {p.audioFile.name} — {(p.audioFile.size / 1024 / 1024).toFixed(1)} MB
        </p>
      )}
    </div>
    <PasteArea label="📝 Transcript (optional)" value={p.transcript}
               onChange={p.setTranscript} rows={8}
               hint="For QC and teachers; not shown to students." />
    <PasteArea label="❓ Questions (Sections 1–4)" value={p.questions}
               onChange={p.setQuestions} rows={16}
               hint="40 questions across 4 sections (1–10, 11–20, 21–30, 31–40)." />
    <PasteArea label="✅ Answer Key" value={p.answers}
               onChange={p.setAnswers} rows={10}
               hint="40 lines." />
  </>);
}

function WritingForm(p: any) {
  return (<>
    <div className="mb-5">
      <label className="mb-1 block font-medium">📊 Task 1 chart/graph image (Academic only)</label>
      <input type="file" accept="image/*"
             onChange={e => p.setT1Image(e.target.files?.[0] || null)} />
    </div>
    <PasteArea label="✍️ Task 1 prompt (150 words, 20 min)"
               value={p.t1} onChange={p.setT1} rows={10} />
    <PasteArea label="✍️ Task 2 prompt (250 words, 40 min)"
               value={p.t2} onChange={p.setT2} rows={10} />
  </>);
}

function SpeakingForm(p: any) {
  return (<>
    <PasteArea label="🗣️ Part 1 — Introduction questions"
               value={p.p1} onChange={p.setP1} rows={8} />
    <PasteArea label="🗣️ Part 2 — Cue card"
               hint="First line is the topic; bullet lines are talking points."
               value={p.p2} onChange={p.setP2} rows={10} />
    <PasteArea label="🗣️ Part 3 — Discussion questions"
               value={p.p3} onChange={p.setP3} rows={8} />
  </>);
}
```

`frontend/src/components/test-creator/LivePreview.tsx`:

```tsx
export function LivePreview({ preview }: { preview: any }) {
  if (!preview) {
    return <div className="text-sm text-gray-400">Live preview will appear as you paste content.</div>;
  }
  return (
    <div className="space-y-4">
      {preview.errors?.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="font-medium text-red-900">Errors</h3>
          <ul className="mt-2 list-disc pl-5 text-sm text-red-800">
            {preview.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
      <div className="rounded-lg border bg-white p-4">
        <h3 className="font-medium">Summary</h3>
        <p className="mt-2 text-sm text-gray-700">
          Sections: <strong>{preview.sections?.length}</strong> ·
          Questions: <strong>{preview.question_count}</strong> ·
          Paragraphs: <strong>{preview.paragraphs?.join(', ') || '—'}</strong>
        </p>
      </div>
      {preview.warnings?.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
          {preview.warnings.map((w: string, i: number) => <p key={i}>⚠️ {w}</p>)}
        </div>
      )}
      {preview.sections?.map((s: any, i: number) => (
        <div key={i} className="rounded-lg border bg-white p-4">
          <h4 className="text-sm font-medium">{s.instructions}</h4>
          <table className="mt-3 w-full text-sm">
            <thead className="text-xs uppercase text-gray-500">
              <tr><th className="text-left">#</th><th className="text-left">Type</th>
                  <th className="text-left">Q</th><th className="text-left">Answer</th>
                  <th className="text-right">Conf</th></tr>
            </thead>
            <tbody>
              {s.questions.map((q: any) => (
                <tr key={q.order} className="border-t">
                  <td className="py-1">{q.order}</td>
                  <td className="font-mono text-xs">{q.qtype}</td>
                  <td className="text-gray-700">{q.raw_text?.slice(0, 50)}</td>
                  <td className="font-mono text-xs">{JSON.stringify(q.answer_key).slice(0, 30)}</td>
                  <td className={`text-right text-xs ${
                    q.detection?.confidence > 0.85 ? 'text-green-600'
                    : q.detection?.confidence > 0.5 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {((q.detection?.confidence ?? 0) * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
```

`frontend/src/hooks/useDebouncedValue.ts`:

```tsx
import { useEffect, useState } from 'react';
export function useDebouncedValue<T>(v: T, ms: number): T {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}
```

---

# PART 8 — FRONTEND: STUDENT TEST PLAYER

This is the biggest part. The player must look **identical to real CD IELTS** for Reading, Listening, Writing, Speaking.

## 8.1 Layout

```
┌──────────────────────────────────────────────────────┐
│ Test title       Section X of Y       ⏱ 47:23    [×] │
├──────────────────────────────────────────────────────┤
│                                                      │
│   PASSAGE / AUDIO PLAYER          QUESTIONS          │
│   (left, 60%)                     (right, 40%)       │
│                                                      │
│                                                      │
├──────────────────────────────────────────────────────┤
│ Part1 [1][2][3]…[13]  Part2 [14]…  Part3 [27]… Review│
└──────────────────────────────────────────────────────┘
```

## 8.2 Main player — `frontend/src/pages/student/TestPlayer.tsx`

```tsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Timer } from '@/components/test-player/Timer';
import { QuestionPalette } from '@/components/test-player/QuestionPalette';
import { ReviewScreen } from '@/components/test-player/ReviewScreen';
import { SingleShotAudioPlayer } from '@/components/test-player/SingleShotAudioPlayer';
import { renderQuestion } from '@/components/test-player/question-renderers';

export default function TestPlayer() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [showReview, setShowReview] = useState(false);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const { data: attempt } = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => api.get(`/student/attempts/${attemptId}/`).then(r => r.data),
  });

  // Load initial answers
  useEffect(() => {
    if (attempt?.answers) setAnswers(attempt.answers);
  }, [attempt]);

  const saveAnswerMutation = useMutation({
    mutationFn: ({ qid, ans }: { qid: string; ans: any }) =>
      api.post(`/student/attempts/${attemptId}/answer/`,
               { question_id: qid, answer: ans }),
  });

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/student/attempts/${attemptId}/submit/`),
    onSuccess: () => navigate(`/student/attempts/${attemptId}/result`),
  });

  const handleAnswer = (qid: string, ans: any) => {
    setAnswers(prev => ({ ...prev, [qid]: ans }));
    saveAnswerMutation.mutate({ qid, ans });
  };

  if (!attempt) return <div className="p-8">Loading…</div>;

  const test = attempt.test;
  const sections = test.sections || [];
  const activeSection = sections[activeSectionIdx];
  const totalSeconds = test.duration_minutes * 60;

  // Build flat question list with section boundaries (for the palette)
  const flatQuestions = useMemo(() => {
    const out: { qid: string; qOrder: number; sectionIdx: number;
                 qtype: string; sectionStart: number }[] = [];
    let runningQ = 1;
    sections.forEach((sec: any, secIdx: number) => {
      sec.questions.forEach((q: any) => {
        out.push({
          qid: q.id, qOrder: runningQ, sectionIdx: secIdx,
          qtype: q.type, sectionStart: runningQ - sec.questions.indexOf(q),
        });
        runningQ += 1;
      });
    });
    return out;
  }, [sections]);

  if (showReview) {
    return (
      <ReviewScreen
        sections={sections} answers={answers}
        flatQuestions={flatQuestions}
        onBack={() => setShowReview(false)}
        onSubmit={() => submitMutation.mutate()}
        submitting={submitMutation.isPending}
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
            Section {activeSectionIdx + 1} of {sections.length} — {test.type} ({test.module})
          </p>
        </div>
        <Timer
          totalSeconds={totalSeconds}
          startedAt={attempt.started_at}
          onExpire={() => submitMutation.mutate()}
        />
      </header>

      {/* Body — adapts per kind */}
      <main className="flex flex-1 overflow-hidden">
        {activeSection?.kind === 'reading' && (
          <ReadingLayout section={activeSection} answers={answers} onAnswer={handleAnswer}
                         flatQuestions={flatQuestions} sectionIdx={activeSectionIdx} />
        )}
        {activeSection?.kind === 'listening' && (
          <ListeningLayout section={activeSection} answers={answers} onAnswer={handleAnswer}
                           flatQuestions={flatQuestions} sectionIdx={activeSectionIdx} />
        )}
        {activeSection?.kind === 'writing' && (
          <WritingLayout section={activeSection} answers={answers} onAnswer={handleAnswer} />
        )}
        {activeSection?.kind === 'speaking' && (
          <SpeakingLayout section={activeSection} answers={answers} onAnswer={handleAnswer}
                          attemptId={attemptId!} />
        )}
      </main>

      {/* Bottom — question palette + section nav + review */}
      <footer className="border-t bg-white px-6 py-3">
        <QuestionPalette
          flatQuestions={flatQuestions}
          answers={answers}
          activeSectionIdx={activeSectionIdx}
          onSectionClick={setActiveSectionIdx}
          onReview={() => setShowReview(true)}
        />
      </footer>
    </div>
  );
}


function ReadingLayout({ section, answers, onAnswer }: any) {
  return (
    <>
      <div className="w-3/5 overflow-auto border-r bg-white p-6"
           dangerouslySetInnerHTML={{ __html: section.passage_html }} />
      <div className="w-2/5 overflow-auto p-6">
        <p className="mb-4 text-sm italic text-gray-600">{section.instructions}</p>
        {section.questions.map((q: any) => (
          <div key={q.id} className="mb-6 border-b pb-4">
            {renderQuestion({ question: q, answer: answers[q.id], onAnswer })}
          </div>
        ))}
      </div>
    </>
  );
}

function ListeningLayout({ section, answers, onAnswer }: any) {
  return (
    <div className="flex w-full flex-col overflow-auto p-6">
      {section.audio_file && (
        <div className="mb-4">
          <SingleShotAudioPlayer src={section.audio_file} />
        </div>
      )}
      <p className="mb-4 text-sm italic text-gray-600">{section.instructions}</p>
      {section.questions.map((q: any) => (
        <div key={q.id} className="mb-6 border-b pb-4">
          {renderQuestion({ question: q, answer: answers[q.id], onAnswer })}
        </div>
      ))}
    </div>
  );
}

function WritingLayout({ section, answers, onAnswer }: any) {
  return (
    <div className="flex w-full overflow-auto">
      {section.questions.map((q: any) => (
        <div key={q.id} className="flex w-full">
          <div className="w-1/2 overflow-auto border-r bg-white p-6">
            {q.payload.image_url && (
              <img src={q.payload.image_url} alt="Task 1" className="mb-4 max-w-full" />
            )}
            <p className="whitespace-pre-wrap">{q.payload.prompt}</p>
            <p className="mt-4 text-xs text-gray-500">
              Minimum {q.payload.min_words} words · {q.payload.time_minutes} minutes
            </p>
          </div>
          <div className="w-1/2 p-6">
            <WritingTextarea
              question={q} answer={answers[q.id] ?? ''}
              onAnswer={(v: string) => onAnswer(q.id, v)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function WritingTextarea({ question, answer, onAnswer }: any) {
  const minWords = question.payload.min_words || 150;
  const wc = (answer || '').trim().split(/\s+/).filter(Boolean).length;
  return (
    <div className="flex h-full flex-col">
      <textarea
        value={answer}
        onChange={e => onAnswer(e.target.value)}
        className="flex-1 resize-none rounded border p-4 font-serif text-base focus:outline-none"
        spellCheck={true}
      />
      <div className={`mt-2 text-sm ${wc < minWords ? 'text-red-600' : 'text-green-600'}`}>
        Words: {wc} / {minWords}
      </div>
    </div>
  );
}

function SpeakingLayout({ section, answers, onAnswer, attemptId }: any) {
  // Speaking renders one question at a time with mic recording
  const q = section.questions[0];   // typically one question per section in Speaking
  return (
    <div className="flex w-full flex-col items-center overflow-auto p-8">
      <div className="w-full max-w-2xl">
        {renderQuestion({ question: q, answer: answers[q.id], onAnswer,
                          attemptId })}
      </div>
    </div>
  );
}
```

## 8.3 Single-Shot Audio Player — `frontend/src/components/test-player/SingleShotAudioPlayer.tsx`

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
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">
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

## 8.4 Timer

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

## 8.5 Question Palette

```tsx
export function QuestionPalette({
  flatQuestions, answers, activeSectionIdx, onSectionClick, onReview,
}: any) {
  // Group by section
  const groups: Record<number, typeof flatQuestions> = {};
  flatQuestions.forEach((q: any) => {
    (groups[q.sectionIdx] ||= []).push(q);
  });
  return (
    <div className="flex items-center gap-3 overflow-x-auto">
      {Object.entries(groups).map(([secIdx, qs]: any) => (
        <div key={secIdx} className="flex items-center gap-1">
          <span className={`mr-1 text-xs font-medium ${
            Number(secIdx) === activeSectionIdx ? 'text-blue-700' : 'text-gray-500'
          }`}>
            S{Number(secIdx) + 1}
          </span>
          {qs.map((q: any) => {
            const answered = Boolean(answers[q.qid] && answers[q.qid] !== '');
            return (
              <button
                key={q.qid}
                onClick={() => onSectionClick(q.sectionIdx)}
                className={`h-8 w-8 rounded-full text-xs font-medium ${
                  answered ? 'bg-blue-600 text-white'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {q.qOrder}
              </button>
            );
          })}
        </div>
      ))}
      <button onClick={onReview}
              className="ml-auto rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white">
        Review →
      </button>
    </div>
  );
}
```

## 8.6 Review Screen

```tsx
export function ReviewScreen({ sections, answers, flatQuestions, onBack, onSubmit, submitting }: any) {
  const unanswered = flatQuestions.filter((q: any) =>
    !answers[q.qid] || answers[q.qid] === '' ||
    (Array.isArray(answers[q.qid]) && answers[q.qid].length === 0)
  );
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold">Review your answers</h1>
      <p className="text-gray-600">
        Total: {flatQuestions.length} ·
        Answered: {flatQuestions.length - unanswered.length} ·
        Unanswered: <span className="font-bold text-red-600">{unanswered.length}</span>
      </p>

      <div className="mt-6 grid grid-cols-10 gap-2">
        {flatQuestions.map((q: any) => {
          const answered = Boolean(answers[q.qid]);
          return (
            <div key={q.qid}
                 className={`rounded p-2 text-center text-xs font-medium ${
                   answered ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                 }`}>
              {q.qOrder}
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex gap-3">
        <button onClick={onBack}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
          ← Back to test
        </button>
        <button onClick={onSubmit} disabled={submitting}
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white disabled:bg-gray-300">
          {submitting ? 'Submitting…' : 'Submit final answers'}
        </button>
      </div>
    </div>
  );
}
```

---

# PART 9 — QUESTION RENDERERS (one component per IELTS type)

`frontend/src/components/test-player/question-renderers/index.tsx`:

```tsx
import { TFNGRenderer } from './TFNGRenderer';
import { YNNGRenderer } from './YNNGRenderer';
import { MCQSingleRenderer } from './MCQSingleRenderer';
import { MCQMultiRenderer } from './MCQMultiRenderer';
import { MatchingHeadingsRenderer } from './MatchingHeadingsRenderer';
import { MatchingItemRenderer } from './MatchingItemRenderer';
import { CompletionRenderer } from './CompletionRenderer';
import { ShortAnswerRenderer } from './ShortAnswerRenderer';
import { DiagramLabelRenderer } from './DiagramLabelRenderer';
import { SpeakingPart1Renderer } from './SpeakingPart1Renderer';
import { SpeakingPart2Renderer } from './SpeakingPart2Renderer';

export function renderQuestion(props: any) {
  const { question } = props;
  switch (question.type) {
    case 'tfng': return <TFNGRenderer {...props} />;
    case 'ynng': return <YNNGRenderer {...props} />;
    case 'mcq_single': return <MCQSingleRenderer {...props} />;
    case 'mcq_multi': return <MCQMultiRenderer {...props} />;
    case 'matching_headings': return <MatchingHeadingsRenderer {...props} />;
    case 'matching_info':
    case 'matching_features':
    case 'matching_endings': return <MatchingItemRenderer {...props} />;
    case 'sentence_completion':
    case 'summary_completion':
    case 'form_completion': return <CompletionRenderer {...props} />;
    case 'short_answer': return <ShortAnswerRenderer {...props} />;
    case 'diagram_label':
    case 'map_labelling': return <DiagramLabelRenderer {...props} />;
    case 'speaking_p1':
    case 'speaking_p3': return <SpeakingPart1Renderer {...props} />;
    case 'speaking_p2': return <SpeakingPart2Renderer {...props} />;
    default: return <pre className="text-xs text-gray-500">Unsupported: {question.type}</pre>;
  }
}
```

Below are templates for each renderer. They all follow the same pattern: receive `question`, `answer`, `onAnswer(qid, value)`, and render appropriate UI.

`TFNGRenderer.tsx`:

```tsx
export function TFNGRenderer({ question, answer, onAnswer }: any) {
  const opts = ['TRUE', 'FALSE', 'NOT GIVEN'];
  return (
    <div>
      <div className="mb-2 flex items-start gap-2">
        <span className="font-semibold">{question.order}.</span>
        <span>{question.payload.statement}</span>
      </div>
      <div className="flex gap-2">
        {opts.map(v => (
          <label key={v}
                 className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                   answer === v ? 'border-blue-600 bg-blue-50 text-blue-700'
                                : 'border-gray-300 hover:bg-gray-50'
                 }`}>
            <input type="radio" name={`q-${question.id}`} value={v}
                   checked={answer === v}
                   onChange={() => onAnswer(question.id, v)}
                   className="hidden" />
            {v}
          </label>
        ))}
      </div>
    </div>
  );
}
```

`YNNGRenderer.tsx`: same as above but options `['YES', 'NO', 'NOT GIVEN']`.

`MCQSingleRenderer.tsx`:

```tsx
export function MCQSingleRenderer({ question, answer, onAnswer }: any) {
  return (
    <div>
      <p className="mb-3 font-medium">
        <span className="mr-2 font-semibold">{question.order}.</span>
        {question.payload.stem}
      </p>
      <div className="space-y-2">
        {question.payload.options?.map((opt: any) => (
          <label key={opt.id}
                 className={`flex cursor-pointer items-start gap-3 rounded border p-2 ${
                   answer === opt.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                 }`}>
            <input type="radio" name={`q-${question.id}`} value={opt.id}
                   checked={answer === opt.id}
                   onChange={() => onAnswer(question.id, opt.id)} />
            <span><strong>{opt.id}.</strong> {opt.text}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
```

`MCQMultiRenderer.tsx`:

```tsx
export function MCQMultiRenderer({ question, answer, onAnswer }: any) {
  const selected: string[] = answer ?? [];
  const max = question.payload.select_count || 2;
  const toggle = (id: string) => {
    let next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
    if (next.length > max) next = next.slice(-max);
    onAnswer(question.id, next);
  };
  return (
    <div>
      <p className="mb-2 font-medium">
        {question.order}. {question.payload.stem}
      </p>
      <p className="mb-3 text-xs text-gray-500">Choose {max} answers</p>
      <div className="space-y-2">
        {question.payload.options.map((opt: any) => (
          <label key={opt.id}
                 className={`flex cursor-pointer items-start gap-3 rounded border p-2 ${
                   selected.includes(opt.id) ? 'border-blue-600 bg-blue-50'
                                              : 'border-gray-200 hover:bg-gray-50'
                 }`}>
            <input type="checkbox" checked={selected.includes(opt.id)}
                   onChange={() => toggle(opt.id)} />
            <span><strong>{opt.id}.</strong> {opt.text}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
```

`MatchingHeadingsRenderer.tsx` ⭐ (the previously-missing critical type):

```tsx
export function MatchingHeadingsRenderer({ question, answer, onAnswer }: any) {
  const matches: Record<string, string> = answer ?? {};
  const setMatch = (para: string, heading: string) => {
    onAnswer(question.id, { ...matches, [para]: heading });
  };
  return (
    <div>
      <p className="mb-3 text-sm italic text-gray-600">
        Choose the most suitable heading for each paragraph from the list below.
      </p>
      <div className="mb-4 rounded-lg border bg-gray-50 p-3 text-sm">
        <p className="mb-2 font-medium">List of Headings</p>
        <ul className="space-y-1">
          {question.payload.headings.map((h: any) => (
            <li key={h.id}><strong>{h.id}.</strong> {h.text}</li>
          ))}
        </ul>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {question.payload.paragraphs.map((para: string, i: number) => (
            <tr key={para} className="border-b">
              <td className="py-2 font-medium">
                {(question.order ?? 0) + i}. Paragraph {para}
              </td>
              <td className="py-2 text-right">
                <select value={matches[para] || ''}
                        onChange={e => setMatch(para, e.target.value)}
                        className="rounded border px-2 py-1">
                  <option value="">— select —</option>
                  {question.payload.headings.map((h: any) => (
                    <option key={h.id} value={h.id}>{h.id}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`MatchingItemRenderer.tsx` (info / features / endings):

```tsx
export function MatchingItemRenderer({ question, answer, onAnswer }: any) {
  const matches: Record<string, string> = answer ?? {};
  return (
    <div>
      <table className="w-full text-sm">
        <tbody>
          {question.payload.items.map((item: any) => (
            <tr key={item.id} className="border-b">
              <td className="py-2 pr-2 font-medium">{item.id}.</td>
              <td className="py-2 pr-2">{item.text}</td>
              <td className="py-2 text-right">
                <select value={matches[String(item.id)] || ''}
                        onChange={e => onAnswer(question.id, { ...matches, [item.id]: e.target.value })}
                        className="rounded border px-2 py-1">
                  <option value="">—</option>
                  {question.payload.options.map((o: any) => (
                    <option key={o.id} value={o.id}>{o.id}. {o.text.slice(0, 30)}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`CompletionRenderer.tsx`:

```tsx
export function CompletionRenderer({ question, answer, onAnswer }: any) {
  const blanks: string[] = answer ?? [];
  const template: string = question.payload.template || question.payload.template_html || '';
  const parts = template.split(/\{\{(\d+)\}\}/);
  const setBlank = (idx: number, value: string) => {
    const next = [...blanks];
    next[idx] = value;
    onAnswer(question.id, next);
  };
  return (
    <div className="leading-7">
      <span className="mr-2 font-semibold">{question.order}.</span>
      {parts.map((p, i) =>
        i % 2 === 0 ? <span key={i}>{p}</span> : (
          <input
            key={i}
            value={blanks[Number(p) - 1] ?? ''}
            onChange={e => setBlank(Number(p) - 1, e.target.value)}
            className="mx-1 inline-block w-32 rounded border-b-2 border-blue-500 bg-blue-50 px-2 py-0.5 focus:outline-none"
          />
        )
      )}
      <p className="mt-1 text-xs text-gray-500">
        Use NO MORE THAN {question.payload.word_limit || 2} WORDS per blank.
      </p>
    </div>
  );
}
```

`ShortAnswerRenderer.tsx`:

```tsx
export function ShortAnswerRenderer({ question, answer, onAnswer }: any) {
  return (
    <div>
      <p className="mb-2 font-medium">{question.order}. {question.payload.stem}</p>
      <input value={answer ?? ''}
             onChange={e => onAnswer(question.id, e.target.value)}
             className="w-full rounded border px-3 py-2 focus:border-blue-500 focus:outline-none" />
      <p className="mt-1 text-xs text-gray-500">
        NO MORE THAN {question.payload.word_limit || 3} WORDS.
      </p>
    </div>
  );
}
```

`DiagramLabelRenderer.tsx`:

```tsx
export function DiagramLabelRenderer({ question, answer, onAnswer }: any) {
  const matches: Record<string, string> = answer ?? {};
  return (
    <div>
      <div className="relative mb-3 inline-block">
        <img src={question.payload.image_url} alt="diagram" className="max-w-full" />
        {question.payload.labels.map((l: any) => (
          <div key={l.id}
               style={{ position: 'absolute', left: l.x, top: l.y }}
               className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-xs font-bold text-blue-700">
            {l.id}
          </div>
        ))}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {question.payload.labels.map((l: any) => (
            <tr key={l.id} className="border-b">
              <td className="py-2 font-medium">Label {l.id}</td>
              <td className="py-2 text-right">
                <select value={matches[String(l.id)] || ''}
                        onChange={e => onAnswer(question.id, { ...matches, [l.id]: e.target.value })}
                        className="rounded border px-2 py-1">
                  <option value="">—</option>
                  {question.payload.options.map((o: any) => (
                    <option key={o.id} value={o.id}>{o.id}. {o.text}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`SpeakingPart1Renderer.tsx` (also used for Part 3):

```tsx
import { useState } from 'react';
import { useMicRecorder } from '@/hooks/useMicRecorder';
import { api } from '@/lib/api';

export function SpeakingPart1Renderer({ question, answer, onAnswer, attemptId }: any) {
  const questions: string[] = question.payload.questions || [];
  const [activeIdx, setActiveIdx] = useState(0);
  const { recording, start, stop, blob } = useMicRecorder();
  const [uploaded, setUploaded] = useState<Record<number, string>>({});

  const handleStop = async () => {
    const b = await stop();
    if (!b) return;
    const fd = new FormData();
    fd.append('audio', b, `q${question.id}-${activeIdx}.webm`);
    fd.append('question_id', `${question.id}-${activeIdx}`);
    const r = await api.post(`/student/attempts/${attemptId}/upload-recording/`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    setUploaded({ ...uploaded, [activeIdx]: r.data.url });
    onAnswer(question.id, { recordings: { ...uploaded, [activeIdx]: r.data.url } });
  };

  return (
    <div>
      <h2 className="mb-3 text-lg font-medium">Speaking Part 1</h2>
      <div className="mb-4 rounded-lg border bg-blue-50 p-4">
        <p className="text-sm text-gray-600">Question {activeIdx + 1} of {questions.length}</p>
        <p className="mt-2 text-lg">{questions[activeIdx]}</p>
      </div>
      <div className="flex items-center gap-3">
        {!recording ? (
          <button onClick={start} className="rounded-lg bg-red-600 px-4 py-2 text-white">
            🎙 Record answer
          </button>
        ) : (
          <button onClick={handleStop} className="rounded-lg bg-gray-700 px-4 py-2 text-white">
            ⏹ Stop & save
          </button>
        )}
        {uploaded[activeIdx] && (
          <span className="text-sm text-green-600">✓ Recorded</span>
        )}
        <button
          onClick={() => setActiveIdx(Math.min(questions.length - 1, activeIdx + 1))}
          disabled={activeIdx >= questions.length - 1}
          className="ml-auto rounded border px-3 py-1.5 text-sm disabled:opacity-50">
          Next →
        </button>
      </div>
    </div>
  );
}
```

`SpeakingPart2Renderer.tsx`:

```tsx
import { useState, useEffect } from 'react';

export function SpeakingPart2Renderer({ question, attemptId }: any) {
  const [phase, setPhase] = useState<'prep' | 'talk' | 'done'>('prep');
  const [seconds, setSeconds] = useState(question.payload.prep_seconds || 60);

  useEffect(() => {
    if (phase === 'done') return;
    const id = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          if (phase === 'prep') { setPhase('talk'); return question.payload.talk_seconds || 120; }
          else { setPhase('done'); return 0; }
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, question.payload.prep_seconds, question.payload.talk_seconds]);

  return (
    <div>
      <h2 className="mb-3 text-lg font-medium">Speaking Part 2 — Cue card</h2>
      <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-6">
        <p className="text-lg font-medium">{question.payload.topic}</p>
        <p className="mt-3 text-sm text-gray-600">You should say:</p>
        <ul className="mt-1 space-y-1 text-sm">
          {question.payload.bullets?.map((b: string, i: number) => (
            <li key={i}>• {b}</li>
          ))}
        </ul>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <p className="text-lg font-medium">
          {phase === 'prep' && 'Preparation time'}
          {phase === 'talk' && 'Now speak'}
          {phase === 'done' && 'Done'}
        </p>
        <p className="font-mono text-3xl font-bold tabular-nums">{Math.floor(seconds/60)}:{(seconds%60).toString().padStart(2,'0')}</p>
      </div>
      {/* Mic recording integration similar to Part 1 — abbreviated */}
    </div>
  );
}
```

`frontend/src/hooks/useMicRecorder.ts`:

```ts
import { useState, useRef } from 'react';

export function useMicRecorder() {
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    chunksRef.current = [];
    rec.ondataavailable = e => chunksRef.current.push(e.data);
    rec.start();
    recorderRef.current = rec;
    setRecording(true);
  };

  const stop = (): Promise<Blob | null> => new Promise(resolve => {
    const rec = recorderRef.current;
    if (!rec) return resolve(null);
    rec.onstop = () => {
      const b = new Blob(chunksRef.current, { type: 'audio/webm' });
      setBlob(b);
      setRecording(false);
      rec.stream.getTracks().forEach(t => t.stop());
      resolve(b);
    };
    rec.stop();
  });

  return { recording, blob, start, stop };
}
```

---

# PART 10 — RESULT SCREEN

`frontend/src/pages/student/ResultScreen.tsx`:

```tsx
import { useParams } from 'react-router-dom';
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
        <h1 className="mt-2 text-5xl font-bold text-blue-600">{attempt.band_score ?? '—'}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Raw score: {attempt.raw_score ?? 0}
        </p>
      </div>

      {attempt.section_band_scores && (
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
            <tr><th className="text-left">#</th><th className="text-left">Type</th>
                <th className="text-left">Your answer</th>
                <th className="text-left">Correct</th>
                <th className="text-right">Result</th></tr>
          </thead>
          <tbody>
            {attempt.test.sections.flatMap((s: any) =>
              s.questions.map((q: any) => {
                const yours = attempt.answers[q.id];
                const correct = q.answer_key;
                const isCorrect = JSON.stringify(yours) === JSON.stringify(correct.answer ?? correct);
                return (
                  <tr key={q.id} className="border-t">
                    <td className="py-2">{q.order}</td>
                    <td className="font-mono text-xs">{q.type}</td>
                    <td className="text-gray-700">{JSON.stringify(yours)}</td>
                    <td className="text-gray-700">{JSON.stringify(correct)}</td>
                    <td className={`text-right ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                      {isCorrect ? '✓' : '✗'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex gap-3">
        <a href="/student/tests" className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
          ← Back to tests
        </a>
      </div>
    </div>
  );
}
```

---

# PART 11 — STUDENT TEST CATALOG + START PAGE

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
            <h2 className="font-semibold">{t.title}</h2>
            <p className="mt-1 text-sm text-gray-600">
              {t.type} · {t.module} · {t.duration_minutes} min · {t.question_count} questions
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
  const startMutation = useMutation({
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
        {test.type === 'listening' && <li>Audio will play <strong>once only</strong>. Test your speakers first.</li>}
      </ul>
      <button onClick={() => startMutation.mutate()}
              className="mt-8 rounded-lg bg-blue-600 px-6 py-3 text-white font-medium">
        Start test now
      </button>
    </div>
  );
}
```

---

# PART 12 — VERIFICATION / TESTING

After build, manually verify each:

## Admin path
- [ ] Visit `/center/tests/new` — Test Creator page loads with mode selector
- [ ] Switch to Reading mode, paste sample (see PART 13 below), live preview appears within 1.5 sec
- [ ] Click "Save and Open" — redirects to `/center/tests/<id>/edit`, test exists in DB with status=draft
- [ ] Edit page shows the existing test data, refresh the page — data persists (autosave works)
- [ ] Click Publish — validators pass, test status flips to published
- [ ] Created test appears in `/student/tests` for students

## Student path
- [ ] Visit `/student/tests` — published tests list
- [ ] Click test — start page shows duration, sections, "Start" button
- [ ] Click Start — `/student/attempts/<id>` opens, timer starts
- [ ] Reading layout: passage on left, questions on right
- [ ] Question palette at bottom shows 1–13 (or whatever count); active question highlighted
- [ ] Type answer in TFNG question — palette button turns blue
- [ ] Listening test: audio player at top with single-shot button
- [ ] Click "Start audio" — audio plays once, no pause/scrub controls visible
- [ ] Writing test: prompt left, textarea right, word counter updates live
- [ ] Speaking test: question shows, microphone records (browser permission prompt acceptable)
- [ ] Click "Review →" — review screen shows answered/unanswered counts
- [ ] Click "Submit" — auto-grader runs, redirects to result page
- [ ] Result page shows band score, per-question breakdown

## Question types — all 14 must work end-to-end
- [ ] TFNG, YNNG, MCQ-single, MCQ-multi
- [ ] **Matching Headings** (paragraph A→heading iv, etc.)
- [ ] Matching Information / Features / Sentence Endings
- [ ] Sentence / Summary / Form Completion (with `{{1}}` blanks rendering as `<input>`)
- [ ] Diagram Label (image with pins, dropdown per pin)
- [ ] Short Answer
- [ ] Writing Task 1 (with image), Task 2
- [ ] Speaking Part 1, 2 (cue card with timer), 3

## Bug fixes verified
- [ ] `/edit/tests/:id` redirects to `/center/tests/:id/edit` (no 404)
- [ ] PDF iframe completely removed from codebase (`grep -rn iframe frontend/src/` returns no test-related matches)
- [ ] Listening audio works (no Brave-block screen)
- [ ] Mid-edit page refresh preserves all entered data

---

# PART 13 — SAMPLE TEST DATA

Use this for testing. Paste into the Reading mode of TestCreator.

**Passage:**
```
A In recent decades, scientists have devoted increasing attention to the social behaviour of bees, recognising that their colonies are remarkably sophisticated.

B One of the earliest researchers in this field was Karl von Frisch, who deciphered the famous "waggle dance".

C The economic significance of bees extends far beyond honey production. Crops worth billions depend on bee pollination.

D Yet, in recent years, populations have declined sharply due to pesticides, habitat loss, and disease.

E Conservation efforts now focus on creating bee-friendly environments and reducing reliance on harmful pesticides.
```

**Questions:**
```
Questions 1–5

Choose the most suitable heading for paragraphs A–E.

List of Headings
i    The economic role of pollination
ii   Early research on bee behaviour
iii  Modern conservation strategies
iv   The complexity of bee colonies
v    Causes of population decline

1  Paragraph A
2  Paragraph B
3  Paragraph C
4  Paragraph D
5  Paragraph E

Questions 6–8

Do the following statements agree with the information given in the passage?

6  Karl von Frisch was the first scientist to study bees.
7  Bees are responsible for pollinating crops worth billions.
8  Bee populations are now stable globally.
```

**Answer key:**
```
1  iv
2  ii
3  i
4  v
5  iii
6  NOT GIVEN
7  TRUE
8  FALSE
```

Expected: 1 ParsedSection with Matching Headings (5 paragraph mappings) + 1 ParsedSection with 3 TFNG questions. All confidences ≥ 0.9. Test creates successfully and student can take it.

---

# PART 14 — DEPLOYMENT

```bash
# Local
cd ildizmock
git add .
git commit -m "ETAP 25: Mock Test Core — Smart Paste creator + Real CD IELTS player + auto-grading"
git push origin main

# Server
ssh ildiz@207.180.226.230
cd /home/ildiz/ildizmock
git stash; git pull origin main; git stash pop
cd backend
source venv/bin/activate
pip install -r requirements.txt --break-system-packages
python manage.py migrate
python manage.py collectstatic --noinput
cd ../frontend
npm install
npm run build
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
git commit -m "ETAP 25: Mock Test Core — Smart Paste creator + Real CD IELTS player + auto-grading"
git push origin main
```

Cursor Agent: do not stop before pushing. Local-only changes are not acceptable.

---

# ⚙️ BUILD ORDER (recommended)

| Order | Task | Hours |
|-------|------|------:|
| 1 | Models + migrations (PART 1) | 0.5 |
| 2 | Smart Paste detector + parser (PARTS 3) | 4 |
| 3 | Auto-grader + band score table (PART 4) | 1.5 |
| 4 | Backend endpoints + serializers (PART 5) | 3 |
| 5 | TestCreator UI with Smart Paste + Live Preview (PART 7) | 4 |
| 6 | Auto-save in TestCreator | 1 |
| 7 | TestPlayer shell + Reading layout (PART 8.1–8.2) | 3 |
| 8 | Listening layout + SingleShotAudioPlayer (PART 8.3) | 2 |
| 9 | Writing + Speaking layouts (PART 8) | 3 |
| 10 | Question Palette + Timer (PART 8.4–8.5) | 2 |
| 11 | All 14 question renderers (PART 9) | 6 |
| 12 | Review screen (PART 8.6) | 1 |
| 13 | Result screen (PART 10) | 2 |
| 14 | Student catalog + Start page (PART 11) | 1 |
| 15 | Manual verification (PART 12) | 2 |
| 16 | Deploy (PART 14) | 0.5 |

**Total: ~36 hours = 4–5 working days for one engineer.**

After this ETAP ships, ILDIZ Mock has **the complete mock-test loop**:
- Admin adds a Cambridge IELTS Reading test in 5–8 minutes via Smart Paste
- Student opens the test, sees a real CD IELTS interface with question palette and timer
- Student submits, gets auto-graded band score in seconds
- Writing/Speaking persist for teacher grading later

This is the **production-quality core** of the platform. Everything else (highlight tool, notes, recent actual tests, mobile app, vocabulary builder, AI grading) is additive on top of this foundation.

---

**END OF ETAP 25.**
