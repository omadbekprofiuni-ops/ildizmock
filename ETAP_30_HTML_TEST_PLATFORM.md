# ETAP 30 — HTML TEST PLATFORM (Examy.me-style)

> **Mission:** Replace the broken PDF-iframe approach with a proper HTML-based test platform, identical in architecture to **examy.me**, **IELTS Online Tests**, and **mini-ielts.com**. Test content lives as **structured HTML** with **inline input markers**, not PDFs. Students see the test as a real CD IELTS interface — not a PDF viewer.
>
> **This ETAP REPLACES ETAP 27.** If ETAP 27 is partially built, archive its PDF code into a `legacy/` folder and start fresh with this approach. Existing PDF tests will be **deprecated** (kept readable but flagged as "legacy") — admins migrate them manually by re-pasting the content into the new editor.
>
> **Reference behavior to match:**
> - **Pre-test screen:** "Test Speakers" + checklist (Examy.me, IELTS Online Tests)
> - **PART navigation:** 1, 2, 3, 4 (Listening) / 1, 2, 3 (Reading) — visible at top
> - **Inline input fields:** numbered `{1}`, `{2}` markers rendered as `<input>` inside the text
> - **Answer Transfer Time:** after audio finishes in Listening, 10 minutes to review/transfer
> - **Highlight words:** double-click any word in passage → highlights yellow (saves locally)
> - **Auto-graded result page** with per-question Wrong/Right markers
> - **"Work on mistakes":** replay only the wrong questions
> - **Certificate PDF** with QR code for verification

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

**Language:** All UI text and code in **English only**.

**Standing rule:** Every prompt MUST end with `git add . && git commit -m "..." && git push origin <branch>` actually executed.

---

## 🎯 SCOPE — WHAT THIS ETAP DELIVERS

### IN SCOPE

✅ Backend models: `Test`, `Section`, `Part`, `Question`, `Attempt` (rebuilt around HTML content)
✅ Custom content syntax (markdown-like) with `{1}`, `{2}` input markers
✅ Content parser (Python) → structured HTML for rendering
✅ Content validator (Python) → ensures all `{N}` markers have answer keys
✅ Admin test editor: 4-step wizard (Test info → Audio → Content → Answers)
✅ Smart Paste from Cambridge tests (parses `____1____` underscores, lists, headings)
✅ Live preview while editing (renders the same HTML student will see)
✅ Pre-test screen with Test Speakers button
✅ Test player with HTML renderer + inline inputs + PART navigation
✅ Single-shot audio (auto-plays, "Playing..." status, no scrub)
✅ Answer Transfer Time (10 min after audio for Listening)
✅ Highlight words feature (double-click → yellow highlight, persists in localStorage)
✅ Real-time auto-save on every keystroke (debounced 800ms)
✅ Auto-grader (reuse existing logic from ETAP 27 if available)
✅ Result page: band score + per-question Wrong/Right + correct answers shown
✅ "Work on mistakes" mode: replay only wrong questions
✅ Certificate PDF download with branding + QR code
✅ Test Library (superadmin creates, centers clone)

### EXPLICITLY OUT OF SCOPE

❌ PDF iframe rendering (the broken approach we're replacing)
❌ PDF-to-HTML conversion (admins re-create content in the new editor)
❌ Diagram Label / Map Labelling questions (deferred — too niche)
❌ Writing/Speaking auto-grading (still manual)
❌ Mobile native app
❌ AI-assisted content generation
❌ Migration of legacy PDF tests (mark them deprecated, admin re-creates)
❌ Recent Actual Tests collection
❌ Analytics charts (deferred to ETAP 31)

If a feature is not on the IN SCOPE list, **don't build it**.

---

## 🏗️ ARCHITECTURE

```
   ADMIN PATH                              STUDENT PATH

   ┌─────────────────┐                     ┌──────────────┐
   │ Step 1: Info    │                     │ Test catalog │
   │ Step 2: Audio   │                     └──────┬───────┘
   │ Step 3: Content │                            │
   │ Step 4: Answers │                     ┌──────▼───────────────┐
   └────────┬────────┘                     │ PRE-TEST SCREEN      │
            │                              │ • Test Speakers      │
   ┌────────▼────────┐                     │ • Highlight words    │
   │ Backend         │                     │ • 10 min transfer    │
   │ • Parse content │                     │ [ Start Exam ]       │
   │ • Validate Qs   │                     └──────┬───────────────┘
   │ • Save HTML     │                            │
   └────────┬────────┘                     ┌──────▼───────────────┐
            │                              │ TEST PLAYER          │
   ┌────────▼────────┐                     │                      │
   │ Test (draft)    │                     │ Header: PART 1|2|3|4 │
   └────────┬────────┘                     │   Audio: Playing...  │
            │                              │   Timer | Finish     │
   ┌────────▼────────┐                     │                      │
   │ Live Preview    │                     │ Body: HTML content   │
   │ Publish         │                     │   • Heading          │
   └─────────────────┘                     │   • Sentence with    │
                                           │     inline {1}=input │
                                           │   • List items       │
                                           │   • Highlightable    │
                                           │     words            │
                                           └──────┬───────────────┘
                                                  │
                                           ┌──────▼───────────────┐
                                           │ ANSWER TRANSFER TIME │
                                           │ (Listening only,     │
                                           │  10 min after audio) │
                                           └──────┬───────────────┘
                                                  │
                                           ┌──────▼───────────────┐
                                           │ Submit               │
                                           └──────┬───────────────┘
                                                  │
                                           ┌──────▼───────────────┐
                                           │ RESULT PAGE          │
                                           │ • Band score         │
                                           │ • Per-question table │
                                           │ • Wrong / Right      │
                                           │ • Work on mistakes   │
                                           │ • Download cert PDF  │
                                           └──────────────────────┘
```

---

# PART 1 — DATA MODEL

⚠️ **Drop the old PDF-based models** if they exist (or migrate to new ones cleanly). The new model is HTML-content-first.

`backend/apps/tests/models.py`:

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
        LEGACY = 'legacy', 'Legacy (PDF-based, deprecated)'

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
        help_text="null = library test (created by superadmin)",
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

    is_library = models.BooleanField(default=False)
    cloned_from = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='clones',
    )

    # New HTML-based field — flags whether this test uses the new format
    uses_html_format = models.BooleanField(
        default=True,
        help_text="True = new HTML-based test. False = legacy PDF-based.",
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
    """High-level test section: Listening / Reading / Writing / Speaking.
    Each section contains 1+ Parts."""

    class Kind(models.TextChoices):
        LISTENING = 'listening', 'Listening'
        READING = 'reading', 'Reading'
        WRITING = 'writing', 'Writing'
        SPEAKING = 'speaking', 'Speaking'

    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='sections')
    order = models.PositiveSmallIntegerField()
    kind = models.CharField(max_length=16, choices=Kind.choices)
    title = models.CharField(max_length=255, blank=True, default='')

    # Audio (Listening only — MANDATORY)
    audio_file = models.FileField(upload_to='audio/%Y/%m/', null=True, blank=True)
    audio_duration_seconds = models.PositiveIntegerField(default=0)

    # Time configuration
    duration_seconds = models.PositiveIntegerField(default=0)
    answer_transfer_time_seconds = models.PositiveIntegerField(
        default=600,
        help_text="Listening only: extra time after audio to review/transfer (default 10 min)",
    )

    class Meta:
        ordering = ['test', 'order']
        unique_together = [('test', 'order')]


class Part(TimeStampedModel):
    """One part within a section. Listening has 4 parts, Reading has 3.
    
    Each Part contains:
    - HTML content (rendered to student) with {N} input markers
    - Source content (admin-edited, with markdown-like syntax)
    - Range of questions covered
    """
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='parts')
    order = models.PositiveSmallIntegerField(help_text="1, 2, 3, 4")
    title = models.CharField(max_length=255, blank=True, default='')
    instructions = models.TextField(
        blank=True, default='',
        help_text="e.g. 'Write ONE WORD AND/OR A NUMBER for each answer.'",
    )
    
    # The admin's source content (markdown-like with {1} markers)
    content_source = models.TextField(
        blank=True, default='',
        help_text="Admin's editable source. See docs for syntax.",
    )
    # Rendered HTML (generated from content_source on save)
    content_html = models.TextField(
        blank=True, default='',
        help_text="Auto-generated HTML. Do not edit directly.",
    )

    question_start = models.PositiveSmallIntegerField(default=1)
    question_end = models.PositiveSmallIntegerField(default=10)

    class Meta:
        ordering = ['section', 'order']
        unique_together = [('section', 'order')]


class Question(TimeStampedModel):
    """One question. Linked to a Part (not Section directly).
    Type is auto-detected from the answer key by the smart parser."""

    class Type(models.TextChoices):
        TFNG = 'tfng', 'True/False/Not Given'
        YNNG = 'ynng', 'Yes/No/Not Given'
        MCQ_SINGLE = 'mcq_single', 'MCQ single'
        MCQ_MULTI = 'mcq_multi', 'MCQ multi'
        MATCHING_HEADINGS = 'matching_headings', 'Matching Headings'
        MATCHING_INFO = 'matching_info', 'Matching Information'
        MATCHING_FEATURES = 'matching_features', 'Matching Features'
        COMPLETION = 'completion', 'Completion (sentence/note/summary)'
        SHORT_ANSWER = 'short_answer', 'Short Answer'
        WRITING_TASK_1 = 'writing_task1', 'Writing Task 1'
        WRITING_TASK_2 = 'writing_task2', 'Writing Task 2'

    part = models.ForeignKey(Part, on_delete=models.CASCADE, related_name='questions')
    order = models.PositiveSmallIntegerField(help_text="Q1, Q2, ... Q40")
    type = models.CharField(max_length=32, choices=Type.choices)
    points = models.PositiveSmallIntegerField(default=1)

    answer_key = models.JSONField(default=dict)
    options = models.JSONField(default=list, blank=True)
    headings = models.JSONField(default=list, blank=True)

    # For inline-input questions: where in the HTML this question appears
    # (the parser fills this in based on the {N} marker position)
    placeholder_index = models.PositiveSmallIntegerField(
        default=0,
        help_text="0 = MCQ-style (no inline input). >0 = inline at that {N} marker.",
    )

    class Meta:
        ordering = ['part', 'order']
        unique_together = [('part', 'order')]
        indexes = [models.Index(fields=['type'])]


class Attempt(TimeStampedModel):
    class Status(models.TextChoices):
        IN_PROGRESS = 'in_progress', 'In Progress'
        TRANSFER_TIME = 'transfer_time', 'Answer Transfer Time'
        SUBMITTED = 'submitted', 'Submitted'
        GRADED = 'graded', 'Graded'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='attempts')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attempts')
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.IN_PROGRESS)
    started_at = models.DateTimeField(auto_now_add=True)
    audio_finished_at = models.DateTimeField(null=True, blank=True)
    transfer_time_started_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    answers = models.JSONField(default=dict)
    raw_score = models.PositiveSmallIntegerField(null=True, blank=True)
    band_score = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    section_band_scores = models.JSONField(default=dict)

    # For "Work on mistakes" replay
    is_mistake_replay = models.BooleanField(
        default=False,
        help_text="True if this attempt is a replay of mistakes from a parent attempt.",
    )
    parent_attempt = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replays',
    )
    auto_submitted_reason = models.CharField(max_length=64, blank=True, default='')


