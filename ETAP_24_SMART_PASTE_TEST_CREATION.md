# ETAP 24 — SMART TEST CREATION (5-Minute IELTS Test Builder)

> **Mission:** Replace the slow, error-prone manual test creation in ILDIZ Mock with a **Smart Paste** system that lets a teacher build a full Cambridge-style IELTS test in **5–8 minutes** instead of an hour. No AI required. Pure parsing of standard IELTS materials (Cambridge IELTS books, official PDFs) which already follow predictable formatting.
>
> **Three input modes**, all producing the same `Test → Section → Question` structure:
> 1. **Smart Paste** (primary, 5–8 min): teacher pastes passage, questions, and answer key into three text areas; backend auto-detects question types, builds the test, shows a live preview.
> 2. **Word document import** (5 min): teacher uploads a `.docx` containing the test, parser extracts everything including images.
> 3. **Excel template import** (3 min for power users): structured spreadsheet for bulk question banks.
>
> Wizard mode (the slow per-question form) remains as a fallback for question types that need fine control (e.g. Diagram Labelling with custom pin coordinates).

---

## 📌 PROJECT CONTEXT (READ BEFORE TOUCHING ANYTHING)

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
│       ├── tests/         ← MAIN FOCUS
│       └── ...
└── frontend/
    └── src/
        ├── pages/
        │   └── center/tests/   ← MAIN FOCUS
        ├── components/
        └── ...
```

**Language:** All UI text, model verbose names, comments, and code in **English only**. Do not introduce any Uzbek strings into the codebase.

**Standing rule:** Every prompt/ETAP MUST end with `git add . && git commit -m "..." && git push origin <branch>` actually executed. No local-only commits.

---

## 🎯 WHY THIS WORKS (THE INSIGHT)

Cambridge IELTS books, takeielts.britishcouncil.org PDFs, ielts.org sample tests, and IDP materials all use a standardized answer-key format that has barely changed since the 1990s:

```
Test 1
Reading
Passage 1, Questions 1–13
1   iv
2   i
3   vii
4   ii
5   v
6   TRUE
7   FALSE
8   NOT GIVEN
9   B
10  D
11  briefcase
12  2500
13  silver
```

From the **answer pattern alone**, you can detect:
- `TRUE / FALSE / NOT GIVEN` → True/False/Not Given question
- `YES / NO / NOT GIVEN` → Yes/No/Not Given question
- `i, ii, iii, iv, v, vi, vii, viii` → Matching Headings
- `A, B, C, D` (single letter) → MCQ single OR Matching (disambiguate via instructions)
- `A, B & C` (multiple letters) → MCQ multi
- one or two words → Completion / Short Answer

Combined with the standardized **instruction phrases** that IELTS uses (e.g. "Choose the most suitable heading", "Do the following statements agree with…", "Choose TWO letters"), we can identify the question type with **>95% accuracy** without AI.

That's the trick. The rest is just careful parsing.

---

## 🏗️ ARCHITECTURE OVERVIEW

```
                   ┌──────────────────────────────┐
   3 INPUT MODES   │  All produce the same output  │
                   └──────────────────────────────┘

   📋 Smart Paste          📄 Word .docx           📊 Excel .xlsx
   3 textareas             python-docx parser      openpyxl parser
        │                         │                       │
        └─────────────────────────┴───────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │  SmartTestBuilder service │
                    │  • detect question types  │
                    │  • build payloads         │
                    │  • map answer keys        │
                    │  • flag warnings          │
                    └──────────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │  Test → Section → Question│
                    │  (status: draft)          │
                    └──────────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │  Live Preview + Validate  │
                    │       → Publish           │
                    └──────────────────────────┘
```

The data model from ETAP 22 is reused as-is (Test, Section, Question, PassageBank, AudioBank). If ETAP 22 was not done, this prompt creates them in PART 2.

---

# PART 1 — DATA MODEL (skip if ETAP 22 already applied)

If `apps/tests/models.py` already has `Test`, `Section`, `Question`, `PassageBank`, `AudioBank` matching the structure below, skip this section. Otherwise create them.

```python
# apps/tests/models.py
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


class PassageBank(TimeStampedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name='passages')
    title = models.CharField(max_length=255)
    body_html = models.TextField(help_text="HTML with <p data-para='A'> markers per paragraph")
    word_count = models.PositiveIntegerField(default=0)
    source = models.CharField(max_length=255, blank=True)
    tags = models.JSONField(default=list, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)


class AudioBank(TimeStampedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name='audios')
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to='audio/listening/%Y/%m/')
    duration_seconds = models.PositiveIntegerField(default=0)
    transcript = models.TextField(blank=True)
    section_markers = models.JSONField(default=list, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)


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
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name='tests')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=16, choices=TestType.choices)
    module = models.CharField(max_length=16, choices=Module.choices, default=Module.ACADEMIC)
    difficulty = models.PositiveSmallIntegerField(default=5)
    duration_minutes = models.PositiveIntegerField(default=180)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='tests_created')
    cloned_from = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    # NEW — track origin so we know how the test was created
    creation_method = models.CharField(
        max_length=20, default='manual',
        help_text="manual | smart_paste | docx_import | excel_import",
    )


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
    passage = models.ForeignKey(PassageBank, on_delete=models.SET_NULL, null=True, blank=True, related_name='sections')
    audio = models.ForeignKey(AudioBank, on_delete=models.SET_NULL, null=True, blank=True, related_name='sections')
    image = models.ImageField(upload_to='writing/task1/%Y/%m/', null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(default=0)


class Question(TimeStampedModel):
    class Type(models.TextChoices):
        TRUE_FALSE_NG = 'tfng', 'True / False / Not Given'
        YES_NO_NG = 'ynng', 'Yes / No / Not Given'
        MCQ_SINGLE = 'mcq_single', 'Multiple Choice (single)'
        MCQ_MULTI = 'mcq_multi', 'Multiple Choice (multiple)'
        MATCHING_HEADINGS = 'matching_headings', 'Matching Headings'
        MATCHING_INFORMATION = 'matching_info', 'Matching Information'
        MATCHING_FEATURES = 'matching_features', 'Matching Features'
        MATCHING_SENTENCE_ENDINGS = 'matching_endings', 'Matching Sentence Endings'
        SENTENCE_COMPLETION = 'sentence_completion', 'Sentence Completion'
        SUMMARY_COMPLETION = 'summary_completion', 'Summary / Note / Table / Flowchart'
        DIAGRAM_LABEL = 'diagram_label', 'Diagram Label'
        SHORT_ANSWER = 'short_answer', 'Short Answer'
        FORM_COMPLETION = 'form_completion', 'Form Completion'
        MAP_LABELLING = 'map_labelling', 'Map / Plan Labelling'
        WRITING_TASK_1 = 'writing_task1', 'Writing Task 1'
        WRITING_TASK_2 = 'writing_task2', 'Writing Task 2'
        SPEAKING_PART_1 = 'speaking_p1', 'Speaking Part 1'
        SPEAKING_PART_2 = 'speaking_p2', 'Speaking Part 2'
        SPEAKING_PART_3 = 'speaking_p3', 'Speaking Part 3'

    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='questions')
    order = models.PositiveSmallIntegerField()
    type = models.CharField(max_length=32, choices=Type.choices)
    points = models.PositiveSmallIntegerField(default=1)
    payload = models.JSONField(default=dict)
    answer_key = models.JSONField(default=dict)
```

```bash
cd backend
python manage.py makemigrations tests
python manage.py migrate
```

---

# PART 2 — THE QUESTION TYPE DETECTOR

This is the core innovation. Create `backend/apps/tests/smart_paste/detector.py`:

```python
"""
Question type detector for Smart Paste.

Two-pass detection:
  Pass 1 — match standardized IELTS instruction phrases (high confidence)
  Pass 2 — fallback to answer-pattern recognition

Returns (type, confidence, reason) so the frontend can show the admin
why a type was chosen and let them override.
"""
import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class DetectionResult:
    qtype: str
    confidence: float          # 0.0–1.0
    reason: str
    needs_confirm: bool = False


# ─────────────────────────────────────────────────────────────────
# PASS 1 — instruction patterns (ordered by specificity, most → least)
# ─────────────────────────────────────────────────────────────────