class HighlightedWord(TimeStampedModel):
    """Per-attempt, per-part: words the student double-clicked to highlight."""
    attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name='highlights')
    part = models.ForeignKey(Part, on_delete=models.CASCADE)
    word = models.CharField(max_length=100)
    char_offset = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [('attempt', 'part', 'word', 'char_offset')]
```

Migration:
```bash
cd backend
python manage.py makemigrations tests
python manage.py migrate
```

---

# PART 2 — CONTENT SYNTAX (DSL)

The admin writes the test content using a simple, markdown-inspired syntax. Backend parses this into HTML.

## 2.1 Syntax reference

```
# Heading 1 (e.g. test title)
## Heading 2 (e.g. PART X)
### Heading 3 (e.g. section name like "Regular activities")
#### Heading 4 (e.g. subsection like "Beach")

**Bold text**
*Italic text*

- Bullet list item
- Another bullet

1. Numbered list item

{1}        ← inline input field for question 1
{2}        ← inline input field for question 2
{15:LARGE} ← input with custom width hint

> Quote / passage block (gray box, like the "Buckworth Conservation Group" box on examy.me)

---  ← horizontal rule (separator)

[box]
content inside a callout box (yellow background)
[/box]

[passage]
A long reading passage goes here.
The passage block has a different style — wider, with paragraph spacing.
[/passage]

[mcq:5]
What did the speaker say about the beach?
A. It is clean
B. It is polluted
C. It is closed
[/mcq]

[tfng:6]
The beach has lots of garbage.
[/tfng]

[matching:7-10]
List of headings:
i. The benefits of conservation
ii. How to protect beaches
iii. Volunteers wanted
iv. Impact on wildlife
v. Future plans

7. Paragraph A → {7}
8. Paragraph B → {8}
9. Paragraph C → {9}
10. Paragraph D → {10}
[/matching]
```

## 2.2 Worked example (from the Examy.me screenshot)

**Source content** (what admin types):

```
## PART 1 Questions 1-10

> Write ONE WORD AND/OR A NUMBER for each answer.

[passage]
### Buckworth Conservation Group

#### Regular activities

**Beach**
- making sure the beach does not have {1} on it
- no {2}

**Nature reserve**
- maintaining paths
- nesting boxes for birds installed
- next task is taking action to attract {3} to the place
- identifying types of {4}
- building a new {5}

#### Forthcoming events

**Saturday**
- meet at Dunsmore Beach car park
- walk across the sands and reach the {6}
- take a picnic
- wear appropriate {7}
[/passage]
```

**Rendered HTML** (what the parser produces):

```html
<h2>PART 1 Questions 1-10</h2>
<blockquote>Write ONE WORD AND/OR A NUMBER for each answer.</blockquote>
<div class="passage-box">
  <h3>Buckworth Conservation Group</h3>
  <h4>Regular activities</h4>
  <p><strong>Beach</strong></p>
  <ul>
    <li>making sure the beach does not have <input data-q="1" /> on it</li>
    <li>no <input data-q="2" /></li>
  </ul>
  <p><strong>Nature reserve</strong></p>
  <ul>
    <li>maintaining paths</li>
    <li>nesting boxes for birds installed</li>
    <li>next task is taking action to attract <input data-q="3" /> to the place</li>
    <li>identifying types of <input data-q="4" /></li>
    <li>building a new <input data-q="5" /></li>
  </ul>
  ...
</div>
```

The frontend renders this HTML with React, replacing each `<input data-q="N" />` with a controlled React component bound to `answers[questionId]`.

---

# PART 3 — CONTENT PARSER

`backend/apps/tests/content/parser.py`:

```python
"""
Parses the admin's source content into safe HTML.
Uses a hand-rolled parser (markdown libs are too lenient with HTML injection).

CRITICAL: Output HTML is sanitized before saving. Only specific tags allowed.
"""
import re
import html


ALLOWED_INLINE_TAGS = {"strong", "em", "br", "input", "span"}
ALLOWED_BLOCK_TAGS = {
    "h1", "h2", "h3", "h4", "h5",
    "p", "ul", "ol", "li", "blockquote",
    "div", "hr", "table", "thead", "tbody", "tr", "td", "th",
}


# ─────────────────────────────────────────────────────────────
# REGEX BUILDING BLOCKS
# ─────────────────────────────────────────────────────────────

INPUT_MARKER_RE = re.compile(r"\{(\d{1,3})(?::([A-Z]+))?\}")
BOLD_RE = re.compile(r"\*\*(.+?)\*\*")
ITALIC_RE = re.compile(r"(?<!\*)\*([^*]+)\*(?!\*)")
HR_RE = re.compile(r"^---\s*$", re.MULTILINE)


# ─────────────────────────────────────────────────────────────
# INLINE FORMATTING
# ─────────────────────────────────────────────────────────────

def render_inline(line: str) -> str:
    """Convert markdown inline syntax to HTML. Escapes everything else."""
    # First, escape everything to prevent injection
    escaped = html.escape(line)

    # Then re-introduce our allowed inline syntax
    out = escaped
    out = BOLD_RE.sub(r"<strong>\1</strong>", out)
    out = ITALIC_RE.sub(r"<em>\1</em>", out)

    # Replace input markers with <input> tags
    def _input(m):
        num = m.group(1)
        size_hint = m.group(2) or "MEDIUM"
        size_class = {
            "SMALL": "input-sm",
            "MEDIUM": "input-md",
            "LARGE": "input-lg",
        }.get(size_hint, "input-md")
        return f'<input data-q="{num}" class="answer-input {size_class}" />'

    out = INPUT_MARKER_RE.sub(_input, out)
    return out


# ─────────────────────────────────────────────────────────────
# BLOCK PARSER
# ─────────────────────────────────────────────────────────────

def parse_blocks(source: str) -> str:
    """Parse the source into HTML blocks. Returns a single HTML string."""
    lines = source.replace("\r\n", "\n").split("\n")
    out: list[str] = []

    i = 0
    in_passage = False
    in_box = False

    def open_block(name: str, css_class: str = "") -> None:
        attr = f' class="{css_class}"' if css_class else ""
        out.append(f"<{name}{attr}>")

    def close_block(name: str) -> None:
        out.append(f"</{name}>")

    while i < len(lines):
        line = lines[i].rstrip()

        # Skip empty lines
        if not line.strip():
            i += 1
            continue

        # Container blocks
        if line.strip() == "[passage]":
            open_block("div", "passage-box")
            in_passage = True
            i += 1
            continue
        if line.strip() == "[/passage]":
            close_block("div")
            in_passage = False
            i += 1
            continue
        if line.strip() == "[box]":
            open_block("div", "callout-box")
            in_box = True
            i += 1
            continue
        if line.strip() == "[/box]":
            close_block("div")
            in_box = False
            i += 1
            continue

        # Headings
        m = re.match(r"^(#{1,5})\s+(.+)$", line)
        if m:
            level = len(m.group(1))
            text = render_inline(m.group(2))
            out.append(f"<h{level}>{text}</h{level}>")
            i += 1
            continue

        # Horizontal rule
        if HR_RE.match(line):
            out.append("<hr />")
            i += 1
            continue

        # Blockquote
        if line.startswith("> "):
            buf = [line[2:]]
            i += 1
            while i < len(lines) and lines[i].startswith("> "):
                buf.append(lines[i][2:])
                i += 1
            text = render_inline("<br />".join(buf))
            out.append(f"<blockquote>{text}</blockquote>")
            continue

        # Bullet list
        if re.match(r"^[\-•]\s+", line):
            out.append("<ul>")
            while i < len(lines) and re.match(r"^[\-•]\s+", lines[i]):
                item = re.sub(r"^[\-•]\s+", "", lines[i])
                out.append(f"<li>{render_inline(item)}</li>")
                i += 1
            out.append("</ul>")
            continue

        # Numbered list
        if re.match(r"^\d+\.\s+", line):
            out.append("<ol>")
            while i < len(lines) and re.match(r"^\d+\.\s+", lines[i]):
                item = re.sub(r"^\d+\.\s+", "", lines[i])
                out.append(f"<li>{render_inline(item)}</li>")
                i += 1
            out.append("</ol>")
            continue

        # MCQ block
        m = re.match(r"^\[mcq:(\d+)\]\s*$", line)
        if m:
            qnum = m.group(1)
            i += 1
            stem_lines = []
            options = []
            while i < len(lines) and lines[i].strip() != f"[/mcq]":
                opt_match = re.match(r"^([A-J])\.\s+(.+)$", lines[i])
                if opt_match:
                    options.append((opt_match.group(1), opt_match.group(2)))
                else:
                    if lines[i].strip():
                        stem_lines.append(lines[i])
                i += 1
            i += 1  # skip [/mcq]
            stem = render_inline(" ".join(stem_lines).strip())
            out.append(f'<div class="mcq-block" data-q="{qnum}">')
            out.append(f'<p class="mcq-stem"><span class="qnum">{qnum}.</span> {stem}</p>')
            out.append('<ul class="mcq-options">')
            for letter, text in options:
                out.append(
                    f'<li><label><input type="radio" name="q{qnum}" value="{letter}" />'
                    f'<span class="opt-letter">{letter}</span> {render_inline(text)}</label></li>'
                )
            out.append('</ul></div>')
            continue

        # TFNG block
        m = re.match(r"^\[tfng:(\d+)\]\s*$", line)
        if m:
            qnum = m.group(1)
            i += 1
            stem_lines = []
            while i < len(lines) and lines[i].strip() != f"[/tfng]":
                if lines[i].strip():
                    stem_lines.append(lines[i])
                i += 1
            i += 1
            stem = render_inline(" ".join(stem_lines).strip())
            out.append(f'<div class="tfng-block" data-q="{qnum}">')
            out.append(f'<p><span class="qnum">{qnum}.</span> {stem}</p>')
            out.append('<div class="tfng-options">')
            for opt in ("TRUE", "FALSE", "NOT GIVEN"):
                out.append(
                    f'<button type="button" data-q="{qnum}" data-value="{opt}" '
                    f'class="tfng-btn">{opt}</button>'
                )
            out.append('</div></div>')
            continue

        # Plain paragraph
        para_lines = [line]
        i += 1
        while (i < len(lines) and lines[i].strip()
               and not re.match(r"^[\-•]\s+", lines[i])
               and not re.match(r"^\d+\.\s+", lines[i])
               and not re.match(r"^#{1,5}\s+", lines[i])
               and not lines[i].startswith("> ")
               and not lines[i].strip().startswith("[")):
            para_lines.append(lines[i])
            i += 1
        para_text = render_inline(" ".join(para_lines).strip())
        out.append(f"<p>{para_text}</p>")

    return "\n".join(out)