INSTRUCTION_PATTERNS: list[tuple[str, str, str]] = [
    # (regex, qtype, reason shown to admin)

    # Matching Headings — must come before generic "matching"
    (r"choose the most suitable heading", "matching_headings", "instruction: 'most suitable heading'"),
    (r"list of headings", "matching_headings", "instruction mentions 'List of Headings'"),
    (r"match each .{1,30} (with|to) (a|the) heading", "matching_headings", "instruction: match → heading"),

    # Yes/No/Not Given (writer's claims)
    (r"do the following statements agree with the (claims|views|opinions) of the writer", "ynng", "instruction asks Y/N/NG"),
    (r"in boxes? .{1,15} write\s*[\r\n]+\s*YES", "ynng", "Y/N/NG box instructions"),

    # True/False/Not Given (information)
    (r"do the following statements agree with the information", "tfng", "instruction asks TF/NG"),
    (r"in boxes? .{1,15} write\s*[\r\n]+\s*TRUE", "tfng", "TF/NG box instructions"),

    # MCQ — multi
    (r"choose (TWO|THREE|FOUR|2|3|4) letters", "mcq_multi", "instruction asks multiple letters"),
    (r"which (TWO|THREE) (of the following|statements)", "mcq_multi", "instruction asks 2/3 statements"),

    # MCQ — single
    (r"choose THE correct letter,? [A-Z],?\s*[A-Z],?\s*[A-Z]\s*(or|and)\s*[A-Z]", "mcq_single", "instruction: single letter A/B/C/D"),
    (r"choose (the|one) correct (letter|answer)", "mcq_single", "instruction asks one correct letter"),

    # Matching information
    (r"which paragraph contains", "matching_info", "instruction: which paragraph"),
    (r"in which (section|paragraph) (is|are|does|can)", "matching_info", "instruction: which section"),

    # Matching features (named entities, periods, types)
    (r"match each .{1,40} with .{1,40}( listed)? (A|below)", "matching_features", "instruction: match A-? options"),
    (r"choose .{1,30} from the (list|box) (A|below)", "matching_features", "instruction: choose from list"),

    # Matching sentence endings
    (r"complete each sentence with the correct ending", "matching_endings", "instruction: sentence endings"),
    (r"match the (beginning|first part|first half) of each sentence", "matching_endings", "instruction: match sentence halves"),

    # Sentence completion
    (r"complete the sentences? below", "sentence_completion", "instruction: complete sentences"),
    (r"complete each sentence with .{1,20} from the (passage|text)", "sentence_completion", "instruction: complete with words from passage"),

    # Summary / Note / Table / Flow-chart completion
    (r"complete the summary below", "summary_completion", "instruction: complete summary"),
    (r"complete the notes below", "summary_completion", "instruction: complete notes"),
    (r"complete the table below", "summary_completion", "instruction: complete table"),
    (r"complete the flow.?chart below", "summary_completion", "instruction: complete flow-chart"),

    # Diagram label
    (r"label the diagram", "diagram_label", "instruction: label diagram"),

    # Map / plan labelling
    (r"label the (map|plan)", "map_labelling", "instruction: label map/plan"),

    # Form completion (mostly Listening)
    (r"complete the form below", "form_completion", "instruction: complete form"),

    # Short answer
    (r"answer the questions below", "short_answer", "instruction: answer questions"),

    # Writing tasks
    (r"summari[sz]e the information by selecting and reporting", "writing_task1", "Writing Task 1 prompt"),
    (r"write at least 150 words", "writing_task1", "Writing Task 1: 150 words"),
    (r"write at least 250 words", "writing_task2", "Writing Task 2: 250 words"),
    (r"discuss both .{1,30} views and give your own opinion", "writing_task2", "Writing Task 2 prompt"),
    (r"to what extent do you agree", "writing_task2", "Writing Task 2 prompt"),
]


# ─────────────────────────────────────────────────────────────────
# PASS 2 — answer pattern recognition
# ─────────────────────────────────────────────────────────────────

TFNG_TOKENS = {"TRUE", "FALSE", "NOT GIVEN", "T", "F", "NG"}
YNNG_TOKENS = {"YES", "NO", "NOT GIVEN", "Y", "N", "NG"}
ROMAN_NUMERALS = {"i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv"}


def _all_match(answers: list[str], pred) -> bool:
    return bool(answers) and all(pred(a.strip()) for a in answers if a.strip())


def detect_from_answers(answers: list[str]) -> Optional[DetectionResult]:
    """Used when instructions don't disambiguate."""
    if not answers:
        return None

    cleaned = [a.strip() for a in answers if a and a.strip()]
    if not cleaned:
        return None

    # TF/NG
    if _all_match(cleaned, lambda a: a.upper() in TFNG_TOKENS):
        # disambiguate vs YNNG by looking for any YES/NO
        if any(a.upper() in {"YES", "NO"} for a in cleaned):
            return DetectionResult("ynng", 0.95, "answers contain YES/NO/NOT GIVEN")
        return DetectionResult("tfng", 0.95, "answers contain TRUE/FALSE/NOT GIVEN")

    # Y/N/NG
    if _all_match(cleaned, lambda a: a.upper() in YNNG_TOKENS):
        return DetectionResult("ynng", 0.95, "answers contain YES/NO/NOT GIVEN")

    # Matching Headings (lowercase roman numerals)
    if _all_match(cleaned, lambda a: a.lower() in ROMAN_NUMERALS):
        return DetectionResult("matching_headings", 0.95, "answers are roman numerals (i, ii, iii…)")

    # Multi-letter answers (MCQ multi)
    if _all_match(cleaned, lambda a: bool(re.match(r"^[A-J](\s*[,&]\s*[A-J])+$", a.upper()))):
        return DetectionResult("mcq_multi", 0.9, "answers are multiple letters separated by , or &")

    # Single letter A-J — ambiguous (MCQ single OR Matching Information OR Matching Features)
    if _all_match(cleaned, lambda a: bool(re.match(r"^[A-J]$", a.upper()))):
        return DetectionResult(
            "mcq_single", 0.5,
            "single letters — could also be Matching Information / Features",
            needs_confirm=True,
        )

    # Numbers only — usually completion (form, sentence)
    if _all_match(cleaned, lambda a: bool(re.match(r"^[\d.,/:]+$", a))):
        return DetectionResult("sentence_completion", 0.7, "numeric answers — completion")

    # Short text (1–3 words) — completion or short answer (ambiguous)
    if _all_match(cleaned, lambda a: 1 <= len(a.split()) <= 3):
        return DetectionResult(
            "sentence_completion", 0.6,
            "short text answers — completion or short-answer",
            needs_confirm=True,
        )

    # Longer text — short answer
    if _all_match(cleaned, lambda a: 1 <= len(a.split()) <= 6):
        return DetectionResult("short_answer", 0.7, "answers up to 6 words")

    return DetectionResult("unknown", 0.0, "could not infer type from answers", needs_confirm=True)


def detect_question_type(instructions: str, answers: list[str]) -> DetectionResult:
    """
    Main entry point. Tries instruction patterns first, falls back to answer
    patterns. If both available, the instruction match is checked against the
    answer pattern for consistency; if they conflict, lowers confidence.
    """
    instr = instructions or ""

    # PASS 1 — instruction patterns
    for pattern, qtype, reason in INSTRUCTION_PATTERNS:
        if re.search(pattern, instr, re.IGNORECASE | re.DOTALL):
            # Sanity-check against answers
            ans_check = detect_from_answers(answers)
            if ans_check and ans_check.qtype != qtype and ans_check.confidence > 0.8:
                return DetectionResult(
                    qtype=qtype, confidence=0.6,
                    reason=f"{reason}; answers suggest {ans_check.qtype} — please confirm",
                    needs_confirm=True,
                )
            return DetectionResult(qtype, 0.95, reason)

    # PASS 2 — fallback to answer pattern
    fallback = detect_from_answers(answers)
    return fallback or DetectionResult("unknown", 0.0, "no signals", needs_confirm=True)
```

---

# PART 3 — THE SMART PASTE PARSER (READING)

Create `backend/apps/tests/smart_paste/reading_parser.py`:

```python
"""
Parses three pasted blocks (passage, questions, answers) into structured data
ready to create Section + Question rows.

The parser is forgiving: it accepts varied whitespace, paragraph markers,
and answer key formats commonly found in Cambridge IELTS books and PDFs.
"""
import re
from dataclasses import dataclass, field
from typing import Optional
from .detector import detect_question_type, DetectionResult


@dataclass
class ParsedQuestion:
    order: int
    qtype: str
    payload: dict
    answer_key: dict
    detection: DetectionResult
    raw_text: str = ""


@dataclass
class ParsedSection:
    instructions: str
    questions: list[ParsedQuestion] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass
class ParseResult:
    passage_html: str
    passage_word_count: int
    paragraphs: list[str]               # ['A', 'B', 'C', 'D', 'E']
    sections: list[ParsedSection] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def question_count(self) -> int:
        return sum(len(s.questions) for s in self.sections)


# ─────────────────────────────────────────────────────────────────
# PASSAGE PARSING
# ─────────────────────────────────────────────────────────────────

def parse_passage(raw: str) -> tuple[str, list[str], int]:
    """
    Detects paragraph markers (A, B, C…) and returns:
      - HTML with <p data-para='X'> wrappers
      - list of paragraph IDs in order
      - word count

    Recognized formats:
      A  Text starts here…
      A. Text starts here…
      [A]  Text starts here…
      Paragraph A   Text starts here…

    If no markers found, splits by blank lines and auto-labels A, B, C…
    """
    text = raw.strip()
    if not text:
        return ("", [], 0)

    # Try explicit paragraph markers
    pattern = re.compile(
        r"^\s*(?:Paragraph\s+)?\[?([A-Z])\]?[\s\.\)]\s+(.+?)(?=^\s*(?:Paragraph\s+)?\[?[A-Z]\]?[\s\.\)]\s+|\Z)",
        re.MULTILINE | re.DOTALL,
    )
    matches = pattern.findall(text)

    paragraphs: list[tuple[str, str]] = []
    if len(matches) >= 2:
        paragraphs = [(label, body.strip()) for label, body in matches]
    else:
        # Fallback: split by blank lines, auto-label
        chunks = [c.strip() for c in re.split(r"\n\s*\n", text) if c.strip()]
        paragraphs = [(chr(ord("A") + i), body) for i, body in enumerate(chunks)]

    html_parts = []
    para_ids = []
    word_count = 0
    for label, body in paragraphs:
        body_clean = re.sub(r"\s+", " ", body).strip()
        word_count += len(body_clean.split())
        para_ids.append(label)
        html_parts.append(f'<p data-para="{label}"><strong>{label}</strong> {body_clean}</p>')

    return ("\n".join(html_parts), para_ids, word_count)


# ─────────────────────────────────────────────────────────────────
# ANSWER KEY PARSING
# ─────────────────────────────────────────────────────────────────

ANSWER_LINE_RE = re.compile(r"^\s*(\d{1,3})[\.\)\:\s\t]+(.+?)\s*$", re.MULTILINE)


def parse_answer_key(raw: str) -> dict[int, str]:
    """
    Parses common IELTS answer-key formats:
      1   iv
      1.  iv
      1)  iv
      1:  iv
      1   TRUE
      11  A, C
      14  briefcase
    """
    result: dict[int, str] = {}
    for match in ANSWER_LINE_RE.finditer(raw):
        num = int(match.group(1))
        ans = match.group(2).strip()
        if num in result:
            continue   # ignore duplicates
        result[num] = ans
    return result


# ─────────────────────────────────────────────────────────────────
# QUESTIONS BLOCK PARSING
# ─────────────────────────────────────────────────────────────────

# Section header e.g. "Questions 1–5" or "Questions 1-5" or "Questions 1 to 5"
SECTION_HEADER_RE = re.compile(
    r"^\s*Questions?\s+(\d{1,3})\s*[\-–—to]+\s*(\d{1,3})(.*)$",
    re.MULTILINE,
)
# Single question line e.g. "1.  Some text" or "1   Some text"
QUESTION_LINE_RE = re.compile(r"^\s*(\d{1,3})[\.\)]\s+(.+?)$", re.MULTILINE)
# MCQ option line  "A   text"  "A.  text"  "A)  text"
OPTION_LINE_RE = re.compile(r"^\s*([A-J])[\.\)]\s+(.+?)$", re.MULTILINE)
# Heading line in matching headings  "i   The economic impact"
HEADING_LINE_RE = re.compile(r"^\s*(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv)\s+(.+?)$",
                             re.MULTILINE | re.IGNORECASE)


def split_into_question_blocks(questions_raw: str) -> list[tuple[int, int, str, str]]:
    """
    Returns list of (start_q, end_q, header_text, body_text) for each
    'Questions X-Y' block.
    """
    headers = list(SECTION_HEADER_RE.finditer(questions_raw))
    if not headers:
        # Single-block fallback — assume one block covering all questions found
        nums = [int(m.group(1)) for m in QUESTION_LINE_RE.finditer(questions_raw)]
        if nums:
            return [(min(nums), max(nums), "", questions_raw)]
        return []

    blocks = []
    for i, h in enumerate(headers):
        start_q = int(h.group(1))
        end_q = int(h.group(2))
        body_start = h.end()
        body_end = headers[i + 1].start() if i + 1 < len(headers) else len(questions_raw)
        # The instruction header line itself + everything after, until next header
        header_line = h.group(0).strip()
        body_text = header_line + "\n" + questions_raw[body_start:body_end].strip()
        blocks.append((start_q, end_q, header_line, body_text))
    return blocks


def build_payload(qtype: str, q_num: int, body: str, options_pool: list[tuple[str, str]],
                  q_text: str) -> dict:
    """Builds the JSONB payload for a question based on detected type."""
    if qtype in ("tfng", "ynng"):
        return {"statement": q_text}

    if qtype == "mcq_single":
        return {"stem": q_text, "options": [{"id": label, "text": text} for label, text in options_pool]}

    if qtype == "mcq_multi":
        return {"stem": q_text, "options": [{"id": label, "text": text} for label, text in options_pool], "select_count": 2}

    if qtype in ("matching_info", "matching_features", "matching_endings"):
        return {
            "items": [{"id": q_num, "text": q_text}],
            "options": [{"id": label, "text": text} for label, text in options_pool],
            "options_can_repeat": True,
        }

    if qtype == "sentence_completion":
        return {"template": q_text, "word_limit": 2, "case_sensitive": False}

    if qtype == "short_answer":
        return {"stem": q_text, "word_limit": 3}

    if qtype == "summary_completion":
        return {"template": q_text, "word_limit": 2, "case_sensitive": False}

    return {"raw": q_text}


def build_answer_key(qtype: str, q_num: int, raw_answer: str) -> dict:
    """Builds the answer_key JSONB based on type."""
    a = raw_answer.strip()

    if qtype == "tfng":
        return {"answer": a.upper()}

    if qtype == "ynng":
        return {"answer": a.upper()}

    if qtype == "mcq_single":
        return {"answer": a.upper()}

    if qtype == "mcq_multi":
        parts = re.split(r"[,&\s]+", a.upper())
        return {"answers": [p for p in parts if p]}

    if qtype in ("matching_headings", "matching_info", "matching_features", "matching_endings"):
        return {"matches": {str(q_num): a}}

    if qtype in ("sentence_completion", "short_answer", "summary_completion", "form_completion"):
        # Allow alternate answers separated by " / " or " OR "
        alternates = re.split(r"\s*(?:/| OR )\s*", a)
        return {"blanks": [alternates]} if qtype != "short_answer" else {"answers": alternates}

    return {"raw": a}


def parse_questions_block(
    block_text: str,
    answer_map: dict[int, str],
) -> ParsedSection:
    """
    Parses a single 'Questions X-Y' block into a ParsedSection.
    """
    section = ParsedSection(instructions=block_text.split("\n", 1)[0])

    # Extract list of MCQ options / matching options if present
    options_pool: list[tuple[str, str]] = OPTION_LINE_RE.findall(block_text)
    headings_pool: list[tuple[str, str]] = HEADING_LINE_RE.findall(block_text)

    # Extract individual numbered questions
    q_matches = list(QUESTION_LINE_RE.finditer(block_text))

    # Detect type for the whole block based on instructions + first answer
    sample_answers = []
    for m in q_matches[:3]:
        qn = int(m.group(1))
        if qn in answer_map:
            sample_answers.append(answer_map[qn])

    block_detection = detect_question_type(section.instructions, sample_answers)

    # Special case: Matching Headings is ONE meta-question per group
    if block_detection.qtype == "matching_headings":
        # Build a single ParsedQuestion that represents the entire group
        all_nums = [int(m.group(1)) for m in q_matches]
        if not all_nums:
            section.warnings.append("Matching Headings block has no question numbers")
            return section

        first_num = min(all_nums)
        # Each numbered line in this block corresponds to a paragraph (e.g. "14 Paragraph B")
        paragraph_targets = []
        for m in q_matches:
            qn = int(m.group(1))
            text = m.group(2).strip()
            # Try to extract paragraph label  e.g. "Paragraph B" → "B"
            para_match = re.search(r"\bParagraph\s+([A-Z])\b", text, re.IGNORECASE)
            para_label = para_match.group(1).upper() if para_match else None
            paragraph_targets.append({"q_num": qn, "para": para_label})

        matches = {}
        for pt in paragraph_targets:
            if pt["q_num"] in answer_map and pt["para"]:
                matches[pt["para"]] = answer_map[pt["q_num"]].strip()

        payload = {
            "headings": [{"id": h_id, "text": h_text} for h_id, h_text in headings_pool],
            "paragraphs": [pt["para"] for pt in paragraph_targets if pt["para"]],
        }
        answer_key = {"matches": matches}

        section.questions.append(ParsedQuestion(
            order=first_num,
            qtype="matching_headings",
            payload=payload,
            answer_key=answer_key,
            detection=block_detection,
            raw_text=block_text,
        ))
        if not headings_pool:
            section.warnings.append("Matching Headings block has no roman-numeral headings list")
        return section

    # Generic per-question handling
    for m in q_matches:
        qn = int(m.group(1))
        q_text = m.group(2).strip()
        # Strip option lines from question text if they're glued in
        q_text = re.sub(r"\n\s*[A-J][\.\)]\s+.+", "", q_text).strip()

        raw_ans = answer_map.get(qn)
        if raw_ans is None:
            section.warnings.append(f"Q{qn}: no answer found in answer key")
            qtype = block_detection.qtype
            answer_key = {}
        else:
            # Per-question detection (in case a block mixes types — rare)
            per_q_det = detect_question_type(section.instructions, [raw_ans])
            qtype = per_q_det.qtype if per_q_det.confidence >= 0.85 else block_detection.qtype
            answer_key = build_answer_key(qtype, qn, raw_ans)

        payload = build_payload(qtype, qn, block_text, options_pool, q_text)

        section.questions.append(ParsedQuestion(
            order=qn,
            qtype=qtype,
            payload=payload,
            answer_key=answer_key,
            detection=block_detection,
            raw_text=q_text,
        ))

    return section


# ─────────────────────────────────────────────────────────────────
# TOP-LEVEL ENTRY
# ─────────────────────────────────────────────────────────────────

def parse_reading(passage: str, questions: str, answers: str) -> ParseResult:
    result = ParseResult(passage_html="", passage_word_count=0, paragraphs=[])

    if not passage.strip():
        result.errors.append("Passage is empty")
    if not questions.strip():
        result.errors.append("Questions block is empty")
    if not answers.strip():
        result.errors.append("Answer key is empty")
    if result.errors:
        return result

    # Parse passage
    html, paras, wc = parse_passage(passage)
    result.passage_html = html
    result.paragraphs = paras
    result.passage_word_count = wc

    # Parse answers
    answer_map = parse_answer_key(answers)
    if not answer_map:
        result.errors.append("No answer-key entries detected. Use format like '1   iv' on each line.")
        return result

    # Split questions into blocks and parse each
    blocks = split_into_question_blocks(questions)
    if not blocks:
        result.errors.append("No question blocks found. Use 'Questions X-Y' headers.")
        return result

    declared_q_numbers = set()
    for start_q, end_q, header, body in blocks:
        section = parse_questions_block(body, answer_map)
        result.sections.append(section)
        for q in section.questions:
            declared_q_numbers.add(q.order)

    # Cross-check answer count vs question count
    extra_answers = set(answer_map.keys()) - declared_q_numbers
    missing_answers = declared_q_numbers - set(answer_map.keys())
    if extra_answers:
        result.warnings.append(f"Answer key has answers for unmatched questions: {sorted(extra_answers)}")
    if missing_answers:
        result.warnings.append(f"Questions without answers: {sorted(missing_answers)}")

    return result