# ─────────────────────────────────────────────────────────────
# VALIDATION
# ─────────────────────────────────────────────────────────────

def extract_question_numbers(source: str) -> list[int]:
    """Returns the sorted list of question numbers found in the source."""
    nums = set()
    for m in INPUT_MARKER_RE.finditer(source):
        nums.add(int(m.group(1)))
    # Also check [mcq:N] and [tfng:N] blocks
    for m in re.finditer(r"\[(?:mcq|tfng|matching):(\d+)(?:-\d+)?\]", source):
        nums.add(int(m.group(1)))
    return sorted(nums)


def validate_content(source: str, expected_question_count: int = None) -> dict:
    """Returns {ok, errors, warnings, question_numbers}."""
    errors = []
    warnings = []
    nums = extract_question_numbers(source)

    if not nums:
        errors.append("No question markers ({1}, {2}, ...) found in content.")

    # Check for gaps
    if nums:
        expected = list(range(min(nums), max(nums) + 1))
        missing = sorted(set(expected) - set(nums))
        if missing:
            warnings.append(f"Gap in question numbers: {missing}")

    # Check for duplicates (same {N} multiple times — usually a typo)
    counter = {}
    for m in INPUT_MARKER_RE.finditer(source):
        n = int(m.group(1))
        counter[n] = counter.get(n, 0) + 1
    duplicates = [n for n, c in counter.items() if c > 1]
    if duplicates:
        warnings.append(f"Question numbers used multiple times: {duplicates}")

    if expected_question_count is not None and len(nums) != expected_question_count:
        warnings.append(
            f"Expected {expected_question_count} questions, found {len(nums)}."
        )

    return {
        "ok": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "question_numbers": nums,
    }


def parse_to_html(source: str) -> str:
    """Top-level: convert source DSL to safe HTML."""
    return parse_blocks(source)
```

---

# PART 4 — SMART PASTE FROM CAMBRIDGE TESTS

When admin pastes raw Cambridge test text (with `____1____` underscores instead of `{1}`), auto-convert it.

`backend/apps/tests/content/smart_paste.py`:

```python
"""
Detects common patterns in Cambridge IELTS test paste-ins and converts to our DSL.

Heuristics:
  ____1____   → {1}
  __1__       → {1}
  (1) ........ → {1}
  1. (blank)  → {1}
  
  Headings with all-caps        → ## or ###
  Lines starting with "•" or "-" → bullet list
  Lines starting with "1.", "2." → numbered list
"""
import re


UNDERSCORE_INPUT_RE = re.compile(r"_{3,}\s*(\d+)\s*_{3,}")
PARENTHESES_INPUT_RE = re.compile(r"\((\d+)\)\s*\.{3,}")


def smart_convert(raw: str) -> str:
    """Best-effort conversion of pasted Cambridge content to our DSL."""
    text = raw.replace("\r\n", "\n")

    # Convert input markers
    text = UNDERSCORE_INPUT_RE.sub(lambda m: f"{{{m.group(1)}}}", text)
    text = PARENTHESES_INPUT_RE.sub(lambda m: f"{{{m.group(1)}}}", text)
    text = re.sub(r"_{5,}", "{?}", text)  # naked underscores → manual fix needed

    lines = text.split("\n")
    out = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            out.append("")
            continue

        # All-caps heading detection
        if (len(stripped) > 2
            and stripped == stripped.upper()
            and re.search(r"[A-Z]", stripped)
            and len(stripped.split()) <= 8):
            out.append(f"### {stripped.title()}")
            continue

        # Title-case sentence-style heading (e.g. "Regular activities")
        if (re.match(r"^[A-Z][a-z]", stripped)
            and len(stripped.split()) <= 5
            and not stripped.endswith((".", "?", "!"))):
            # Could be a heading or a paragraph — leave as paragraph for safety
            out.append(stripped)
            continue

        # Bullet detection
        if re.match(r"^[\u2022\-]\s+", stripped):
            out.append("- " + re.sub(r"^[\u2022\-]\s+", "", stripped))
            continue

        # Numbered list
        if re.match(r"^\d+\.\s+", stripped):
            # Could be a question list or a numbered list — keep as-is
            out.append(stripped)
            continue

        out.append(stripped)

    return "\n".join(out)
```

---

# PART 5 — BACKEND ENDPOINTS

`backend/apps/tests/urls.py`:

```python
from django.urls import path
from . import views_admin, views_student, views_library

urlpatterns = [
    # ───── Admin ─────
    path("admin/tests/", views_admin.TestListCreateView.as_view()),
    path("admin/tests/<uuid:pk>/", views_admin.TestDetailView.as_view()),
    path("admin/tests/<uuid:pk>/publish/", views_admin.TestPublishView.as_view()),
    path("admin/tests/<uuid:pk>/clone/", views_admin.TestCloneView.as_view()),

    # Test creation wizard
    path("admin/tests/<uuid:pk>/parts/", views_admin.PartListCreateView.as_view()),
    path("admin/parts/<int:pk>/", views_admin.PartDetailView.as_view()),
    path("admin/parts/<int:pk>/preview/", views_admin.PartPreviewView.as_view()),
    path("admin/parts/<int:pk>/smart-paste/", views_admin.SmartPasteView.as_view()),
    path("admin/parts/<int:pk>/answer-key/", views_admin.AnswerKeyView.as_view()),

    # ───── Library ─────
    path("library/tests/", views_library.LibraryTestListView.as_view()),
    path("library/tests/<uuid:pk>/", views_library.LibraryTestDetailView.as_view()),
    path("library/tests/<uuid:pk>/clone-to-org/", views_library.LibraryCloneToOrgView.as_view()),

    # ───── Student ─────
    path("student/tests/", views_student.StudentTestListView.as_view()),
    path("student/tests/<uuid:pk>/", views_student.StudentTestDetailView.as_view()),
    path("student/tests/<uuid:pk>/start/", views_student.StartAttemptView.as_view()),
    path("student/attempts/<uuid:pk>/", views_student.AttemptDetailView.as_view()),
    path("student/attempts/<uuid:pk>/answer/", views_student.SaveAnswerView.as_view()),
    path("student/attempts/<uuid:pk>/audio-finished/", views_student.AudioFinishedView.as_view()),
    path("student/attempts/<uuid:pk>/transfer-time/", views_student.StartTransferTimeView.as_view()),
    path("student/attempts/<uuid:pk>/submit/", views_student.SubmitAttemptView.as_view()),
    path("student/attempts/<uuid:pk>/highlight/", views_student.HighlightWordView.as_view()),
    path("student/attempts/<uuid:pk>/replay-mistakes/", views_student.ReplayMistakesView.as_view()),
    path("student/attempts/<uuid:pk>/certificate/", views_student.CertificatePdfView.as_view()),
]
```

## 5.1 Admin views — `views_admin.py`

```python
import uuid
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .models import Test, Section, Part, Question
from .serializers import (
    TestListSerializer, TestDetailSerializer, PartSerializer,
)
from .content.parser import parse_to_html, validate_content
from .content.smart_paste import smart_convert
from .smart_answer_sheet.parser import parse_answer_key_text, build_answer_key


def _scope(request):
    if request.user.is_superuser:
        return Test.objects.filter(is_deleted=False)
    org = getattr(request, "organization", None)
    if org:
        return Test.objects.filter(is_deleted=False, organization=org)
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

    def perform_create(self, serializer):
        serializer.save(
            organization=getattr(self.request, "organization", None),
            created_by=self.request.user,
            uses_html_format=True,
        )


class TestDetailView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TestDetailSerializer
    def get_queryset(self):
        return _scope(self.request)


class PartListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        test = get_object_or_404(_scope(request), pk=pk)
        # Pick or create the section first
        kind = request.data.get("section_kind", test.type)
        section, _ = Section.objects.get_or_create(
            test=test, kind=kind,
            defaults={"order": 1, "title": kind.title()},
        )

        order = request.data.get("order", section.parts.count() + 1)
        part = Part.objects.create(
            section=section, order=order,
            title=request.data.get("title", f"Part {order}"),
            instructions=request.data.get("instructions", ""),
            content_source=request.data.get("content_source", ""),
            question_start=request.data.get("question_start", 1),
            question_end=request.data.get("question_end", 10),
        )
        part.content_html = parse_to_html(part.content_source)
        part.save()
        return Response(PartSerializer(part).data, status=201)


class PartDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        part = get_object_or_404(Part, pk=pk)
        return Response(PartSerializer(part).data)

    def patch(self, request, pk):
        part = get_object_or_404(Part, pk=pk)
        for field in ("title", "instructions", "content_source",
                      "question_start", "question_end"):
            if field in request.data:
                setattr(part, field, request.data[field])
        # Re-render HTML on every save
        part.content_html = parse_to_html(part.content_source)
        part.save()
        return Response(PartSerializer(part).data)


class PartPreviewView(APIView):
    """POST source content; returns rendered HTML without saving."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        source = request.data.get("content_source", "")
        validation = validate_content(source)
        html = parse_to_html(source) if validation["ok"] else ""
        return Response({"html": html, **validation})


class SmartPasteView(APIView):
    """POST raw Cambridge text; returns converted DSL."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        raw = request.data.get("raw", "")
        converted = smart_convert(raw)
        return Response({"converted": converted})


class AnswerKeyView(APIView):
    """POST the part's answer key text; auto-detects question types and creates Question rows."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        part = get_object_or_404(Part, pk=pk)
        text = request.data.get("answer_text", "")
        pr = parse_answer_key_text(text)
        if pr.errors:
            return Response({"errors": pr.errors}, status=400)

        # Wipe existing questions and recreate
        part.questions.all().delete()
        for g in pr.groups:
            for q in g.questions:
                qtype = g.qtype if g.qtype not in ("mixed", "unknown", "tfng_or_ynng") else "completion"
                Question.objects.create(
                    part=part, order=q.order, type=qtype, points=1,
                    answer_key=build_answer_key(qtype, q.raw_answer),
                    placeholder_index=q.order,
                )

        return Response({
            "questions_created": part.questions.count(),
            "warnings": pr.warnings,
        })


class TestPublishView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        test = get_object_or_404(_scope(request), pk=pk)
        errors = []
        if not test.sections.exists():
            errors.append("Test has no sections.")
        for section in test.sections.all():
            if not section.parts.exists():
                errors.append(f"Section {section.kind}: no parts.")
            if section.kind == "listening" and not section.audio_file:
                errors.append(f"Listening section: audio file is mandatory.")
            for part in section.parts.all():
                v = validate_content(part.content_source)
                if not v["ok"]:
                    errors.append(f"Part {part.order}: {'; '.join(v['errors'])}")
                if part.questions.count() == 0 and test.type not in ("writing", "speaking"):
                    errors.append(f"Part {part.order}: no questions defined.")

        if errors:
            return Response({"errors": errors}, status=400)

        test.status = Test.Status.PUBLISHED
        test.published_at = timezone.now()
        test.save()
        return Response({"id": str(test.id), "status": test.status})


class TestCloneView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        original = get_object_or_404(Test, pk=pk)
        new = Test.objects.create(
            organization=getattr(request, "organization", None),
            title=f"{original.title} (Copy)",
            description=original.description, type=original.type,
            module=original.module, duration_minutes=original.duration_minutes,
            status=Test.Status.DRAFT, created_by=request.user,
            cloned_from=original, uses_html_format=True,
        )
        for s in original.sections.all():
            new_s = Section.objects.create(
                test=new, order=s.order, kind=s.kind, title=s.title,
                audio_file=s.audio_file,
                audio_duration_seconds=s.audio_duration_seconds,
                duration_seconds=s.duration_seconds,
                answer_transfer_time_seconds=s.answer_transfer_time_seconds,
            )
            for p in s.parts.all():
                new_p = Part.objects.create(
                    section=new_s, order=p.order, title=p.title,
                    instructions=p.instructions,
                    content_source=p.content_source,
                    content_html=p.content_html,
                    question_start=p.question_start,
                    question_end=p.question_end,
                )
                for q in p.questions.all():
                    Question.objects.create(
                        part=new_p, order=q.order, type=q.type, points=q.points,
                        answer_key=q.answer_key, options=q.options,
                        headings=q.headings, placeholder_index=q.placeholder_index,
                    )
        return Response({"test_id": str(new.id),
                        "edit_url": f"/center/tests/{new.id}/edit"})
```

## 5.2 Student views — `views_student.py`

```python
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response
from django.db.models import Q

from .models import Test, Attempt, HighlightedWord, Question
from .serializers import (
    TestListSerializer, TestForStudentSerializer, AttemptSerializer,
)
from .grading import grade_attempt


class StudentTestListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TestListSerializer

    def get_queryset(self):
        org = getattr(self.request, "organization", None)
        return (Test.objects.filter(
                    status=Test.Status.PUBLISHED,
                    is_deleted=False,
                    uses_html_format=True,  # Hide legacy PDF tests
                )
                .filter(Q(organization=org) | Q(is_library=True))
                .order_by("-published_at"))


class StudentTestDetailView(RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TestForStudentSerializer
    queryset = Test.objects.filter(status=Test.Status.PUBLISHED)


class StartAttemptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        test = get_object_or_404(Test, pk=pk, status=Test.Status.PUBLISHED)
        attempt = Attempt.objects.create(test=test, student=request.user)
        return Response({"attempt_id": str(attempt.id),
                        "test": TestForStudentSerializer(test).data})


class AttemptDetailView(RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = AttemptSerializer
    def get_queryset(self):
        return Attempt.objects.filter(student=self.request.user)


class SaveAnswerView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        attempt = get_object_or_404(Attempt, pk=pk, student=request.user)
        if attempt.status not in (Attempt.Status.IN_PROGRESS, Attempt.Status.TRANSFER_TIME):
            return Response({"error": "Attempt is not active."}, status=400)
        qid = str(request.data.get("question_id"))
        ans = request.data.get("answer")
        attempt.answers[qid] = ans
        attempt.save(update_fields=["answers", "updated_at"])
        return Response({"saved": True})


class AudioFinishedView(APIView):
    """Called by the audio player when the audio ends."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        attempt = get_object_or_404(Attempt, pk=pk, student=request.user)
        if attempt.audio_finished_at:
            return Response({"already": True})
        attempt.audio_finished_at = timezone.now()
        attempt.save(update_fields=["audio_finished_at"])
        return Response({"audio_finished_at": attempt.audio_finished_at})


class StartTransferTimeView(APIView):
    """Listening only: transition from IN_PROGRESS to TRANSFER_TIME."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        attempt = get_object_or_404(Attempt, pk=pk, student=request.user)
        attempt.status = Attempt.Status.TRANSFER_TIME
        attempt.transfer_time_started_at = timezone.now()
        attempt.save(update_fields=["status", "transfer_time_started_at"])
        return Response({"status": attempt.status,
                        "transfer_started": attempt.transfer_time_started_at})


class SubmitAttemptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        attempt = get_object_or_404(Attempt, pk=pk, student=request.user)
        if attempt.status == Attempt.Status.GRADED:
            return Response({"error": "Already submitted."}, status=400)
        attempt.status = Attempt.Status.SUBMITTED
        attempt.submitted_at = timezone.now()
        attempt.save()
        summary = grade_attempt(attempt)
        return Response({"summary": summary,
                        "result_url": f"/student/attempts/{attempt.id}/result"})


class HighlightWordView(APIView):
    """Records a double-click highlight."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        attempt = get_object_or_404(Attempt, pk=pk, student=request.user)
        part_id = request.data.get("part_id")
        word = (request.data.get("word") or "").strip()[:100]
        offset = int(request.data.get("char_offset", 0))
        if not word:
            return Response({"error": "Empty word"}, status=400)
        HighlightedWord.objects.get_or_create(
            attempt=attempt, part_id=part_id, word=word, char_offset=offset,
        )
        return Response({"saved": True})

    def delete(self, request, pk):
        attempt = get_object_or_404(Attempt, pk=pk, student=request.user)
        word = (request.data.get("word") or "").strip()
        offset = int(request.data.get("char_offset", 0))
        HighlightedWord.objects.filter(
            attempt=attempt, word=word, char_offset=offset,
        ).delete()
        return Response({"deleted": True})


class ReplayMistakesView(APIView):
    """Creates a new Attempt for replaying only wrong questions from the given attempt."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        parent = get_object_or_404(Attempt, pk=pk, student=request.user)
        if parent.status != Attempt.Status.GRADED:
            return Response({"error": "Parent attempt must be graded first."}, status=400)

        replay = Attempt.objects.create(
            test=parent.test, student=request.user,
            is_mistake_replay=True, parent_attempt=parent,
        )
        # Pre-fill with empty answers so student starts fresh on those Qs
        return Response({"attempt_id": str(replay.id),
                        "redirect_url": f"/student/attempts/{replay.id}"})


class CertificatePdfView(APIView):
    """PDF download. Uses reportlab to render the certificate."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from .certificate import build_certificate_pdf
        attempt = get_object_or_404(Attempt, pk=pk, student=request.user)
        if attempt.status != Attempt.Status.GRADED:
            return Response({"error": "Attempt not graded."}, status=400)
        return build_certificate_pdf(attempt)
```

## 5.3 Serializers — `serializers.py`

```python
from rest_framework import serializers
from .models import Test, Section, Part, Question, Attempt


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ["id", "order", "type", "points", "answer_key",
                  "options", "headings", "placeholder_index"]


class QuestionForStudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ["id", "order", "type", "points", "options",
                  "headings", "placeholder_index"]


class PartSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    class Meta:
        model = Part
        fields = ["id", "order", "title", "instructions",
                  "content_source", "content_html",
                  "question_start", "question_end", "questions"]


class PartForStudentSerializer(serializers.ModelSerializer):
    questions = QuestionForStudentSerializer(many=True, read_only=True)
    class Meta:
        model = Part
        fields = ["id", "order", "title", "instructions",
                  "content_html",   # ← only HTML, not source
                  "question_start", "question_end", "questions"]


class SectionSerializer(serializers.ModelSerializer):
    parts = PartSerializer(many=True, read_only=True)
    audio_file_url = serializers.SerializerMethodField()
    class Meta:
        model = Section
        fields = ["id", "order", "kind", "title",
                  "audio_file_url", "audio_duration_seconds",
                  "duration_seconds", "answer_transfer_time_seconds",
                  "parts"]
    def get_audio_file_url(self, obj):
        return obj.audio_file.url if obj.audio_file else None


class SectionForStudentSerializer(SectionSerializer):
    parts = PartForStudentSerializer(many=True, read_only=True)


class TestListSerializer(serializers.ModelSerializer):
    question_count = serializers.SerializerMethodField()
    class Meta:
        model = Test
        fields = ["id", "title", "description", "type", "module",
                  "duration_minutes", "status", "is_library",
                  "uses_html_format", "published_at", "created_at",
                  "question_count"]
    def get_question_count(self, obj):
        return Question.objects.filter(part__section__test=obj).count()


class TestDetailSerializer(serializers.ModelSerializer):
    sections = SectionSerializer(many=True, read_only=True)
    class Meta:
        model = Test
        fields = ["id", "title", "description", "type", "module",
                  "duration_minutes", "status", "is_library",
                  "uses_html_format", "published_at", "sections"]


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
        fields = ["id", "test", "status", "started_at",
                  "audio_finished_at", "transfer_time_started_at",
                  "submitted_at", "answers", "raw_score",
                  "band_score", "section_band_scores",
                  "is_mistake_replay"]
```

---

# PART 6 — AUTO-GRADER (reuse from ETAP 27)

If `backend/apps/tests/grading.py` already exists from ETAP 27, keep it. The Question model still has `type` and `answer_key`, so grading logic doesn't change. Just make sure it iterates `test.sections → section.parts → part.questions` instead of `test.sections → section.questions`.

```python
def grade_attempt(attempt) -> dict:
    test = attempt.test
    raw = 0
    max_raw = 0
    per_section = {}
    for section in test.sections.all().order_by("order"):
        sec_raw = 0
        sec_max = 0
        for part in section.parts.all().order_by("order"):
            for q in part.questions.all().order_by("order"):
                if q.type in ("writing_task1", "writing_task2"):
                    continue
                sec_max += q.points
                sec_raw += grade_question(q, attempt.answers.get(str(q.id)))
        per_section[section.kind] = {"raw": sec_raw, "max": sec_max}
        raw += sec_raw
        max_raw += sec_max

    band = compute_band_scores(per_section, test.type)
    overall = band.get("overall") or band.get("listening") or band.get("reading") or 0

    attempt.raw_score = raw
    attempt.band_score = overall
    attempt.section_band_scores = band
    attempt.status = attempt.Status.GRADED
    attempt.save()
    return {"raw_score": raw, "max_raw": max_raw,
            "band_score": overall, "section_band_scores": band}
```

(Use the same Cambridge IELTS band tables from ETAP 27.)

---

# PART 7 — CERTIFICATE PDF GENERATION

`backend/apps/tests/certificate.py`:

```python
"""Render a branded certificate PDF for a graded attempt."""
import io
import qrcode
from django.http import HttpResponse
from django.conf import settings
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import Color, white, black
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader


RED = Color(0.85, 0.13, 0.18)
DARK_GREY = Color(0.20, 0.20, 0.20)
LIGHT_GREY = Color(0.90, 0.90, 0.90)