```

---

# PART 4 — THE SMART PASTE PARSER (LISTENING)

Listening differs from Reading in three ways:
1. **Audio file upload** instead of passage paste
2. **Transcript** is optional (used for audio QC, not shown to student)
3. **Four sections** with question numbers 1–10, 11–20, 21–30, 31–40

Create `backend/apps/tests/smart_paste/listening_parser.py`:

```python
"""
Listening parser. Reuses the question parsing from reading_parser
but expects 4 sections.
"""
from .reading_parser import (
    parse_answer_key,
    split_into_question_blocks,
    parse_questions_block,
    ParseResult,
    ParsedSection,
)


def parse_listening(transcript: str, questions: str, answers: str) -> ParseResult:
    """
    Returns a ParseResult with 4 ParsedSections (one per Listening section).
    transcript is stored in AudioBank.transcript; not parsed for content.
    """
    result = ParseResult(passage_html=transcript or "", passage_word_count=0, paragraphs=[])

    if not questions.strip():
        result.errors.append("Questions block is empty")
        return result
    if not answers.strip():
        result.errors.append("Answer key is empty")
        return result

    answer_map = parse_answer_key(answers)
    if not answer_map:
        result.errors.append("No answer-key entries detected.")
        return result

    blocks = split_into_question_blocks(questions)
    if not blocks:
        result.errors.append("No 'Questions X-Y' headers found.")
        return result

    # Group blocks into 4 listening sections by question number ranges
    SECTION_RANGES = [(1, 10), (11, 20), (21, 30), (31, 40)]
    sections: dict[int, ParsedSection] = {i: ParsedSection(instructions=f"Section {i + 1}") for i in range(4)}

    for start_q, end_q, header, body in blocks:
        # Decide which section by start_q
        for idx, (lo, hi) in enumerate(SECTION_RANGES):
            if lo <= start_q <= hi:
                parsed = parse_questions_block(body, answer_map)
                # Merge questions into the right section
                sections[idx].questions.extend(parsed.questions)
                sections[idx].warnings.extend(parsed.warnings)
                if not sections[idx].instructions or sections[idx].instructions.startswith("Section "):
                    sections[idx].instructions = parsed.instructions
                break
        else:
            result.warnings.append(f"Block 'Questions {start_q}-{end_q}' is outside Listening 1–40 range.")

    result.sections = [sections[i] for i in range(4) if sections[i].questions]
    return result
```

---

# PART 5 — THE SMART PASTE PARSER (WRITING / SPEAKING)

Writing and Speaking don't use answer keys. They're mostly prompts.

Create `backend/apps/tests/smart_paste/writing_speaking_parser.py`:

```python
"""
Writing parser:
  - Task 1: prompt + chart image (uploaded separately)
  - Task 2: prompt only

Speaking parser:
  - Part 1: list of questions
  - Part 2: cue card with bullets
  - Part 3: list of questions
"""
import re
from .reading_parser import ParseResult, ParsedSection, ParsedQuestion
from .detector import detect_question_type


def parse_writing(task1_prompt: str, task2_prompt: str, task1_image_url: str = "") -> ParseResult:
    result = ParseResult(passage_html="", passage_word_count=0, paragraphs=[])

    if task1_prompt.strip():
        section = ParsedSection(instructions="Writing Task 1 — 20 minutes, at least 150 words")
        section.questions.append(ParsedQuestion(
            order=1,
            qtype="writing_task1",
            payload={
                "prompt": task1_prompt.strip(),
                "min_words": 150,
                "time_minutes": 20,
                "image_url": task1_image_url,
            },
            answer_key={},
            detection=detect_question_type(task1_prompt, []),
            raw_text=task1_prompt,
        ))
        result.sections.append(section)

    if task2_prompt.strip():
        section = ParsedSection(instructions="Writing Task 2 — 40 minutes, at least 250 words")
        section.questions.append(ParsedQuestion(
            order=2,
            qtype="writing_task2",
            payload={
                "prompt": task2_prompt.strip(),
                "min_words": 250,
                "time_minutes": 40,
            },
            answer_key={},
            detection=detect_question_type(task2_prompt, []),
            raw_text=task2_prompt,
        ))
        result.sections.append(section)

    if not result.sections:
        result.errors.append("Both Writing tasks are empty")
    return result


CUE_CARD_BULLET_RE = re.compile(r"^\s*[\-•·]\s*(.+)$", re.MULTILINE)


def parse_speaking(part1: str, part2: str, part3: str) -> ParseResult:
    result = ParseResult(passage_html="", passage_word_count=0, paragraphs=[])

    def extract_questions(raw: str) -> list[str]:
        # Lines starting with a number, dash, or bullet
        lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
        cleaned = []
        for ln in lines:
            ln = re.sub(r"^\d+[\.\)]\s*", "", ln)
            ln = re.sub(r"^[\-•·]\s*", "", ln)
            if ln:
                cleaned.append(ln)
        return cleaned

    if part1.strip():
        questions = extract_questions(part1)
        section = ParsedSection(instructions="Speaking Part 1 — Introduction and interview, 4–5 minutes")
        section.questions.append(ParsedQuestion(
            order=1,
            qtype="speaking_p1",
            payload={"questions": questions},
            answer_key={},
            detection=None,
            raw_text=part1,
        ))
        result.sections.append(section)

    if part2.strip():
        # First non-empty paragraph is the topic; bullet lines are the prompts
        lines = [ln.strip() for ln in part2.splitlines() if ln.strip()]
        topic = lines[0] if lines else "Describe a memorable experience"
        bullets = CUE_CARD_BULLET_RE.findall(part2)
        section = ParsedSection(instructions="Speaking Part 2 — Long turn, 1–2 minutes (1 minute prep)")
        section.questions.append(ParsedQuestion(
            order=2,
            qtype="speaking_p2",
            payload={
                "topic": topic,
                "bullets": bullets,
                "prep_seconds": 60,
                "talk_seconds": 120,
            },
            answer_key={},
            detection=None,
            raw_text=part2,
        ))
        result.sections.append(section)

    if part3.strip():
        questions = extract_questions(part3)
        section = ParsedSection(instructions="Speaking Part 3 — Discussion, 4–5 minutes")
        section.questions.append(ParsedQuestion(
            order=3,
            qtype="speaking_p3",
            payload={"questions": questions},
            answer_key={},
            detection=None,
            raw_text=part3,
        ))
        result.sections.append(section)

    if not result.sections:
        result.errors.append("All Speaking parts are empty")
    return result
```

---

# PART 6 — WORD .DOCX IMPORTER

Many teachers have IELTS materials in Word documents. Parse them into the same `ParseResult`.

Install `python-docx`:
```bash
cd backend
pip install python-docx --break-system-packages
echo "python-docx==1.1.2" >> requirements.txt
```

Create `backend/apps/tests/smart_paste/docx_importer.py`:

```python
"""
Parses a .docx file containing an IELTS test.

Strategy:
  1. Extract all text in document order.
  2. Detect transitions between PASSAGE / QUESTIONS / ANSWER KEY blocks
     using fixed marker lines (case-insensitive):
        --- PASSAGE ---
        --- QUESTIONS ---
        --- ANSWER KEY ---
     If markers are absent, try heuristics:
        - first 'Questions 1' header marks start of QUESTIONS block
        - first 'Answer Key' or 'ANSWERS' header marks start of ANSWER KEY block
        - everything before is PASSAGE
  3. Pass the three blocks through the corresponding paragraph parsers.
  4. Extract embedded images and store them; replace inline references with URLs.
"""
import io
import os
import uuid
import zipfile
from pathlib import Path
import re
from django.conf import settings
from docx import Document
from .reading_parser import parse_reading, ParseResult


MARKER_PASSAGE = re.compile(r"^---\s*PASSAGE\s*---\s*$", re.IGNORECASE)
MARKER_QUESTIONS = re.compile(r"^---\s*QUESTIONS\s*---\s*$", re.IGNORECASE)
MARKER_ANSWER_KEY = re.compile(r"^---\s*ANSWER\s*KEY\s*---\s*$", re.IGNORECASE)
HEUR_QUESTIONS_START = re.compile(r"^\s*Questions?\s+1\s*[\-–—to]+\s*\d+", re.IGNORECASE)
HEUR_ANSWER_KEY_START = re.compile(r"^\s*(Answer\s*Key|ANSWERS?)\s*$", re.IGNORECASE)


def extract_images(docx_path: str, target_subdir: str) -> dict[str, str]:
    """
    Extracts embedded images from a .docx file (which is a zip).
    Returns mapping image_id → media URL.
    """
    out_dir_abs = Path(settings.MEDIA_ROOT) / target_subdir
    out_dir_abs.mkdir(parents=True, exist_ok=True)
    mapping = {}
    with zipfile.ZipFile(docx_path) as z:
        for name in z.namelist():
            if name.startswith("word/media/"):
                base = os.path.basename(name)
                with z.open(name) as src:
                    target_abs = out_dir_abs / base
                    with open(target_abs, "wb") as dst:
                        dst.write(src.read())
                rel_url = f"{settings.MEDIA_URL}{target_subdir}/{base}".replace("//", "/")
                if not rel_url.startswith("/"):
                    rel_url = "/" + rel_url
                mapping[base] = rel_url
    return mapping


def docx_to_text(docx_path: str) -> str:
    doc = Document(docx_path)
    lines = []
    for para in doc.paragraphs:
        text = para.text.rstrip()
        lines.append(text)
    # Tables: flatten as tab-separated rows
    for table in doc.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells]
            lines.append(" | ".join(cells))
    return "\n".join(lines)