def build_certificate_pdf(attempt) -> HttpResponse:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4

    # Red diagonal stripe (top-right)
    c.setFillColor(RED)
    c.beginPath()
    p = c.beginPath()
    p.moveTo(width, height)
    p.lineTo(width, height - 8 * cm)
    p.lineTo(width - 14 * cm, height)
    p.close()
    c.drawPath(p, fill=1, stroke=0)

    # ILDIZ logo / brand
    c.setFillColor(RED)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(2 * cm, height - 2 * cm, "ILDIZ Mock")

    # Title
    c.setFillColor(DARK_GREY)
    c.setFont("Helvetica-Bold", 32)
    c.drawString(2 * cm, height - 5 * cm, "Certificate of achievement")

    # Student name
    c.setFont("Helvetica-Bold", 22)
    c.drawString(2 * cm, height - 7 * cm,
                 attempt.student.get_full_name() or attempt.student.username)

    # Score (top-right)
    c.setFillColor(RED)
    c.setFont("Helvetica-Bold", 14)
    band_label = {
        "listening": "Listening score",
        "reading": "Reading score",
        "full": "Overall score",
    }.get(attempt.test.type, "Score")
    c.drawString(width - 8 * cm, height - 7 * cm,
                 f"{band_label}  {attempt.band_score or 0}")

    # Section breakdown
    c.setFillColor(DARK_GREY)
    c.setFont("Helvetica-Bold", 11)
    y = height - 9 * cm
    sections = ["Listening", "Reading", "Writing", "Speaking"]
    x = 2 * cm
    for s in sections:
        key = s.lower()
        score = attempt.section_band_scores.get(key)
        c.drawString(x, y, s)
        c.setFont("Helvetica", 11)
        c.setFillColor(black)
        c.drawString(x, y - 0.5 * cm, str(score) if score else "Not taken")
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(DARK_GREY)
        x += 4 * cm

    # Candidate info
    y -= 3 * cm
    c.setFont("Helvetica-Bold", 13)
    c.drawString(2 * cm, y, "Candidate's information")
    c.setLineWidth(0.5)
    c.line(2 * cm, y - 0.2 * cm, 12 * cm, y - 0.2 * cm)

    y -= 1.2 * cm
    c.setFont("Helvetica-Bold", 9)
    fields = [
        ("Date of birth", attempt.student.profile.date_of_birth or "n/a"
         if hasattr(attempt.student, 'profile') else "n/a"),
        ("Report ID", str(attempt.id)[:8]),
        ("Test type", attempt.test.module.title()),
        ("Test date", attempt.submitted_at.strftime("%d/%m/%Y") if attempt.submitted_at else "n/a"),
    ]
    x = 2 * cm
    for label, value in fields:
        c.setFillColor(DARK_GREY)
        c.drawString(x, y, label)
        c.setFont("Helvetica", 9)
        c.setFillColor(black)
        c.drawString(x, y - 0.5 * cm, str(value))
        c.setFont("Helvetica-Bold", 9)
        x += 4 * cm

    # Disclaimer
    c.setFillColor(DARK_GREY)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(2 * cm, 5 * cm, "Disclaimer")
    c.setFont("Helvetica", 8)
    c.setFillColor(black)
    text = c.beginText(2 * cm, 4.5 * cm)
    text.setLeading(11)
    disclaimer = (
        "ILDIZ Mock is a practice platform designed to help you prepare for the IELTS exam. "
        "Results and certificates provided are for practice purposes only and are not a "
        "substitute for the official IELTS exam. To determine your official English language "
        "proficiency, please visit the official IELTS website: www.ielts.org"
    )
    for line in _wrap(disclaimer, 90):
        text.textLine(line)
    c.drawText(text)

    # QR code (bottom-right)
    qr_url = f"{settings.SITE_URL}/student/attempts/{attempt.id}/result"
    qr_img = qrcode.make(qr_url)
    qr_buf = io.BytesIO()
    qr_img.save(qr_buf, format="PNG")
    qr_buf.seek(0)
    c.drawImage(ImageReader(qr_buf), width - 4 * cm, 1 * cm, 3 * cm, 3 * cm)

    c.showPage()
    c.save()
    buf.seek(0)
    resp = HttpResponse(buf.getvalue(), content_type="application/pdf")
    resp["Content-Disposition"] = (
        f'attachment; filename="ildiz_certificate_{str(attempt.id)[:8]}.pdf"'
    )
    return resp


def _wrap(s: str, width: int) -> list[str]:
    out, line = [], ""
    for word in s.split():
        if len(line) + len(word) + 1 <= width:
            line = (line + " " + word).strip()
        else:
            out.append(line)
            line = word
    if line:
        out.append(line)
    return out
```

Install:
```bash
pip install reportlab qrcode[pil] --break-system-packages
echo "reportlab==4.2.5" >> requirements.txt
echo "qrcode[pil]==7.4.2" >> requirements.txt
```

---

# PART 8 — FRONTEND ROUTES

In `frontend/src/App.tsx`:

```tsx
{/* Center admin */}
<Route path="/center/tests" element={<TestsList />} />
<Route path="/center/tests/new" element={<TestEditor />} />
<Route path="/center/tests/:id/edit" element={<TestEditor />} />
<Route path="/center/library" element={<LibraryBrowser />} />

{/* Superadmin */}
<Route path="/super/library" element={<SuperadminLibrary />} />
<Route path="/super/library/new" element={<TestEditor libraryMode />} />

{/* Student */}
<Route path="/student/tests" element={<StudentTestList />} />
<Route path="/student/tests/:id" element={<PreTestScreen />} />
<Route path="/student/attempts/:attemptId" element={<TestPlayer />} />
<Route path="/student/attempts/:attemptId/result" element={<ResultScreen />} />
<Route path="/student/attempts/:attemptId/work-on-mistakes"
       element={<WorkOnMistakesScreen />} />
```

---

# PART 9 — ADMIN TEST EDITOR (4-step wizard)

This is the core admin UX. Follows the Examy.me admin pattern.

`frontend/src/pages/center/tests/TestEditor.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ContentEditor } from '@/components/test-editor/ContentEditor';
import { AnswerKeyEditor } from '@/components/test-editor/AnswerKeyEditor';
import { LivePreview } from '@/components/test-editor/LivePreview';

type Step = 1 | 2 | 3 | 4;

export default function TestEditor({ libraryMode = false }: { libraryMode?: boolean }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [step, setStep] = useState<Step>(1);
  const [testId, setTestId] = useState<string | null>(id || null);
  const [partId, setPartId] = useState<number | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'listening' | 'reading' | 'writing' | 'speaking'>('listening');
  const [module, setModule] = useState<'academic' | 'general'>('academic');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [contentSource, setContentSource] = useState('');
  const [answerText, setAnswerText] = useState('');

  // Load existing test if editing
  const { data: testData } = useQuery({
    queryKey: ['test', testId],
    queryFn: () => api.get(`/admin/tests/${testId}/`).then(r => r.data),
    enabled: isEdit,
  });
  useEffect(() => {
    if (testData) {
      setTitle(testData.title);
      setType(testData.type);
      setModule(testData.module);
      const part = testData.sections?.[0]?.parts?.[0];
      if (part) {
        setPartId(part.id);
        setContentSource(part.content_source);
      }
    }
  }, [testData]);

  // Step 1: Create test
  const createTest = useMutation({
    mutationFn: () => api.post('/admin/tests/', {
      title, type, module,
      duration_minutes: type === 'listening' ? 30 : 60,
    }),
    onSuccess: (r: any) => { setTestId(r.data.id); setStep(2); },
  });

  // Step 2: Upload audio
  const uploadAudio = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      if (audioFile) fd.append('audio_file', audioFile);
      return api.patch(`/admin/tests/${testId}/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => setStep(3),
  });

  // Step 3: Save content
  const saveContent = useMutation({
    mutationFn: () => {
      if (partId) {
        return api.patch(`/admin/parts/${partId}/`, { content_source: contentSource });
      }
      return api.post(`/admin/tests/${testId}/parts/`, {
        section_kind: type, order: 1,
        title: 'Part 1', content_source: contentSource,
        question_start: 1, question_end: 10,
      });
    },
    onSuccess: (r: any) => { setPartId(r.data.id); setStep(4); },
  });

  // Step 4: Save answer key
  const saveAnswers = useMutation({
    mutationFn: () => api.post(`/admin/parts/${partId}/answer-key/`,
                              { answer_text: answerText }),
    onSuccess: () => navigate(`/center/tests/${testId}/edit`),
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <button onClick={() => navigate('/center/tests')} className="text-sm text-gray-500">
          ← Back to tests
        </button>
        <h1 className="text-2xl font-bold">{libraryMode ? 'Library Test' : 'Create Test'}</h1>
        <div></div>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center justify-between">
        {[
          { n: 1, label: 'Test info' },
          { n: 2, label: 'Audio' },
          { n: 3, label: 'Content' },
          { n: 4, label: 'Answer key' },
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

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Test details</h2>
          <input
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Cambridge IELTS 17 Test 2 — Listening"
            className="w-full rounded border px-3 py-2"
          />
          <div className="flex gap-2">
            {(['listening', 'reading', 'writing', 'speaking'] as const).map(t => (
              <button key={t} onClick={() => setType(t)}
                      className={`rounded-full border px-4 py-1.5 text-sm capitalize ${
                        type === t ? 'border-blue-600 bg-blue-50 text-blue-700'
                                   : 'border-gray-300'}`}>
                {t}
              </button>
            ))}
          </div>
          <select value={module} onChange={e => setModule(e.target.value as any)}
                  className="rounded border px-3 py-2">
            <option value="academic">Academic</option>
            <option value="general">General Training</option>
          </select>
          <div className="flex justify-end pt-4">
            <button
              onClick={() => createTest.mutate()}
              disabled={!title.trim() || createTest.isPending}
              className="rounded-lg bg-blue-600 px-6 py-2 text-white disabled:bg-gray-300">
              {createTest.isPending ? 'Saving…' : 'Next →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Audio */}
      {step === 2 && (
        <div className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">
            Upload Audio
            {type === 'listening' && <span className="ml-2 text-sm text-red-600">(required)</span>}
          </h2>
          {type === 'listening' && (
            <input type="file" accept="audio/*"
                   onChange={e => setAudioFile(e.target.files?.[0] || null)}
                   className="block w-full text-sm" />
          )}
          {type !== 'listening' && (
            <p className="text-sm text-gray-500 italic">
              No audio needed for {type} tests. Click Next.
            </p>
          )}
          <div className="flex justify-between pt-4">
            <button onClick={() => setStep(1)} className="rounded border px-4 py-2 text-sm">
              ← Back
            </button>
            <button
              onClick={() => uploadAudio.mutate()}
              disabled={(type === 'listening' && !audioFile) || uploadAudio.isPending}
              className="rounded-lg bg-blue-600 px-6 py-2 text-white disabled:bg-gray-300">
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Content (with live preview) */}
      {step === 3 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Test content</h2>
            <ContentEditor
              source={contentSource}
              onChange={setContentSource}
              onSmartPaste={async (raw) => {
                const r = await api.post(`/admin/parts/${partId || 0}/smart-paste/`,
                                          { raw });
                return r.data.converted;
              }}
            />
            <div className="mt-4 flex justify-between">
              <button onClick={() => setStep(2)} className="rounded border px-4 py-2 text-sm">
                ← Back
              </button>
              <button
                onClick={() => saveContent.mutate()}
                disabled={!contentSource.trim() || saveContent.isPending}
                className="rounded-lg bg-blue-600 px-6 py-2 text-white disabled:bg-gray-300">
                {saveContent.isPending ? 'Saving…' : 'Next →'}
              </button>
            </div>
          </div>
          <div className="rounded-xl border bg-gray-50 p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Live Preview (what students see)
            </h3>
            <LivePreview source={contentSource} partId={partId} />
          </div>
        </div>
      )}

      {/* Step 4: Answer key */}
      {step === 4 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Answer key</h2>
            <p className="mb-3 text-sm text-gray-600">
              Paste one answer per line. Question types are auto-detected.
            </p>
            <AnswerKeyEditor value={answerText} onChange={setAnswerText} />
            <div className="mt-4 flex justify-between">
              <button onClick={() => setStep(3)} className="rounded border px-4 py-2 text-sm">
                ← Back
              </button>
              <button
                onClick={() => saveAnswers.mutate()}
                disabled={!answerText.trim() || saveAnswers.isPending}
                className="rounded-lg bg-blue-600 px-6 py-2 text-white disabled:bg-gray-300">
                {saveAnswers.isPending ? 'Saving…' : '✓ Create test'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

## 9.1 ContentEditor

`frontend/src/components/test-editor/ContentEditor.tsx`:

```tsx
import { useState } from 'react';

const SAMPLE = `## PART 1 Questions 1-10

> Write ONE WORD AND/OR A NUMBER for each answer.

[passage]
### Buckworth Conservation Group

#### Regular activities

**Beach**
- making sure the beach does not have {1} on it
- no {2}

**Nature reserve**
- maintaining paths
- nesting boxes for birds installed
- next task is taking action to attract {3} to the place
- identifying types of {4}
- building a new {5}
[/passage]
`;

export function ContentEditor({ source, onChange, onSmartPaste }: {
  source: string;
  onChange: (v: string) => void;
  onSmartPaste: (raw: string) => Promise<string>;
}) {
  const [showHelp, setShowHelp] = useState(false);
  const [pasteRaw, setPasteRaw] = useState('');
  const [showPaste, setShowPaste] = useState(false);

  const handleSmartPaste = async () => {
    const converted = await onSmartPaste(pasteRaw);
    onChange(converted);
    setShowPaste(false);
    setPasteRaw('');
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <button onClick={() => setShowHelp(!showHelp)}
                className="rounded border px-3 py-1 text-xs hover:bg-gray-50">
          {showHelp ? 'Hide' : 'Show'} syntax help
        </button>
        <button onClick={() => setShowPaste(true)}
                className="rounded border px-3 py-1 text-xs hover:bg-gray-50">
          📋 Smart paste from Cambridge
        </button>
        {!source && (
          <button onClick={() => onChange(SAMPLE)}
                  className="rounded border px-3 py-1 text-xs hover:bg-gray-50">
            ▶ Insert sample
          </button>
        )}
      </div>

      {showHelp && (
        <div className="mb-3 rounded border bg-blue-50 p-3 text-xs space-y-1">
          <p><code className="bg-white px-1">## PART 1</code> — heading level 2</p>
          <p><code className="bg-white px-1">### Subsection</code> — level 3</p>
          <p><code className="bg-white px-1">{`{1}`}</code> — inline input for question 1</p>
          <p><code className="bg-white px-1">**bold**</code> — bold text</p>
          <p><code className="bg-white px-1">- item</code> — bullet list</p>
          <p><code className="bg-white px-1">{`> text`}</code> — instructions block</p>
          <p><code className="bg-white px-1">[passage]...[/passage]</code> — gray box for the test passage</p>
          <p><code className="bg-white px-1">[mcq:5]...[/mcq]</code> — MCQ block for Q5</p>
          <p><code className="bg-white px-1">[tfng:6]...[/tfng]</code> — TF/NG question</p>
        </div>
      )}

      {showPaste && (
        <div className="mb-3 rounded border bg-yellow-50 p-3">
          <p className="mb-2 text-xs">
            Paste raw Cambridge text below (with <code>____1____</code> blanks). The system will convert it to our syntax.
          </p>
          <textarea value={pasteRaw} onChange={e => setPasteRaw(e.target.value)}
                    rows={6}
                    className="w-full rounded border bg-white p-2 text-xs font-mono" />
          <div className="mt-2 flex gap-2">
            <button onClick={handleSmartPaste}
                    className="rounded bg-blue-600 px-3 py-1 text-xs text-white">
              Convert
            </button>
            <button onClick={() => setShowPaste(false)}
                    className="rounded border px-3 py-1 text-xs">
              Cancel
            </button>
          </div>
        </div>
      )}

      <textarea
        value={source}
        onChange={e => onChange(e.target.value)}
        rows={26}
        spellCheck={false}
        placeholder="Type the test content here, or click ▶ Insert sample to start."
        className="w-full rounded-lg border bg-white p-3 font-mono text-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}
```

## 9.2 LivePreview

`frontend/src/components/test-editor/LivePreview.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { api } from '@/lib/api';
import { TestContentRenderer } from '@/components/test-player/TestContentRenderer';

export function LivePreview({ source, partId }: { source: string; partId: number | null }) {
  const debounced = useDebouncedValue(source, 500);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!debounced.trim() || !partId) return;
    api.post(`/admin/parts/${partId}/preview/`, { content_source: debounced })
       .then(r => setData(r.data));
  }, [debounced, partId]);

  if (!data) return <p className="text-sm text-gray-400">Type content to see a preview.</p>;
  if (data.errors?.length) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        {data.errors.map((e: string, i: number) => <p key={i}>⚠️ {e}</p>)}
      </div>
    );
  }
  return (
    <div>
      <p className="mb-2 text-xs text-gray-500">
        {data.question_numbers?.length} questions detected
      </p>
      {data.warnings?.map((w: string, i: number) => (
        <p key={i} className="mb-2 text-xs text-yellow-700">⚠️ {w}</p>
      ))}
      <div className="rounded border bg-white p-4">
        <TestContentRenderer html={data.html} answers={{}} onAnswer={() => {}} />
      </div>
    </div>
  );
}
```

---

# PART 10 — STUDENT TEST PLAYER (HTML-based)

## 10.1 Pre-test screen

`frontend/src/pages/student/PreTestScreen.tsx`:

```tsx
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';

export default function PreTestScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [audioOk, setAudioOk] = useState(false);
  const [testingAudio, setTestingAudio] = useState(false);

  const { data: test } = useQuery({
    queryKey: ['student-test', id],
    queryFn: () => api.get(`/student/tests/${id}/`).then(r => r.data),
  });

  const start = useMutation({
    mutationFn: () => api.post(`/student/tests/${id}/start/`),
    onSuccess: (r: any) => navigate(`/student/attempts/${r.data.attempt_id}`),
  });

  const testSpeakers = () => {
    setTestingAudio(true);
    const audio = new Audio('/test-tone.mp3');
    audio.play()
      .then(() => { setAudioOk(true); setTimeout(() => setTestingAudio(false), 2000); })
      .catch(() => alert('Could not play audio. Please check your speakers.'))
      .finally(() => setTestingAudio(false));
  };

  if (!test) return <div className="p-8">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <div className="mb-2 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-gray-100">
            {test.type === 'listening' ? '🔊' : '📖'}
          </span>
          <h1 className="text-3xl font-bold capitalize">{test.type} Test</h1>
        </div>
        <p className="mb-6 text-gray-600">
          Test your {test.type} skills with audio passages and questions.
        </p>

        {test.type === 'listening' && (
          <button
            onClick={testSpeakers}
            disabled={testingAudio}
            className="mb-6 rounded-lg bg-red-600 px-5 py-2 font-medium text-white hover:bg-red-700 disabled:bg-gray-400">
            {testingAudio ? 'Playing…' : audioOk ? '✓ Speakers OK — test again' : 'Test Speakers'}
          </button>
        )}

        <div className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <span className="text-amber-500">⚠️</span> Before you start:
          </h2>
          <ul className="space-y-2 text-sm">
            <li>📶 Ensure you have a stable internet connection</li>
            {test.type === 'listening' && (
              <li>🔊 Test your speakers - you should be able to hear audio clearly</li>
            )}
            <li>
              <span className="rounded bg-yellow-200 px-1">Highlight words</span> by selecting or
              double-clicking on them
            </li>
            {test.type === 'listening' && (
              <li className="rounded bg-yellow-50 p-3 text-amber-900">
                You will have <strong>10 minutes</strong> to transfer your answers
                (2 minutes in actual CD IELTS, 10 minutes in paper-based)
              </li>
            )}
            <li>✓ Click "Start Exam" when ready</li>
            <li>✓ Good luck with your IELTS Mock Exam!</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => start.mutate()}
            disabled={start.isPending}
            className="flex-1 rounded-lg bg-black px-6 py-3 font-medium text-white hover:bg-gray-800 disabled:bg-gray-400">
            {start.isPending ? 'Starting…' : 'Start Exam'}
          </button>
          <button
            onClick={() => navigate('/student/tests')}
            className="rounded-lg border px-6 py-3 text-blue-600 hover:bg-gray-50">
            🏠 Homepage
          </button>
        </div>
      </div>
    </div>
  );
}
```

## 10.2 Test player (the main piece)

`frontend/src/pages/student/TestPlayer.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { TestContentRenderer } from '@/components/test-player/TestContentRenderer';
import { SingleShotAudioPlayer } from '@/components/test-player/SingleShotAudioPlayer';
import { Timer } from '@/components/test-player/Timer';
import { ReviewScreen } from '@/components/test-player/ReviewScreen';