def split_blocks(full_text: str) -> tuple[str, str, str]:
    """Returns (passage, questions, answer_key) blocks."""
    lines = full_text.splitlines()
    passage_lines, questions_lines, answer_lines = [], [], []
    current = "passage"
    found_marker = False

    for ln in lines:
        if MARKER_PASSAGE.match(ln):
            current = "passage"; found_marker = True; continue
        if MARKER_QUESTIONS.match(ln):
            current = "questions"; found_marker = True; continue
        if MARKER_ANSWER_KEY.match(ln):
            current = "answers"; found_marker = True; continue
        if current == "passage":
            passage_lines.append(ln)
        elif current == "questions":
            questions_lines.append(ln)
        else:
            answer_lines.append(ln)

    if found_marker:
        return ("\n".join(passage_lines).strip(),
                "\n".join(questions_lines).strip(),
                "\n".join(answer_lines).strip())

    # Heuristic fallback
    passage_lines, questions_lines, answer_lines = [], [], []
    current = "passage"
    for ln in lines:
        if current == "passage" and HEUR_QUESTIONS_START.match(ln):
            current = "questions"
        elif current == "questions" and HEUR_ANSWER_KEY_START.match(ln):
            current = "answers"
            continue
        if current == "passage":
            passage_lines.append(ln)
        elif current == "questions":
            questions_lines.append(ln)
        else:
            answer_lines.append(ln)
    return ("\n".join(passage_lines).strip(),
            "\n".join(questions_lines).strip(),
            "\n".join(answer_lines).strip())


def import_docx(docx_path: str) -> ParseResult:
    """Top-level entry. Extracts text + images, parses, returns ParseResult."""
    full_text = docx_to_text(docx_path)
    image_map = extract_images(docx_path, target_subdir=f"smartpaste/{uuid.uuid4()}")

    passage_block, questions_block, answers_block = split_blocks(full_text)

    if not (questions_block and answers_block):
        result = ParseResult(passage_html="", passage_word_count=0, paragraphs=[])
        result.errors.append(
            "Could not detect QUESTIONS or ANSWER KEY block in the document. "
            "Add markers like '--- PASSAGE ---', '--- QUESTIONS ---', '--- ANSWER KEY ---' "
            "or a 'Questions 1-13' header followed by 'Answer Key' header."
        )
        return result

    result = parse_reading(passage_block, questions_block, answers_block)

    # Attach extracted images to result for the admin to assign manually
    if image_map:
        result.warnings.append(
            f"Found {len(image_map)} embedded images. Assign them to questions in the preview step."
        )
        # Stash for the calling view to use
        result._extracted_images = list(image_map.values())  # type: ignore

    return result
```

---

# PART 7 — EXCEL TEMPLATE IMPORTER

Power users with large question banks want Excel.

Install `openpyxl`:
```bash
pip install openpyxl --break-system-packages
echo "openpyxl==3.1.5" >> requirements.txt
```

Create `backend/apps/tests/smart_paste/excel_importer.py`:

```python
"""
Excel template format (sheet 'Test'):

| section_kind | section_order | passage_or_audio_url | q_order | q_type             | q_text                       | options              | answer        |
|--------------|---------------|----------------------|---------|--------------------|------------------------------|----------------------|---------------|
| reading      | 1             | (paste or url)       | 1       | tfng               | The author claims X.         |                      | TRUE          |
| reading      | 1             |                      | 2       | matching_headings  | Paragraph B                  | i:Heading 1\|ii:H2   | iv            |
| reading      | 1             |                      | 3       | mcq_single         | What is X?                   | A:Foo\|B:Bar\|C:Baz  | B             |
| listening    | 1             | https://.../audio.mp3| 1       | sentence_completion| The meeting is on {{1}}      |                      | Tuesday       |

A second sheet 'Passages' can contain reusable passages:
| key | title | body | source |
"""
import openpyxl
from openpyxl.workbook import Workbook
from .reading_parser import (
    ParseResult, ParsedSection, ParsedQuestion,
    build_payload, build_answer_key,
)
from .detector import DetectionResult


COLUMNS = [
    "section_kind", "section_order", "content_url",
    "q_order", "q_type", "q_text", "options", "answer",
]


def generate_template_xlsx(filepath: str) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Test"
    ws.append(COLUMNS)
    # Sample rows
    ws.append(["reading", 1, "", 1, "tfng",
               "The author claims X is true.", "", "TRUE"])
    ws.append(["reading", 1, "", 2, "mcq_single",
               "What is the capital?", "A:Paris|B:Berlin|C:Madrid|D:Rome", "A"])
    ws.append(["reading", 1, "", 3, "sentence_completion",
               "The first lesson starts on {{1}}.", "", "Monday"])
    ws.append([])
    ws.append(["# Use 'matching_headings' for groups; one row per paragraph,",
               "all rows in the same section_order.", "", "", "", "", "", ""])
    wb.save(filepath)


def parse_excel(file_path: str) -> ParseResult:
    wb = openpyxl.load_workbook(file_path, data_only=True)
    if "Test" not in wb.sheetnames:
        result = ParseResult(passage_html="", passage_word_count=0, paragraphs=[])
        result.errors.append("Workbook must have a 'Test' sheet.")
        return result

    ws = wb["Test"]
    rows = list(ws.iter_rows(values_only=True))
    if not rows or rows[0][:len(COLUMNS)] != tuple(COLUMNS):
        result = ParseResult(passage_html="", passage_word_count=0, paragraphs=[])
        result.errors.append(f"First row must be: {' | '.join(COLUMNS)}")
        return result

    result = ParseResult(passage_html="", passage_word_count=0, paragraphs=[])
    sections_by_order: dict[int, ParsedSection] = {}

    for i, row in enumerate(rows[1:], start=2):
        if not row or not row[0] or (isinstance(row[0], str) and row[0].startswith("#")):
            continue

        kind, sec_order, content_url, q_order, q_type, q_text, options, answer = row[:8]

        sec_key = int(sec_order) if sec_order else 1
        if sec_key not in sections_by_order:
            sections_by_order[sec_key] = ParsedSection(
                instructions=f"{(kind or 'reading').title()} Section {sec_key}",
            )
        sec = sections_by_order[sec_key]

        # Parse options "A:Foo|B:Bar"
        opts: list[tuple[str, str]] = []
        if options:
            for piece in str(options).split("|"):
                if ":" in piece:
                    a, b = piece.split(":", 1)
                    opts.append((a.strip(), b.strip()))

        qtype = (q_type or "").strip()
        payload = build_payload(qtype, int(q_order or 1), str(q_text or ""), opts, str(q_text or ""))
        akey = build_answer_key(qtype, int(q_order or 1), str(answer or ""))

        sec.questions.append(ParsedQuestion(
            order=int(q_order or 1),
            qtype=qtype,
            payload=payload,
            answer_key=akey,
            detection=DetectionResult(qtype, 1.0, "explicit from Excel"),
            raw_text=str(q_text or ""),
        ))

    result.sections = [sections_by_order[k] for k in sorted(sections_by_order.keys())]
    if not result.sections:
        result.errors.append("No data rows found in the Excel sheet.")
    return result
```

---

# PART 8 — BACKEND API ENDPOINTS

Add to `backend/apps/tests/urls.py`:

```python
from django.urls import path
from .views_smart_paste import (
    SmartPastePreviewView,
    SmartPasteCreateView,
    SmartPasteDocxImportView,
    SmartPasteExcelImportView,
    SmartPasteExcelTemplateView,
)

urlpatterns = [
    # ... existing ETAP 22 endpoints if any ...
    path("smart-paste/preview/", SmartPastePreviewView.as_view(), name="smart-paste-preview"),
    path("smart-paste/create/", SmartPasteCreateView.as_view(), name="smart-paste-create"),
    path("smart-paste/import-docx/", SmartPasteDocxImportView.as_view(), name="smart-paste-docx"),
    path("smart-paste/import-excel/", SmartPasteExcelImportView.as_view(), name="smart-paste-excel"),
    path("smart-paste/excel-template.xlsx", SmartPasteExcelTemplateView.as_view(), name="smart-paste-template"),
]
```

Create `backend/apps/tests/views_smart_paste.py`:

```python
import os
import tempfile
import uuid
from dataclasses import asdict
from django.http import FileResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Test, Section, Question, PassageBank, AudioBank
from .smart_paste.reading_parser import parse_reading
from .smart_paste.listening_parser import parse_listening
from .smart_paste.writing_speaking_parser import parse_writing, parse_speaking
from .smart_paste.docx_importer import import_docx
from .smart_paste.excel_importer import parse_excel, generate_template_xlsx


def _serialize_parse_result(pr) -> dict:
    """Converts dataclasses to JSON-serializable dict for the frontend preview."""
    return {
        "passage_html": pr.passage_html,
        "passage_word_count": pr.passage_word_count,
        "paragraphs": pr.paragraphs,
        "question_count": pr.question_count,
        "warnings": pr.warnings,
        "errors": pr.errors,
        "sections": [
            {
                "instructions": s.instructions,
                "warnings": s.warnings,
                "questions": [
                    {
                        "order": q.order,
                        "qtype": q.qtype,
                        "payload": q.payload,
                        "answer_key": q.answer_key,
                        "raw_text": q.raw_text,
                        "detection": (asdict(q.detection) if q.detection else None),
                    } for q in s.questions
                ],
            } for s in pr.sections
        ],
    }