export default function TestPlayer() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [activePartIdx, setActivePartIdx] = useState(0);
  const [showReview, setShowReview] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [audioFinished, setAudioFinished] = useState(false);
  const [transferTimeStarted, setTransferTimeStarted] = useState(false);

  const { data: attempt } = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => api.get(`/student/attempts/${attemptId}/`).then(r => r.data),
  });

  useEffect(() => {
    if (attempt?.answers) setAnswers(attempt.answers);
    if (attempt?.audio_finished_at) setAudioFinished(true);
    if (attempt?.transfer_time_started_at) setTransferTimeStarted(true);
  }, [attempt]);

  const saveAnswer = useMutation({
    mutationFn: ({ qid, ans }: { qid: string; ans: any }) =>
      api.post(`/student/attempts/${attemptId}/answer/`,
                { question_id: qid, answer: ans }),
  });
  const audioFinishedMutation = useMutation({
    mutationFn: () => api.post(`/student/attempts/${attemptId}/audio-finished/`),
  });
  const startTransferTime = useMutation({
    mutationFn: () => api.post(`/student/attempts/${attemptId}/transfer-time/`),
  });
  const submit = useMutation({
    mutationFn: () => api.post(`/student/attempts/${attemptId}/submit/`),
    onSuccess: () => navigate(`/student/attempts/${attemptId}/result`),
  });
  const highlightMutation = useMutation({
    mutationFn: (data: any) =>
      api.post(`/student/attempts/${attemptId}/highlight/`, data),
  });

  const handleAnswer = (qid: string, ans: any) => {
    setAnswers(prev => ({ ...prev, [qid]: ans }));
    saveAnswer.mutate({ qid, ans });
  };

  if (!attempt) return <div className="p-8">Loading…</div>;
  const test = attempt.test;
  const section = test.sections[0];
  const parts = section.parts || [];
  const activePart = parts[activePartIdx];

  if (!activePart) return <div className="p-8">No parts found.</div>;

  const totalSec = test.duration_minutes * 60;

  if (showReview) {
    return (
      <ReviewScreen
        parts={parts}
        answers={answers}
        onBack={() => setShowReview(false)}
        onSubmit={() => submit.mutate()}
        submitting={submit.isPending}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-bold uppercase tracking-wide">
            {section.kind}
          </h1>
          {section.kind === 'listening' && !audioFinished && (
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs text-green-700">
              ▶ Playing…
            </span>
          )}
          {transferTimeStarted && (
            <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs text-yellow-700">
              ⏳ Answer Transfer Time
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {parts.map((p: any, idx: number) => (
            <button
              key={p.id}
              onClick={() => setActivePartIdx(idx)}
              className={`grid h-10 w-10 place-items-center rounded border text-sm font-bold ${
                idx === activePartIdx ? 'border-black bg-black text-white' :
                'border-gray-300 bg-white hover:bg-gray-50'
              }`}>
              {p.order}
            </button>
          ))}
          <button
            onClick={() => setActivePartIdx(idx => Math.min(parts.length - 1, idx + 1))}
            disabled={activePartIdx === parts.length - 1}
            className="grid h-10 w-10 place-items-center rounded border bg-white text-sm hover:bg-gray-50 disabled:opacity-30">
            →
          </button>
        </div>
        <div className="flex items-center gap-3">
          <Timer
            totalSeconds={totalSec}
            startedAt={attempt.started_at}
            onExpire={() => submit.mutate()}
          />
          <button
            onClick={() => setShowReview(true)}
            className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50">
            Finish
          </button>
        </div>
      </header>

      {/* Audio player (Listening only) */}
      {section.kind === 'listening' && section.audio_file_url && !audioFinished && (
        <div className="border-b bg-gray-50 px-6 py-3">
          <SingleShotAudioPlayer
            src={section.audio_file_url}
            autoPlay={true}
            onEnded={() => {
              setAudioFinished(true);
              audioFinishedMutation.mutate();
              startTransferTime.mutate();
              setTransferTimeStarted(true);
            }}
          />
        </div>
      )}

      {/* Body */}
      <main className="flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-2 text-2xl font-bold">{test.title} {section.kind.toUpperCase()}</h2>
          <h3 className="mb-1 text-xl font-bold">PART {activePart.order} Questions {activePart.question_start}-{activePart.question_end}</h3>
          {activePart.instructions && (
            <p className="mb-4 text-sm italic text-gray-700">{activePart.instructions}</p>
          )}

          <TestContentRenderer
            html={activePart.content_html}
            questions={activePart.questions}
            answers={answers}
            onAnswer={handleAnswer}
            onHighlight={(word, charOffset) => {
              highlightMutation.mutate({
                part_id: activePart.id, word, char_offset: charOffset,
              });
            }}
          />
        </div>
      </main>
    </div>
  );
}
```

## 10.3 TestContentRenderer (the heart)

`frontend/src/components/test-player/TestContentRenderer.tsx`:

```tsx
import { useMemo, useRef, useEffect, useState } from 'react';
import parse, { domToReact, Element } from 'html-react-parser';
import { TFNGRenderer } from './renderers/TFNGRenderer';
import { MCQRenderer } from './renderers/MCQRenderer';

type Props = {
  html: string;
  questions: any[];
  answers: Record<string, any>;
  onAnswer: (qid: string, ans: any) => void;
  onHighlight?: (word: string, charOffset: number) => void;
};

export function TestContentRenderer({
  html, questions, answers, onAnswer, onHighlight,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Build a lookup: question.order → question
  const qByOrder = useMemo(() => {
    const m: Record<string, any> = {};
    for (const q of questions || []) m[String(q.order)] = q;
    return m;
  }, [questions]);

  // Custom replacer for html-react-parser
  const options = {
    replace: (node: any) => {
      if (node.type !== 'tag') return undefined;
      const el = node as Element;

      // Replace <input data-q="N" /> with our controlled input
      if (el.name === 'input' && el.attribs?.['data-q']) {
        const qOrder = el.attribs['data-q'];
        const question = qByOrder[qOrder];
        if (!question) {
          return <input className="answer-input answer-input-missing" disabled placeholder="?" />;
        }
        return (
          <input
            type="text"
            value={answers[question.id] ?? ''}
            onChange={e => onAnswer(question.id, e.target.value)}
            className={`answer-input ${el.attribs.class || ''}`}
            data-q-order={qOrder}
            spellCheck={false}
            autoComplete="off"
          />
        );
      }

      // Replace MCQ blocks
      if (el.name === 'div' && el.attribs?.class?.includes('mcq-block')) {
        const qOrder = el.attribs['data-q'];
        const question = qByOrder[qOrder];
        if (question) {
          // Extract stem and options from children
          const stem = (el.children as any[])
            .filter(c => c.attribs?.class?.includes('mcq-stem'))
            .map(c => domToReact(c.children))[0];
          const optEls = (el.children as any[])
            .find(c => c.attribs?.class?.includes('mcq-options'))?.children || [];
          const options = optEls
            .filter((c: any) => c.type === 'tag')
            .map((li: any) => {
              const label = li.children?.[0];
              const inputAttrs = label?.children?.find((x: any) => x.name === 'input')?.attribs;
              const text = label?.children?.filter((x: any) => x.type !== 'tag' || x.name === 'span')
                                          .map((x: any) => domToReact([x])).pop();
              return { value: inputAttrs?.value, text };
            });
          return (
            <MCQRenderer
              question={question}
              stem={stem as any}
              options={options}
              answer={answers[question.id]}
              onAnswer={(v) => onAnswer(question.id, v)}
            />
          );
        }
      }

      // Replace TF/NG blocks
      if (el.name === 'div' && el.attribs?.class?.includes('tfng-block')) {
        const qOrder = el.attribs['data-q'];
        const question = qByOrder[qOrder];
        if (question) {
          const stem = el.children
            .filter((c: any) => c.name === 'p')
            .map((c: any) => domToReact(c.children))[0];
          return (
            <TFNGRenderer
              question={question}
              stem={stem as any}
              answer={answers[question.id]}
              onAnswer={(v) => onAnswer(question.id, v)}
            />
          );
        }
      }

      return undefined;
    },
  };

  // ─── Highlight on double-click ───
  useEffect(() => {
    if (!onHighlight || !containerRef.current) return;
    const el = containerRef.current;
    const onDblClick = (e: MouseEvent) => {
      const sel = window.getSelection();
      const word = sel?.toString().trim();
      if (!word || word.length > 50) return;
      // Wrap selection in <mark>
      try {
        const range = sel!.getRangeAt(0);
        const mark = document.createElement('mark');
        mark.style.backgroundColor = '#fef08a';
        mark.style.padding = '0 2px';
        range.surroundContents(mark);
        sel!.removeAllRanges();
        onHighlight(word, range.startOffset);
      } catch (err) {
        // surroundContents fails for cross-element selections; ignore
      }
    };
    el.addEventListener('dblclick', onDblClick);
    return () => el.removeEventListener('dblclick', onDblClick);
  }, [onHighlight]);

  return (
    <div ref={containerRef} className="test-content prose max-w-none">
      {parse(html, options)}
    </div>
  );
}
```

## 10.4 Renderers

`frontend/src/components/test-player/renderers/TFNGRenderer.tsx`:

```tsx
export function TFNGRenderer({ question, stem, answer, onAnswer }: any) {
  const opts = ['TRUE', 'FALSE', 'NOT GIVEN'];
  return (
    <div className="my-3 rounded border bg-white p-3">
      <div className="mb-2 text-sm">
        <span className="font-bold">{question.order}.</span> {stem}
      </div>
      <div className="flex gap-2">
        {opts.map(v => (
          <button key={v}
                  onClick={() => onAnswer(v)}
                  className={`flex-1 rounded border px-2 py-1 text-xs font-medium ${
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

`MCQRenderer.tsx`:

```tsx
export function MCQRenderer({ question, stem, options, answer, onAnswer }: any) {
  return (
    <div className="my-3 rounded border bg-white p-3">
      <div className="mb-2 text-sm">
        <span className="font-bold">{question.order}.</span> {stem}
      </div>
      <ul className="space-y-1.5">
        {options.map((opt: any) => (
          <li key={opt.value}>
            <label className={`flex cursor-pointer items-start gap-2 rounded border p-2 text-sm ${
              answer === opt.value ? 'border-blue-600 bg-blue-50' :
                                     'border-gray-200 hover:bg-gray-50'}`}>
              <input type="radio" name={`q${question.order}`}
                     checked={answer === opt.value}
                     onChange={() => onAnswer(opt.value)}
                     className="mt-0.5" />
              <span className="font-bold">{opt.value}.</span>
              <span>{opt.text}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## 10.5 SingleShotAudioPlayer

`frontend/src/components/test-player/SingleShotAudioPlayer.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';

export function SingleShotAudioPlayer({ src, autoPlay = true, onEnded }: {
  src: string; autoPlay?: boolean; onEnded?: () => void;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const a = ref.current; if (!a) return;
    const onMeta = () => setDuration(a.duration);
    const onTime = () => setElapsed(a.currentTime);
    const onEnd = () => { setEnded(true); onEnded?.(); };
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    if (autoPlay) {
      // Try autoplay; many browsers require a user gesture, but we got one when student clicked Start Exam
      a.play().then(() => setStarted(true)).catch(() => {});
    }
    return () => {
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
    };
  }, [autoPlay, onEnded]);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-white px-4 py-3 shadow-sm">
      <audio ref={ref} src={src} preload="auto" />
      {!started && !ended && (
        <button onClick={() => { ref.current?.play(); setStarted(true); }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white">
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
          {ended && <span className="text-sm font-medium text-gray-500">Finished</span>}
        </>
      )}
    </div>
  );
}
```

## 10.6 CSS for inline inputs

In `frontend/src/index.css`:

```css
.test-content .answer-input {
  display: inline-block;
  border: none;
  border-bottom: 2px solid #93c5fd;
  background-color: #eff6ff;
  padding: 0 4px;
  margin: 0 2px;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  outline: none;
  border-radius: 2px;
  vertical-align: baseline;
  min-width: 60px;
}
.test-content .answer-input:focus {
  background-color: #dbeafe;
  border-bottom-color: #2563eb;
}
.test-content .answer-input.input-sm { min-width: 40px; max-width: 80px; }
.test-content .answer-input.input-md { min-width: 80px; max-width: 120px; }
.test-content .answer-input.input-lg { min-width: 140px; max-width: 240px; }
.test-content .answer-input-missing {
  background-color: #fee2e2;
  border-bottom-color: #dc2626;
}

.test-content .passage-box {
  background-color: #f3f4f6;
  border-radius: 8px;
  padding: 24px;
  margin: 16px 0;
}
.test-content .callout-box {
  background-color: #fef3c7;
  border-left: 4px solid #f59e0b;
  border-radius: 4px;
  padding: 12px 16px;
  margin: 12px 0;
}
.test-content blockquote {
  font-style: italic;
  color: #6b7280;
  margin: 8px 0;
  padding-left: 12px;
  border-left: 3px solid #d1d5db;
}
.test-content h2, .test-content h3, .test-content h4 {
  margin-top: 16px;
  margin-bottom: 8px;
  font-weight: bold;
}
.test-content ul, .test-content ol {
  padding-left: 24px;
  margin: 8px 0;
}
.test-content ul li { list-style: disc; }
.test-content ol li { list-style: decimal; }
.test-content mark {
  background-color: #fef08a;
  padding: 0 2px;
}
```

---

# PART 11 — RESULT SCREEN

`frontend/src/pages/student/ResultScreen.tsx`:

```tsx
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function ResultScreen() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const { data: attempt } = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => api.get(`/student/attempts/${attemptId}/`).then(r => r.data),
  });

  const replay = useMutation({
    mutationFn: () => api.post(`/student/attempts/${attemptId}/replay-mistakes/`),
    onSuccess: (r: any) => navigate(r.data.redirect_url),
  });

  if (!attempt) return <div className="p-8">Loading…</div>;

  const allQuestions = attempt.test.sections.flatMap((s: any) =>
    s.parts.flatMap((p: any) => p.questions)
  );

  const checkAnswer = (q: any, given: any) => {
    if (given === undefined || given === null || given === '') return null;
    if (q.type === 'tfng' || q.type === 'ynng' || q.type === 'mcq_single' ||
        q.type === 'matching_headings') {
      return String(given).toLowerCase().trim() ===
             String(q.answer_key.answer).toLowerCase().trim();
    }
    if (q.type === 'mcq_multi') {
      const correct = (q.answer_key.answers || []).map((s: any) => s.toLowerCase()).sort();
      const giv = (Array.isArray(given) ? given : [given]).map((s: any) =>
                  String(s).toLowerCase()).sort();
      return JSON.stringify(correct) === JSON.stringify(giv);
    }
    if (q.type === 'completion' || q.type === 'short_answer') {
      const accepted = (q.answer_key.answers || []).map((a: any) =>
                        String(a).toLowerCase().trim());
      return accepted.includes(String(given).toLowerCase().trim());
    }
    return null;
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
        <p className="text-sm uppercase tracking-wider text-gray-500">{attempt.test.title}</p>
        <h1 className="mt-2 text-7xl font-bold text-blue-600">{attempt.band_score ?? '—'}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Raw score: {attempt.raw_score ?? 0} / {allQuestions.length}
        </p>
      </div>

      {/* Per-question table */}
      <div className="mt-6 rounded-xl border bg-white p-5">
        <h2 className="mb-3 text-base font-medium">Your answers</h2>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-gray-500">
            <tr>
              <th className="py-2 text-left">#</th>
              <th className="py-2 text-left">Your answer</th>
              <th className="py-2 text-left">Correct answer</th>
              <th className="py-2 text-right">Result</th>
            </tr>
          </thead>
          <tbody>
            {allQuestions.map((q: any) => {
              const given = attempt.answers[q.id];
              const ok = checkAnswer(q, given);
              const correctText = q.answer_key.answer
                ?? (q.answer_key.answers ? q.answer_key.answers.join(' / ') : '—');
              return (
                <tr key={q.id} className="border-t">
                  <td className="py-2 font-medium">{q.order}</td>
                  <td className="py-2">
                    {given ? (Array.isArray(given) ? given.join(', ') : given)
                           : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="py-2 text-gray-600">{correctText}</td>
                  <td className="py-2 text-right">
                    {ok === null ? <span className="text-gray-400">—</span> :
                     ok ? <span className="font-medium text-green-600">Correct</span> :
                          <span className="font-medium text-red-600">Wrong</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Work on mistakes */}
      <div className="mt-6 rounded-xl border bg-white p-5">
        <h2 className="mb-2 flex items-center gap-2 text-base font-medium">
          <span className="text-amber-500">⚠️</span> Work on your {attempt.test.type} mistakes
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          You can replay the mock exam and work on the mistakes you made.
        </p>
        <button
          onClick={() => replay.mutate()}
          disabled={replay.isPending}
          className="w-full rounded-lg bg-green-600 py-3 font-medium text-white hover:bg-green-700 disabled:bg-gray-300">
          {replay.isPending ? 'Loading…' : '▶ Start working on your mistakes'}
        </button>
      </div>

      {/* Certificate download */}
      <div className="mt-6 flex items-center justify-between rounded-xl border bg-white p-5">
        <div>
          <h2 className="text-base font-medium">Certificate</h2>
          <p className="text-sm text-gray-600">Download your achievement certificate as PDF.</p>
        </div>
        <a href={`/api/v1/tests/student/attempts/${attemptId}/certificate/`}
           target="_blank" rel="noreferrer"
           className="rounded-lg bg-red-600 px-5 py-2.5 font-medium text-white hover:bg-red-700">
          Download certificate
        </a>
      </div>
    </div>
  );
}
```

---

# PART 12 — VERIFICATION CHECKLIST

## Backend
- [ ] `python manage.py migrate` runs cleanly with new schema
- [ ] Posting source content with `{1}`, `{2}` markers parses to HTML with `<input data-q="N">`
- [ ] Smart paste converts `____1____` → `{1}` correctly
- [ ] Validation catches: missing question numbers, gaps, duplicates
- [ ] Answer key parser auto-detects types (reuse from ETAP 27)
- [ ] Question rows are created with correct `placeholder_index`

## Admin editor
- [ ] Visit `/center/tests/new` → 4-step wizard renders
- [ ] Step 1: title + type + module saved
- [ ] Step 2: audio upload (mandatory for Listening)
- [ ] Step 3: source content textarea + smart paste + sample button
- [ ] Step 3: live preview shows rendered HTML next to editor
- [ ] Step 3: errors/warnings shown live
- [ ] Step 4: paste answer key → questions auto-created
- [ ] Test appears in `/center/tests` list

## Student player
- [ ] Visit `/student/tests/<id>` → pre-test screen with Test Speakers button
- [ ] Click "Start Exam" → audio auto-plays, "Playing…" badge shown
- [ ] PART navigation tabs (1, 2, 3, 4) work — clicking switches content
- [ ] Inline inputs render inside the text (not in a separate panel)
- [ ] Typing in an input auto-saves to backend
- [ ] After audio ends → "Answer Transfer Time" badge appears
- [ ] Double-click a word → it gets highlighted yellow (and saved to backend)
- [ ] Click "Finish" → review screen with answered/unanswered counts
- [ ] Click "Submit final answers" → result page

## Result screen
- [ ] Band score shown large and red
- [ ] Per-question table: order, your answer, correct answer, Wrong/Correct
- [ ] Empty answers show "—"
- [ ] "Work on mistakes" button creates a replay attempt
- [ ] "Download certificate" downloads a PDF with correct branding

## Certificate PDF
- [ ] Has ILDIZ logo / red diagonal stripe
- [ ] Shows student full name
- [ ] Shows section band scores (Listening, Reading, Writing, Speaking)
- [ ] Shows test ID, type, date
- [ ] Has QR code that links back to result page
- [ ] Disclaimer text is readable

---

# PART 13 — DEPLOYMENT

```bash
# Local
cd ildizmock
git add .
git commit -m "ETAP 30: HTML test platform — replaces PDF approach with examy.me-style content + inline inputs + certificate"
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

# Frontend
cd ../frontend
npm install
npm install html-react-parser
npm run build

sudo supervisorctl restart ildizmock
sudo systemctl reload nginx

# Smoke test
curl -I https://ildiz-testing.uz/student/tests
curl -I https://ildiz-testing.uz/center/tests/new
sudo supervisorctl tail -f ildizmock stderr
```

---

# 🟢 MANDATORY GIT WORKFLOW

```bash
git add .
git commit -m "ETAP 30: HTML test platform — replaces PDF approach with examy.me-style content + inline inputs + certificate"
git push origin main
```

Cursor Agent: do not stop before pushing. Local-only changes are not acceptable.

---

# ⚙️ BUILD ORDER

| # | Task | Hours |
|---|------|------:|
| 1 | Models + migration (PART 1) | 1 |
| 2 | Content parser + validator (PART 3) | 4 |
| 3 | Smart paste converter (PART 4) | 1 |
| 4 | Backend admin views (PART 5.1) | 3 |
| 5 | Backend student views (PART 5.2) | 2 |
| 6 | Serializers (PART 5.3) | 0.5 |
| 7 | Auto-grader (PART 6) | 1 |
| 8 | Certificate PDF (PART 7) | 2 |
| 9 | Frontend routes (PART 8) | 0.3 |
| 10 | Admin TestEditor wizard (PART 9) | 4 |
| 11 | ContentEditor + LivePreview | 1.5 |
| 12 | PreTestScreen (PART 10.1) | 1 |
| 13 | TestPlayer (PART 10.2) | 3 |
| 14 | TestContentRenderer (PART 10.3) | 4 |
| 15 | Renderers — TFNG, MCQ (PART 10.4) | 1 |
| 16 | SingleShotAudioPlayer (PART 10.5) | 0.5 |
| 17 | CSS (PART 10.6) | 0.5 |
| 18 | ResultScreen (PART 11) | 2 |
| 19 | Verification (PART 12) | 3 |
| 20 | Deploy (PART 13) | 0.5 |

**Total: ~36 hours = 4.5 working days for one engineer.**

---

# 📌 OUT OF SCOPE — DO NOT BUILD

- ❌ PDF iframe rendering (the broken approach we're replacing)
- ❌ PDF-to-HTML auto-conversion
- ❌ Diagram Label / Map Labelling
- ❌ Writing/Speaking auto-grading
- ❌ Mobile native app
- ❌ AI content generation
- ❌ Migration of legacy PDF tests (mark them deprecated, admin re-creates manually)
- ❌ Recent Actual Tests collection
- ❌ Analytics charts

---

After this ETAP ships:
- Tests look and feel like Examy.me / IELTS Online Tests
- Inline inputs render inside the test passage (not in a separate panel)
- PART navigation works (1, 2, 3, 4)
- Audio plays once, "Answer Transfer Time" follows automatically
- Double-click highlights words
- Result page shows per-question Wrong/Correct
- "Work on mistakes" lets students replay
- Certificate PDF downloads with QR code
- Brave/Chrome/Safari all work (no PDF iframe issues)
- Mobile works

This is what real CD IELTS practice platforms look like.

---

**END OF ETAP 30.**