class SmartPastePreviewView(APIView):
    """Parses without saving — used for live preview in the UI."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        mode = request.data.get("mode")     # 'reading' | 'listening' | 'writing' | 'speaking'

        if mode == "reading":
            pr = parse_reading(
                request.data.get("passage", ""),
                request.data.get("questions", ""),
                request.data.get("answers", ""),
            )
        elif mode == "listening":
            pr = parse_listening(
                request.data.get("transcript", ""),
                request.data.get("questions", ""),
                request.data.get("answers", ""),
            )
        elif mode == "writing":
            pr = parse_writing(
                request.data.get("task1_prompt", ""),
                request.data.get("task2_prompt", ""),
                request.data.get("task1_image_url", ""),
            )
        elif mode == "speaking":
            pr = parse_speaking(
                request.data.get("part1", ""),
                request.data.get("part2", ""),
                request.data.get("part3", ""),
            )
        else:
            return Response({"error": "Invalid mode"}, status=status.HTTP_400_BAD_REQUEST)

        return Response(_serialize_parse_result(pr))


class SmartPasteCreateView(APIView):
    """Parses AND creates the Test/Section/Question records as a draft."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        title = request.data.get("title") or "Untitled Test"
        test_type = request.data.get("test_type", "reading")
        module = request.data.get("module", "academic")
        mode = request.data.get("mode")

        # Run the right parser
        if mode == "reading":
            pr = parse_reading(
                request.data.get("passage", ""),
                request.data.get("questions", ""),
                request.data.get("answers", ""),
            )
        elif mode == "listening":
            pr = parse_listening(
                request.data.get("transcript", ""),
                request.data.get("questions", ""),
                request.data.get("answers", ""),
            )
        elif mode == "writing":
            pr = parse_writing(
                request.data.get("task1_prompt", ""),
                request.data.get("task2_prompt", ""),
                request.data.get("task1_image_url", ""),
            )
        elif mode == "speaking":
            pr = parse_speaking(
                request.data.get("part1", ""),
                request.data.get("part2", ""),
                request.data.get("part3", ""),
            )
        else:
            return Response({"error": "Invalid mode"}, status=status.HTTP_400_BAD_REQUEST)

        if pr.errors:
            return Response({"errors": pr.errors, "preview": _serialize_parse_result(pr)},
                            status=status.HTTP_400_BAD_REQUEST)

        # Create the Test
        test = Test.objects.create(
            organization=getattr(request, "organization", None),
            title=title,
            type=test_type,
            module=module,
            status=Test.Status.DRAFT,
            created_by=request.user,
            creation_method="smart_paste",
        )

        # Reading: one passage shared across all sections
        passage = None
        if mode == "reading" and pr.passage_html:
            passage = PassageBank.objects.create(
                organization=getattr(request, "organization", None),
                title=title,
                body_html=pr.passage_html,
                word_count=pr.passage_word_count,
                created_by=request.user,
            )

        # Listening: optional audio file from request.FILES
        audio = None
        if mode == "listening" and "audio_file" in request.FILES:
            audio = AudioBank.objects.create(
                organization=getattr(request, "organization", None),
                title=title,
                file=request.FILES["audio_file"],
                transcript=request.data.get("transcript", ""),
                created_by=request.user,
            )

        # Build sections + questions
        for sec_idx, parsed_section in enumerate(pr.sections):
            kind_map = {
                "reading": "reading",
                "listening": "listening",
                "writing": "writing",
                "speaking": "speaking",
            }
            section = Section.objects.create(
                test=test,
                order=sec_idx + 1,
                kind=kind_map[mode],
                instructions=parsed_section.instructions,
                passage=passage if mode == "reading" else None,
                audio=audio if mode == "listening" else None,
            )
            for pq in parsed_section.questions:
                Question.objects.create(
                    section=section,
                    order=pq.order,
                    type=pq.qtype,
                    points=1,
                    payload=pq.payload,
                    answer_key=pq.answer_key,
                )

        return Response({
            "test_id": str(test.id),
            "warnings": pr.warnings,
            "edit_url": f"/center/tests/{test.id}/edit",
            "preview_url": f"/center/tests/{test.id}/preview",
        }, status=status.HTTP_201_CREATED)


class SmartPasteDocxImportView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return Response({"error": "No file uploaded"}, status=400)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmp:
            for chunk in upload.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name

        try:
            pr = import_docx(tmp_path)
        finally:
            os.unlink(tmp_path)

        # The frontend will call SmartPasteCreateView next with the parsed pieces.
        # For simplicity here, return the preview only.
        return Response(_serialize_parse_result(pr))


class SmartPasteExcelImportView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return Response({"error": "No file uploaded"}, status=400)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
            for chunk in upload.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name

        try:
            pr = parse_excel(tmp_path)
        finally:
            os.unlink(tmp_path)

        return Response(_serialize_parse_result(pr))


class SmartPasteExcelTemplateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
        tmp.close()
        generate_template_xlsx(tmp.name)
        return FileResponse(
            open(tmp.name, "rb"),
            as_attachment=True,
            filename="ildiz-mock-test-template.xlsx",
        )
```

---

# PART 9 — FRONTEND ROUTES

Add to `frontend/src/App.tsx`:

```tsx
<Route path="/center/tests/new" element={<NewTestModeSelector />} />
<Route path="/center/tests/new/smart-paste" element={<SmartPasteEditor />} />
<Route path="/center/tests/new/import-docx" element={<DocxImportPage />} />
<Route path="/center/tests/new/import-excel" element={<ExcelImportPage />} />
<Route path="/center/tests/new/wizard" element={<TestWizard mode="create" />} />
```

---

# PART 10 — FRONTEND: MODE SELECTOR

`frontend/src/pages/center/tests/NewTestModeSelector.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';

interface ModeCard {
  to: string;
  emoji: string;
  title: string;
  blurb: string;
  time: string;
  recommended?: boolean;
}

const MODES: ModeCard[] = [
  {
    to: '/center/tests/new/smart-paste',
    emoji: '📋',
    title: 'Smart Paste',
    blurb: 'Paste passage, questions, and answer key. We detect everything automatically.',
    time: '5–8 min per test',
    recommended: true,
  },
  {
    to: '/center/tests/new/import-docx',
    emoji: '📄',
    title: 'Word Document',
    blurb: 'Upload a .docx file with your test content and embedded images.',
    time: '~5 min per test',
  },
  {
    to: '/center/tests/new/import-excel',
    emoji: '📊',
    title: 'Excel Template',
    blurb: 'Bulk-add many tests from our spreadsheet template.',
    time: '~3 min per test',
  },
  {
    to: '/center/tests/new/wizard',
    emoji: '✏️',
    title: 'Manual Wizard',
    blurb: 'Build question by question with full control. Use for unusual question types.',
    time: '45–60 min per test',
  },
];

export default function NewTestModeSelector() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Create a new test</h1>
      <p className="mt-1 text-gray-600">Pick the fastest method for the materials you have.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {MODES.map((m) => (
          <button
            key={m.to}
            onClick={() => navigate(m.to)}
            className="relative flex flex-col items-start gap-2 rounded-xl border border-gray-200 bg-white p-5 text-left transition hover:border-blue-500 hover:shadow-md"
          >
            {m.recommended && (
              <span className="absolute right-4 top-4 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                Recommended
              </span>
            )}
            <span className="text-3xl">{m.emoji}</span>
            <h2 className="text-lg font-semibold">{m.title}</h2>
            <p className="text-sm text-gray-600">{m.blurb}</p>
            <span className="mt-auto text-xs font-medium text-gray-500">{m.time}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

# PART 11 — FRONTEND: SMART PASTE EDITOR

`frontend/src/pages/center/tests/SmartPasteEditor.tsx`:

```tsx
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { LivePreview } from '@/components/smart-paste/LivePreview';

type Mode = 'reading' | 'listening' | 'writing' | 'speaking';

export default function SmartPasteEditor() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<Mode>('reading');
  const [module, setModule] = useState<'academic' | 'general'>('academic');

  // Reading
  const [passage, setPassage] = useState('');
  // Listening
  const [transcript, setTranscript] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  // Writing
  const [task1Prompt, setTask1Prompt] = useState('');
  const [task2Prompt, setTask2Prompt] = useState('');
  // Speaking
  const [part1, setPart1] = useState('');
  const [part2, setPart2] = useState('');
  const [part3, setPart3] = useState('');
  // Shared
  const [questions, setQuestions] = useState('');
  const [answers, setAnswers] = useState('');

  const formData = useMemo(() => ({
    mode, passage, transcript, questions, answers,
    task1_prompt: task1Prompt, task2_prompt: task2Prompt,
    part1, part2, part3,
  }), [mode, passage, transcript, questions, answers, task1Prompt, task2Prompt, part1, part2, part3]);

  const debounced = useDebouncedValue(formData, 800);

  const previewMutation = useMutation({
    mutationFn: (data: any) => api.post('/admin/smart-paste/preview/', data),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      Object.entries(formData).forEach(([k, v]) => fd.append(k, v as string));
      fd.append('title', title);
      fd.append('test_type', mode);
      fd.append('module', module);
      if (audioFile) fd.append('audio_file', audioFile);
      return api.post('/admin/smart-paste/create/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: (resp: any) => {
      navigate(resp.data.edit_url);
    },
  });

  // Trigger preview on debounced change
  useMemo(() => {
    if (mode === 'reading' && (debounced.passage || debounced.questions || debounced.answers)) {
      previewMutation.mutate(debounced);
    } else if (mode === 'listening' && (debounced.questions || debounced.answers)) {
      previewMutation.mutate(debounced);
    } else if (mode === 'writing' && (debounced.task1_prompt || debounced.task2_prompt)) {
      previewMutation.mutate(debounced);
    } else if (mode === 'speaking' && (debounced.part1 || debounced.part2 || debounced.part3)) {
      previewMutation.mutate(debounced);
    }
  }, [debounced, mode]);

  const preview = previewMutation.data?.data;

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/center/tests/new')} className="text-gray-500 hover:text-gray-700">
            ←
          </button>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Test title (e.g. Cambridge IELTS 17 Test 2)"
            className="w-96 border-b border-transparent bg-transparent text-lg font-medium focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className="rounded border px-3 py-1.5 text-sm">
            <option value="reading">Reading</option>
            <option value="listening">Listening</option>
            <option value="writing">Writing</option>
            <option value="speaking">Speaking</option>
          </select>
          <select value={module} onChange={(e) => setModule(e.target.value as any)} className="rounded border px-3 py-1.5 text-sm">
            <option value="academic">Academic</option>
            <option value="general">General Training</option>
          </select>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !title || !preview || preview.errors?.length > 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300"
          >
            {createMutation.isPending ? 'Creating…' : 'Save and Open'}
          </button>
        </div>
      </header>

      {/* Body — three columns: paste areas (left) and live preview (right) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Paste areas */}
        <div className="w-1/2 overflow-auto border-r bg-gray-50 p-6">
          {mode === 'reading' && (
            <ReadingPasteForm
              passage={passage} setPassage={setPassage}
              questions={questions} setQuestions={setQuestions}
              answers={answers} setAnswers={setAnswers}
            />
          )}
          {mode === 'listening' && (
            <ListeningPasteForm
              audioFile={audioFile} setAudioFile={setAudioFile}
              transcript={transcript} setTranscript={setTranscript}
              questions={questions} setQuestions={setQuestions}
              answers={answers} setAnswers={setAnswers}
            />
          )}
          {mode === 'writing' && (
            <WritingPasteForm
              t1={task1Prompt} setT1={setTask1Prompt}
              t2={task2Prompt} setT2={setTask2Prompt}
            />
          )}
          {mode === 'speaking' && (
            <SpeakingPasteForm
              p1={part1} setP1={setPart1}
              p2={part2} setP2={setPart2}
              p3={part3} setP3={setPart3}
            />
          )}
        </div>

        {/* Live preview */}
        <div className="w-1/2 overflow-auto p-6">
          <LivePreview preview={preview} loading={previewMutation.isPending} />
        </div>
      </div>
    </div>
  );
}

/* ─────────── Sub-forms ─────────── */

function PasteArea({ label, hint, value, onChange, rows = 12 }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; rows?: number;
}) {
  return (
    <div className="mb-5">
      <label className="mb-1 flex items-center justify-between">
        <span className="font-medium text-gray-900">{label}</span>
        <span className="text-xs text-gray-500">{value.length} chars</span>
      </label>
      {hint && <p className="mb-2 text-xs text-gray-500">{hint}</p>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        spellCheck={false}
        className="w-full rounded-lg border border-gray-300 bg-white p-3 font-mono text-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}

function ReadingPasteForm(props: any) {
  return (
    <>
      <PasteArea
        label="📖 Passage"
        hint="Paste full reading passage. Paragraphs will be auto-detected (A, B, C…) or label them yourself."
        value={props.passage} onChange={props.setPassage} rows={14}
      />
      <PasteArea
        label="❓ Questions"
        hint="Paste the questions block. Use 'Questions 1-5: ...' headers as in Cambridge IELTS books."
        value={props.questions} onChange={props.setQuestions} rows={14}
      />
      <PasteArea
        label="✅ Answer Key"
        hint="One answer per line, e.g. '1   iv', '6   TRUE', '11   B'."
        value={props.answers} onChange={props.setAnswers} rows={10}
      />
    </>
  );
}

function ListeningPasteForm(props: any) {
  return (
    <>
      <div className="mb-5">
        <label className="mb-1 block font-medium text-gray-900">🔊 Audio file (.mp3, .wav, .m4a)</label>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => props.setAudioFile(e.target.files?.[0] || null)}
          className="block w-full text-sm"
        />
        {props.audioFile && (
          <p className="mt-1 text-xs text-gray-500">
            {props.audioFile.name} — {(props.audioFile.size / 1024 / 1024).toFixed(1)} MB
          </p>
        )}
      </div>
      <PasteArea
        label="📝 Transcript (optional)"
        hint="For QC and teacher reference; not shown to students."
        value={props.transcript} onChange={props.setTranscript} rows={10}
      />
      <PasteArea
        label="❓ Questions (Sections 1–4)"
        hint="Paste all 40 questions across 4 sections. Section breaks at 1-10, 11-20, 21-30, 31-40."
        value={props.questions} onChange={props.setQuestions} rows={16}
      />
      <PasteArea
        label="✅ Answer Key"
        hint="40 lines, one per question."
        value={props.answers} onChange={props.setAnswers} rows={10}
      />
    </>
  );
}

function WritingPasteForm(props: any) {
  return (
    <>
      <PasteArea
        label="✍️ Task 1 prompt (Academic: chart description; General: letter)"
        hint="Upload chart image separately if Academic."
        value={props.t1} onChange={props.setT1} rows={10}
      />
      <PasteArea
        label="✍️ Task 2 prompt (250 words, 40 minutes)"
        value={props.t2} onChange={props.setT2} rows={10}
      />
    </>
  );
}

function SpeakingPasteForm(props: any) {
  return (
    <>
      <PasteArea label="🗣️ Part 1 — Introduction questions" value={props.p1} onChange={props.setP1} rows={8} />
      <PasteArea
        label="🗣️ Part 2 — Cue card"
        hint="First line is the topic; bullets (-, •) below become talking points."
        value={props.p2} onChange={props.setP2} rows={10}
      />
      <PasteArea label="🗣️ Part 3 — Discussion questions" value={props.p3} onChange={props.setP3} rows={8} />
    </>
  );
}
```

---

# PART 12 — FRONTEND: LIVE PREVIEW COMPONENT

`frontend/src/components/smart-paste/LivePreview.tsx`:

```tsx
interface PreviewData {
  passage_html: string;
  passage_word_count: number;
  paragraphs: string[];
  question_count: number;
  warnings: string[];
  errors: string[];
  sections: Array<{
    instructions: string;
    warnings: string[];
    questions: Array<{
      order: number;
      qtype: string;
      payload: any;
      answer_key: any;
      raw_text: string;
      detection: { qtype: string; confidence: number; reason: string; needs_confirm: boolean } | null;
    }>;
  }>;
}

export function LivePreview({ preview, loading }: { preview?: PreviewData; loading: boolean }) {
  if (loading && !preview) {
    return <div className="text-sm text-gray-400">Parsing…</div>;
  }
  if (!preview) {
    return (
      <div className="text-sm text-gray-400">
        Live preview will appear here as you paste content on the left.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Errors */}
      {preview.errors?.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="font-medium text-red-900">Errors</h3>
          <ul className="mt-2 list-disc pl-5 text-sm text-red-800">
            {preview.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-lg border bg-white p-4">
        <h3 className="font-medium">Summary</h3>
        <ul className="mt-2 space-y-1 text-sm text-gray-700">
          <li>Passage word count: <strong>{preview.passage_word_count}</strong></li>
          <li>Paragraphs detected: <strong>{preview.paragraphs.join(', ') || '—'}</strong></li>
          <li>Question count: <strong>{preview.question_count}</strong></li>
          <li>Sections: <strong>{preview.sections.length}</strong></li>
        </ul>
      </div>

      {/* Warnings */}
      {preview.warnings?.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="font-medium text-yellow-900">Warnings</h3>
          <ul className="mt-2 list-disc pl-5 text-sm text-yellow-800">
            {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Detected sections */}
      {preview.sections.map((s, i) => (
        <div key={i} className="rounded-lg border bg-white p-4">
          <h3 className="font-medium">{s.instructions || `Section ${i + 1}`}</h3>
          <table className="mt-3 w-full text-sm">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="w-8 text-left">#</th>
                <th className="text-left">Type</th>
                <th className="text-left">Question</th>
                <th className="text-left">Answer</th>
                <th className="w-16 text-right">Conf.</th>
              </tr>
            </thead>
            <tbody>
              {s.questions.map((q) => (
                <tr key={q.order} className="border-t">
                  <td className="py-1.5">{q.order}</td>
                  <td className="font-mono text-xs">{q.qtype}</td>
                  <td className="text-gray-700">{q.raw_text.slice(0, 60)}{q.raw_text.length > 60 ? '…' : ''}</td>
                  <td className="font-mono text-xs">{JSON.stringify(q.answer_key).slice(0, 30)}</td>
                  <td className={`text-right text-xs font-medium ${
                    (q.detection?.confidence ?? 0) > 0.85 ? 'text-green-600'
                    : (q.detection?.confidence ?? 0) > 0.5 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {((q.detection?.confidence ?? 0) * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {s.warnings?.length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-xs text-yellow-800">
              {s.warnings.map((w, j) => <li key={j}>{w}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

# PART 13 — DEBOUNCE HOOK (helper)

`frontend/src/hooks/useDebouncedValue.ts`:

```tsx
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
```

---

# PART 14 — DOCX & EXCEL UPLOAD PAGES

`frontend/src/pages/center/tests/DocxImportPage.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { LivePreview } from '@/components/smart-paste/LivePreview';

export default function DocxImportPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');

  const importMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('file', file!);
      return api.post('/admin/smart-paste/import-docx/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
  });

  const preview = importMutation.data?.data;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-bold">Import from Word document</h1>
      <p className="mb-6 text-sm text-gray-600">
        Mark sections in your .docx with <code>--- PASSAGE ---</code>, <code>--- QUESTIONS ---</code>,
        <code> --- ANSWER KEY ---</code> headers, or use Cambridge-style <em>Questions 1-13</em> /
        <em>Answer Key</em> headings — the parser handles both.
      </p>

      <div className="mb-4 flex items-center gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Test title"
          className="flex-1 rounded border px-3 py-2"
        />
        <input
          type="file"
          accept=".docx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button
          onClick={() => importMutation.mutate()}
          disabled={!file || importMutation.isPending}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:bg-gray-300"
        >
          Parse
        </button>
      </div>

      <LivePreview preview={preview} loading={importMutation.isPending} />

      {/* Confirm-and-create button (calls /smart-paste/create with the parsed pieces) */}
      {preview && !preview.errors?.length && (
        <button
          onClick={async () => {
            const fd = new FormData();
            fd.append('title', title || file?.name || 'Imported test');
            fd.append('test_type', 'reading');
            fd.append('mode', 'reading');
            fd.append('passage', preview.passage_html.replace(/<[^>]+>/g, ''));
            // Reconstruct questions/answers payload — for full fidelity, send raw blocks back
            const r = await api.post('/admin/smart-paste/create/', fd);
            navigate(r.data.edit_url);
          }}
          className="mt-6 rounded bg-green-600 px-4 py-2 text-white"
        >
          Create test from this content
        </button>
      )}
    </div>
  );
}
```

Note: For the DOCX → create flow to work cleanly, change the `SmartPasteDocxImportView` so it returns the original passage/questions/answers raw blocks alongside the preview, and have the frontend POST those raw blocks to `/smart-paste/create/`. This avoids re-parsing on the client.

`frontend/src/pages/center/tests/ExcelImportPage.tsx`:

```tsx
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { LivePreview } from '@/components/smart-paste/LivePreview';

export default function ExcelImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const importMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('file', file!);
      return api.post('/admin/smart-paste/import-excel/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
  });
  const preview = importMutation.data?.data;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-bold">Import from Excel</h1>
      <p className="mb-2 text-sm text-gray-600">
        Use the official template to ensure column order matches.
      </p>
      <a href="/api/v1/admin/smart-paste/excel-template.xlsx" className="mb-6 inline-block text-sm text-blue-600 underline">
        Download template
      </a>

      <div className="mb-4 flex items-center gap-3">
        <input type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button
          onClick={() => importMutation.mutate()}
          disabled={!file || importMutation.isPending}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:bg-gray-300"
        >
          Parse
        </button>
      </div>

      <LivePreview preview={preview} loading={importMutation.isPending} />
    </div>
  );
}
```

---

# PART 15 — VALIDATION

After saving, before publish, validators run (reuse from ETAP 22 if present, else add):

```python
# apps/tests/validators.py

class PublishValidationError(Exception):
    def __init__(self, errors): self.errors = errors


def validate_test_for_publish(test):
    errors = []
    if not test.title.strip():
        errors.append({'code': 'MISSING_TITLE', 'message': 'Test must have a title.'})
    if not test.sections.exists():
        errors.append({'code': 'NO_SECTIONS', 'message': 'Test has no sections.'})

    for section in test.sections.all():
        if section.kind == 'listening' and not section.audio:
            errors.append({'section_id': str(section.id), 'code': 'MISSING_AUDIO',
                           'message': f'Listening section {section.order} has no audio.'})
        if section.kind == 'reading' and not section.passage:
            errors.append({'section_id': str(section.id), 'code': 'MISSING_PASSAGE',
                           'message': f'Reading section {section.order} has no passage.'})
        for q in section.questions.all():
            if q.type in ('writing_task1', 'writing_task2', 'speaking_p1', 'speaking_p2', 'speaking_p3'):
                continue
            if not q.answer_key:
                errors.append({'question_id': str(q.id), 'code': 'MISSING_ANSWER_KEY',
                               'message': f'Q{q.order} has no answer key.'})

    if errors:
        raise PublishValidationError(errors)
```

---

# PART 16 — TESTING (do these manually after build)

Test 1 — **Cambridge-style Reading paste**

Paste this passage:
```
A In recent decades, scientists have devoted increasing attention to the social behaviour of bees, and have come to recognise that their colonies are remarkably sophisticated.

B One of the earliest researchers in this field was Karl von Frisch, who deciphered the famous "waggle dance".

C The economic significance of bees extends far beyond honey production. Crops worth billions depend on bee pollination.

D Yet, in recent years, populations have declined sharply due to a combination of pesticides, habitat loss, and disease.

E Conservation efforts now focus on creating bee-friendly environments and reducing reliance on harmful pesticides.
```

Paste this questions block:
```
Questions 1–5

Choose the most suitable heading for paragraphs A–E from the List of Headings below.

List of Headings
i    The economic role of pollination
ii   Early research on bee behaviour
iii  Modern conservation strategies
iv   The complexity of bee colonies
v    Causes of population decline
vi   The history of beekeeping

1  Paragraph A
2  Paragraph B
3  Paragraph C
4  Paragraph D
5  Paragraph E

Questions 6–8

Do the following statements agree with the information given in the passage?
In boxes 6–8 write
TRUE   if the statement agrees with the information
FALSE  if the statement contradicts the information
NOT GIVEN  if there is no information on this

6  Karl von Frisch was the first scientist to study bees.
7  Bees are responsible for pollinating crops worth billions.
8  Bee populations are now stable globally.
```

Paste this answer key:
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

Expected outcome:
- 1 ParsedSection with 1 ParsedQuestion of type `matching_headings` (paragraphs A-E mapped to headings)
- 1 ParsedSection with 3 ParsedQuestions of type `tfng`
- All confidences ≥ 0.9
- 0 errors, 0 warnings (or only non-critical)
- Click "Save and Open" → redirects to test edit page with test in DB

Test 2 — **Listening with audio**
- Upload a real .mp3 (any file ~30 minutes)
- Paste the standard Cambridge listening questions for sections 1-4
- Paste 40-line answer key
- Verify 4 sections created, audio attached

Test 3 — **DOCX import**
- Open a Cambridge IELTS PDF, save selected pages as .docx via Word
- Add markers `--- PASSAGE ---`, `--- QUESTIONS ---`, `--- ANSWER KEY ---`
- Upload via DOCX import page
- Verify parse succeeds, embedded images extracted

Test 4 — **Excel import**
- Download template
- Add 13 rows for a Reading section with mixed question types
- Upload, verify all questions parsed correctly

Test 5 — **Edge cases**
- Paste with missing answer (Q14 in answers but Q14 not in questions) → warning shown
- Paste 13 questions but only 12 answers → warning lists Q13 as missing
- Single-letter answers `A, B, C, D` with ambiguous instructions → confidence ~50%, `needs_confirm=true`

---

# PART 17 — ACCEPTANCE CRITERIA

- [ ] `python manage.py migrate` succeeds
- [ ] `python manage.py runserver` starts with no import errors
- [ ] Visit `/center/tests/new` → mode selector renders 4 cards
- [ ] Smart Paste page renders 3 textareas + live preview pane
- [ ] Pasting Test 1 sample (above) produces correct preview within 1 second of stopping typing
- [ ] "Save and Open" creates the Test in DB with status=draft, creation_method=smart_paste
- [ ] Created test appears in `/center/tests` list
- [ ] All 12+ IELTS question types are detectable when content is correct
- [ ] Matching Headings creates a single Question record with `payload.headings` and `answer_key.matches`
- [ ] DOCX import: upload a Cambridge-style .docx with markers → preview matches Smart Paste output
- [ ] Excel template downloads
- [ ] Excel import: filled template parses without errors
- [ ] Confidence scores are shown; <85% rows are highlighted yellow, <50% red
- [ ] Warnings (missing answer, extra answer) are surfaced clearly
- [ ] Errors block "Save" (button disabled)
- [ ] Multi-tenant: User A's tests not visible to User B (existing constraint)

---

# PART 18 — DEPLOYMENT

```bash
# Local — final commit
cd ildizmock
git add .
git commit -m "ETAP 24: Smart Paste test creation + DOCX/Excel import — 5–8 min per test"
git push origin main

# Server
ssh ildiz@207.180.226.230
cd /home/ildiz/ildizmock
git stash
git pull origin main
git stash pop

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
sudo supervisorctl tail -f ildizmock stderr
```

---

# 🟢 MANDATORY GIT WORKFLOW

Cursor Agent: **do not stop before pushing**. Local-only changes are not acceptable.

```bash
git add .
git commit -m "ETAP 24: Smart Paste test creation + DOCX/Excel import — 5–8 min per test"
git push origin main
```

If on a feature branch (`feature/etap-24-smart-paste`), push that branch and open a PR titled **"ETAP 24 — Smart Paste"** with the acceptance-criteria checklist from PART 17.

---

# 📌 OUT OF SCOPE (deferred to next ETAPs)

- ETAP 23 — Real CD IELTS student player (split-pane, question palette, highlight, review screen)
- ETAP 25 — AI-assisted question generation (Claude API)
- Image assignment UI for DOCX-extracted images (currently manual via the edit page)
- Audio waveform editor with section markers (basic upload only for now)
- Bulk publish / archive operations on the test list

---

# ⚙️ BUILD ORDER

1. PART 1 — Models + migrations (15 min, skip if ETAP 22 done)
2. PART 2 — Detector module (1 h)
3. PART 3 — Reading parser (2 h)
4. PART 4 — Listening parser (45 min)
5. PART 5 — Writing/Speaking parsers (45 min)
6. PART 8 — Backend API (1 h)
7. PART 13 — Debounce hook (10 min)
8. PART 11 — Smart Paste editor frontend (2 h)
9. PART 12 — Live preview component (1 h)
10. PART 10 — Mode selector (30 min)
11. PART 6 — DOCX importer (1.5 h)
12. PART 7 — Excel importer + template (1 h)
13. PART 14 — DOCX/Excel upload pages (1 h)
14. PART 15 — Validators (30 min)
15. PART 16 — Manual tests (1 h)
16. PART 17 — Acceptance walk-through (1 h)
17. PART 18 — Deploy (30 min)

**Total: ~16 hours, roughly 2 working days.**

After this ETAP ships, adding a full IELTS Reading test should take a teacher **5–8 minutes** instead of 60+. Same for DOCX-based content. Excel handles 100s of questions in minutes.

---

**END OF ETAP 24 PROMPT.**
