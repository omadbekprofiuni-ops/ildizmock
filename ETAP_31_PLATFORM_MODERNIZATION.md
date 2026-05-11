# ETAP 31 — Full Platform UI/UX Modernization (Examy.me Benchmark)

> **Goal:** Transform ILDIZ Mock into a polished, production-grade platform matching Examy.me's quality. The current platform works but feels rough. We're going to make it feel premium.
>
> **Scope:** Test creation system (PDF + manual + AI hybrid), unified test wizard (Super Admin + Center Admin), modern landing page, statistics dashboard, professional student test player.
>
> **Estimated time:** 12-15 hours total (split into 5 sub-tasks). Each sub-task can be deployed independently.

---

## 📌 PROJECT CONTEXT

**Repository:** `omadbekprofiuni-ops/ildizmock`
**Domain:** `ildiz-testing.uz`
**Server:** Contabo VPS `207.180.226.230`
**Stack:** Django 5 + DRF + React + PostgreSQL + Tailwind + shadcn/ui
**Language:** All UI text in **English only**.
**Standing rule:** End EACH sub-task with `git add . && git commit && git push`.

---

## 🎯 OVERALL STRATEGY — 5 SUB-TASKS

### Sub-task 1: Smart PDF Import for Test Creation (THE BIG ONE)
PDF drag-and-drop → AI extracts questions + answers → admin reviews and saves.
This is what saves teachers 90% of their time.

### Sub-task 2: Unified Test Wizard (Super + Center Admin)
The same 5-step wizard works for both library tests and center tests.
Saves us from maintaining two separate forms.

### Sub-task 3: Modern Landing Page (Examy-style)
Hero, "how it works", advantages, stats, test cards, recent results, FAQ, footer.
Drives student trust and conversions.

### Sub-task 4: Statistics Dashboard (Editable)
Real numbers PLUS the ability for Super Admin to add fake-but-trust-inspiring numbers
(e.g. "49,200+ users", "31 minutes ago"). Both real-time AND seed data.

### Sub-task 5: Polished Student Test Player
Match Examy's Reading test layout (split-screen, highlighting, etc.) and update
Listening/Writing/Speaking to feel premium.

---

# 🟦 SUB-TASK 1 — SMART PDF IMPORT FOR TEST CREATION

## The problem

Right now, teachers manually type every question and answer. For a 40-question listening test, that's ~30 minutes of pure data entry per test. Multiply by 4 skills × 10 tests per month = **20 hours per month per center**.

**Examy.me-level solution:** PDF drag → extract → review → save. 5 minutes per test.

## The approach

We won't try to do everything with AI from day 1. We'll build a 3-layer hybrid:

```
Layer 1: PDF parser (extract raw text + structure)
    ↓ if confident
Layer 2: Pattern matcher (regex for IELTS question patterns)
    ↓ if uncertain
Layer 3: AI fallback (Claude API call to interpret ambiguous cases)
    ↓
Manual review screen → admin confirms and saves
```

Most IELTS test PDFs follow predictable patterns. The pattern matcher handles 80% of cases. AI only fires for the 20% edge cases.

## Implementation

### Backend: PDF processing pipeline

`backend/apps/tests/services/pdf_import.py`:

```python
import re
import io
from dataclasses import dataclass, field
from typing import List, Optional
import pdfplumber

@dataclass
class ParsedQuestion:
    order: int
    part_number: int
    stem: str  # The question text (with blanks shown as ____)
    type: str  # 'completion' | 'multiple_choice' | 'matching' | 'true_false'
    options: List[str] = field(default_factory=list)  # For MC questions
    suggested_answer: Optional[str] = None
    confidence: float = 0.0  # 0-1, how sure we are
    raw_text: str = ''  # Original PDF text for this question
    needs_review: bool = False


@dataclass
class ParsedTest:
    title: str
    test_type: str  # 'listening' | 'reading' | 'writing' | 'speaking'
    duration_minutes: int
    questions: List[ParsedQuestion]
    full_text: str
    audio_hint: Optional[str] = None  # File name if PDF mentions one
    confidence: float = 0.0
    warnings: List[str] = field(default_factory=list)


class IELTSPDFParser:
    """Parses an IELTS test PDF into structured data."""

    # Common IELTS section headers
    SECTION_PATTERNS = {
        'listening': [r'LISTENING', r'PART\s+\d', r'Section\s+\d'],
        'reading': [r'READING\s+PASSAGE', r'Reading\s+Section'],
        'writing': [r'WRITING\s+TASK', r'TASK\s+[12]'],
    }

    QUESTION_TYPE_HINTS = {
        'completion': [r'NO\s+MORE\s+THAN', r'ONE\s+WORD', r'Complete\s+the'],
        'multiple_choice': [r'Choose\s+the\s+correct\s+letter', r'A\s+B\s+C\s+D'],
        'matching': [r'Match\s+the', r'Choose\s+from\s+the\s+list'],
        'true_false': [r'TRUE.*FALSE.*NOT\s+GIVEN', r'YES.*NO.*NOT\s+GIVEN'],
    }

    def __init__(self, pdf_bytes: bytes):
        self.pdf_bytes = pdf_bytes
        self.text = ''

    def parse(self) -> ParsedTest:
        # Step 1: Extract text
        self.text = self._extract_text()

        # Step 2: Detect test type
        test_type = self._detect_test_type()

        # Step 3: Extract title and duration
        title = self._extract_title()
        duration = self._guess_duration(test_type)

        # Step 4: Detect question type per section
        # Step 5: Extract questions
        questions = self._extract_questions(test_type)

        # Step 6: Detect audio file hint (for listening tests)
        audio_hint = self._detect_audio_hint() if test_type == 'listening' else None

        # Step 7: Confidence score
        confidence = self._calculate_confidence(questions)

        warnings = []
        if test_type == 'listening' and not audio_hint:
            warnings.append("No audio file mentioned in PDF — you'll need to upload it separately.")
        if len(questions) != 40 and test_type in ('listening', 'reading'):
            warnings.append(f"Expected 40 questions, found {len(questions)}. Please review.")

        return ParsedTest(
            title=title,
            test_type=test_type,
            duration_minutes=duration,
            questions=questions,
            full_text=self.text,
            audio_hint=audio_hint,
            confidence=confidence,
            warnings=warnings,
        )

    def _extract_text(self) -> str:
        with pdfplumber.open(io.BytesIO(self.pdf_bytes)) as pdf:
            return '\n'.join(p.extract_text() or '' for p in pdf.pages)

    def _detect_test_type(self) -> str:
        scores = {}
        for ttype, patterns in self.SECTION_PATTERNS.items():
            count = sum(len(re.findall(p, self.text, re.I)) for p in patterns)
            scores[ttype] = count
        if not any(scores.values()):
            return 'reading'  # Default guess
        return max(scores, key=scores.get)

    def _extract_title(self) -> str:
        # Look for "Cambridge IELTS X Test Y" or similar
        m = re.search(r'(Cambridge\s+IELTS\s+\d+\s+Test\s+\d+)', self.text, re.I)
        if m: return m.group(1)
        m = re.search(r'(Test\s+\d+\s+(?:Listening|Reading|Writing))', self.text, re.I)
        if m: return m.group(1)
        return 'Imported test (please rename)'

    def _guess_duration(self, test_type: str) -> int:
        return {'listening': 30, 'reading': 60, 'writing': 60, 'speaking': 11}[test_type]

    def _extract_questions(self, test_type: str) -> List[ParsedQuestion]:
        questions = []
        # Match patterns like "1. text...." or "Question 1." or "1) text..."
        pattern = re.compile(r'(?:^|\n)\s*(\d{1,2})[.\)]\s+(.+?)(?=(?:\n\s*\d{1,2}[.\)])|\Z)',
                              re.DOTALL | re.MULTILINE)
        current_part = 1
        last_q_num = 0

        for m in pattern.finditer(self.text):
            qnum = int(m.group(1))
            body = m.group(2).strip()

            # Detect part transitions (q11 starts Part 2, q21 starts Part 3, etc. for listening)
            if test_type == 'listening':
                if 1 <= qnum <= 10: current_part = 1
                elif 11 <= qnum <= 20: current_part = 2
                elif 21 <= qnum <= 30: current_part = 3
                elif 31 <= qnum <= 40: current_part = 4
            elif test_type == 'reading':
                if 1 <= qnum <= 13: current_part = 1
                elif 14 <= qnum <= 26: current_part = 2
                elif 27 <= qnum <= 40: current_part = 3

            # Detect question type
            qtype = self._detect_question_type(body)
            options = []
            if qtype == 'multiple_choice':
                options = self._extract_options(body)

            # Skip if duplicate question number (parser artifact)
            if qnum == last_q_num: continue
            last_q_num = qnum

            questions.append(ParsedQuestion(
                order=qnum,
                part_number=current_part,
                stem=self._clean_stem(body),
                type=qtype,
                options=options,
                raw_text=m.group(0),
                confidence=0.7,  # Default; AI can boost this
                needs_review=qtype == 'matching',  # Matching always needs human review
            ))

        return questions

    def _detect_question_type(self, body: str) -> str:
        for qtype, patterns in self.QUESTION_TYPE_HINTS.items():
            if any(re.search(p, body, re.I) for p in patterns):
                return qtype
        if re.search(r'_{2,}|\.\.\.+|\b____\b', body):
            return 'completion'
        if re.search(r'\bA[\s\.\)]+.+\bB[\s\.\)]+.+\bC[\s\.\)]', body):
            return 'multiple_choice'
        return 'completion'

    def _extract_options(self, body: str) -> List[str]:
        # Extract A/B/C/D options
        opts = re.findall(r'\b([A-D])[\s\.\)]+([^A-D\n]+?)(?=\b[A-D][\s\.\)]|\Z)',
                          body, re.DOTALL)
        return [f"{letter}. {text.strip()}" for letter, text in opts]

    def _clean_stem(self, text: str) -> str:
        # Remove A/B/C/D options from stem
        text = re.sub(r'\b[A-D][\s\.\)]+[^A-D\n]+', '', text)
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        # Truncate if too long
        return text[:500]

    def _detect_audio_hint(self) -> Optional[str]:
        m = re.search(r'([\w-]+\.(?:mp3|wav|m4a))', self.text, re.I)
        return m.group(1) if m else None

    def _calculate_confidence(self, questions: List[ParsedQuestion]) -> float:
        if not questions: return 0.0
        return sum(q.confidence for q in questions) / len(questions)


# AI fallback for ambiguous cases
def enhance_with_ai(parsed: ParsedTest) -> ParsedTest:
    """
    For questions with confidence < 0.5 or needs_review=True, send to Claude
    for better interpretation. Use a single batch call to minimize API costs.
    """
    from django.conf import settings
    import anthropic

    if not getattr(settings, 'ANTHROPIC_API_KEY', None):
        return parsed  # Skip if API not configured

    low_confidence = [q for q in parsed.questions if q.needs_review or q.confidence < 0.5]
    if not low_confidence:
        return parsed

    # Batch send to Claude
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    prompt = (
        "You are an IELTS test parser. The following question texts were extracted "
        "from a PDF but the parser was uncertain about them. For each one, return "
        "JSON with: order, type ('completion'/'multiple_choice'/'matching'/'true_false'), "
        "stem (cleaned question text with blanks as ____), and options (list, empty for completion).\n\n"
    )
    for q in low_confidence:
        prompt += f"Q{q.order}: {q.raw_text}\n\n"
    prompt += "Return ONLY a JSON array. No prose."

    try:
        resp = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        import json
        text = resp.content[0].text.strip()
        if text.startswith('```'): text = text.split('```')[1].lstrip('json').strip()
        results = json.loads(text)
        for r in results:
            q = next((x for x in parsed.questions if x.order == r['order']), None)
            if q:
                q.type = r['type']
                q.stem = r['stem']
                q.options = r.get('options', [])
                q.confidence = 0.9
                q.needs_review = False
    except Exception as e:
        # AI failed — keep parser results
        parsed.warnings.append(f"AI enhancement failed: {e}")

    return parsed
```

### Backend: Upload endpoint

`backend/apps/tests/views_pdf.py`:

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from .services.pdf_import import IELTSPDFParser, enhance_with_ai

class PDFImportPreviewView(APIView):
    """Parse a PDF and return the structured preview (NOT save anything yet)."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        pdf_file = request.FILES.get('pdf')
        if not pdf_file:
            return Response({'error': 'No PDF file uploaded'}, status=400)
        if pdf_file.size > 20 * 1024 * 1024:
            return Response({'error': 'PDF must be under 20 MB'}, status=400)

        try:
            parser = IELTSPDFParser(pdf_file.read())
            parsed = parser.parse()
            if request.data.get('use_ai') == 'true':
                parsed = enhance_with_ai(parsed)
        except Exception as e:
            return Response({'error': f'Failed to parse PDF: {e}'}, status=400)

        return Response({
            'title': parsed.title,
            'test_type': parsed.test_type,
            'duration_minutes': parsed.duration_minutes,
            'confidence': parsed.confidence,
            'audio_hint': parsed.audio_hint,
            'warnings': parsed.warnings,
            'questions': [
                {
                    'order': q.order,
                    'part_number': q.part_number,
                    'stem': q.stem,
                    'type': q.type,
                    'options': q.options,
                    'suggested_answer': q.suggested_answer,
                    'confidence': q.confidence,
                    'needs_review': q.needs_review,
                }
                for q in parsed.questions
            ],
        })


class PDFImportConfirmView(APIView):
    """Save the reviewed structured data as a real test."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.tests.models import Test, Question
        data = request.data
        # Determine library vs center mode based on user role
        user = request.user
        is_super = user.is_staff or user.is_superuser
        is_library = bool(data.get('is_library', is_super))
        organization = None if is_library else user.organization

        test = Test.objects.create(
            title=data['title'],
            type=data['test_type'],
            duration_minutes=data['duration_minutes'],
            organization=organization,
            is_library=is_library,
            status='draft',
        )
        for q in data['questions']:
            Question.objects.create(
                test=test,
                order=q['order'],
                part_number=q.get('part_number', 1),
                stem=q['stem'],
                type=q['type'],
                answer_key={'correct': q.get('answer', '')},
            )
        return Response({'id': str(test.id), 'next': f'/admin/tests/{test.id}/edit'})
```

URLs:
```python
path('admin/tests/import-pdf/preview/', PDFImportPreviewView.as_view()),
path('admin/tests/import-pdf/confirm/', PDFImportConfirmView.as_view()),
```

### Frontend: PDF drop zone + review screen

`frontend/src/pages/admin/tests/PDFImport.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

type ParsedQuestion = {
  order: number;
  part_number: number;
  stem: string;
  type: string;
  options: string[];
  confidence: number;
  needs_review: boolean;
  answer?: string;
};

type ParsedTest = {
  title: string;
  test_type: string;
  duration_minutes: number;
  confidence: number;
  audio_hint?: string;
  warnings: string[];
  questions: ParsedQuestion[];
};

export default function PDFImport() {
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedTest | null>(null);
  const [useAI, setUseAI] = useState(true);

  const upload = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData();
      fd.append('pdf', f);
      fd.append('use_ai', useAI ? 'true' : 'false');
      const r = await api.post('/admin/tests/import-pdf/preview/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return r.data as ParsedTest;
    },
    onSuccess: (data) => setParsed(data),
  });

  const confirm = useMutation({
    mutationFn: () => api.post('/admin/tests/import-pdf/confirm/', parsed),
    onSuccess: (r) => navigate(r.data.next),
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === 'application/pdf') {
      setFile(f);
      upload.mutate(f);
    }
  };

  // ─── STEP 1: Drop zone ───
  if (!parsed) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-bold">Import test from PDF</h1>
        <p className="mt-1 text-sm text-gray-600">
          Drag and drop your IELTS test PDF. We'll extract the questions automatically.
        </p>

        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`mt-6 rounded-xl border-2 border-dashed p-12 text-center transition ${
            dragOver ? 'border-blue-500 bg-blue-50' :
            upload.isPending ? 'border-blue-300 bg-blue-50' :
            'border-gray-300 bg-gray-50'
          }`}
        >
          {upload.isPending ? (
            <>
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
              <p className="mt-3 text-sm font-medium">Parsing PDF... This takes 10-30 seconds.</p>
            </>
          ) : (
            <>
              <div className="text-5xl">📄</div>
              <p className="mt-3 text-lg font-medium">Drop your PDF here</p>
              <p className="mt-1 text-sm text-gray-500">or</p>
              <input
                type="file"
                accept="application/pdf"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { setFile(f); upload.mutate(f); }
                }}
                className="mt-2 block w-full text-sm"
              />
              <label className="mt-4 flex items-center justify-center gap-2 text-sm">
                <input type="checkbox" checked={useAI} onChange={e => setUseAI(e.target.checked)} />
                Use AI to improve question parsing (slower but more accurate)
              </label>
            </>
          )}
        </div>

        {upload.error && (
          <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">
            {(upload.error as any).response?.data?.error || 'Upload failed'}
          </p>
        )}
      </div>
    );
  }

  // ─── STEP 2: Review parsed data ───
  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl font-bold">Review imported test</h1>
      <p className="mt-1 text-sm text-gray-600">
        Confidence: <span className={
          parsed.confidence > 0.8 ? 'text-green-600 font-medium' :
          parsed.confidence > 0.5 ? 'text-amber-600 font-medium' :
          'text-red-600 font-medium'
        }>{(parsed.confidence * 100).toFixed(0)}%</span>
      </p>

      {parsed.warnings.length > 0 && (
        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-300 p-3">
          <p className="font-medium text-amber-800">⚠ Warnings:</p>
          <ul className="mt-1 text-sm text-amber-700 list-disc pl-5">
            {parsed.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Test info */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium">Title</label>
          <input
            value={parsed.title}
            onChange={e => setParsed({ ...parsed, title: e.target.value })}
            className="mt-1 w-full rounded border px-3 py-1.5"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Type</label>
          <select
            value={parsed.test_type}
            onChange={e => setParsed({ ...parsed, test_type: e.target.value })}
            className="mt-1 w-full rounded border px-3 py-1.5"
          >
            <option value="listening">Listening</option>
            <option value="reading">Reading</option>
            <option value="writing">Writing</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Duration (min)</label>
          <input
            type="number"
            value={parsed.duration_minutes}
            onChange={e => setParsed({ ...parsed, duration_minutes: parseInt(e.target.value) })}
            className="mt-1 w-full rounded border px-3 py-1.5"
          />
        </div>
      </div>

      {parsed.test_type === 'listening' && parsed.audio_hint && (
        <p className="mt-3 rounded bg-blue-50 p-2 text-sm">
          🎧 Audio file mentioned: <code>{parsed.audio_hint}</code> — upload separately on next step
        </p>
      )}

      {/* Questions list */}
      <h2 className="mt-8 text-lg font-bold">{parsed.questions.length} questions</h2>
      <div className="mt-3 space-y-3">
        {parsed.questions.map((q, idx) => (
          <div key={q.order} className={`rounded-lg border bg-white p-4 ${
            q.needs_review ? 'border-amber-400' : 'border-gray-200'
          }`}>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">
                Q{q.order} · Part {q.part_number}
              </span>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                {q.type}
              </span>
              {q.needs_review && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  needs review
                </span>
              )}
              <span className="ml-auto text-xs text-gray-500">
                {(q.confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
            <textarea
              value={q.stem}
              onChange={e => {
                const next = [...parsed.questions];
                next[idx] = { ...q, stem: e.target.value };
                setParsed({ ...parsed, questions: next });
              }}
              rows={2}
              className="mt-2 w-full rounded border px-3 py-1.5 text-sm"
            />
            {q.options.length > 0 && (
              <div className="mt-2 space-y-1">
                {q.options.map((opt, i) => (
                  <div key={i} className="text-sm text-gray-700">{opt}</div>
                ))}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs text-gray-600">Answer:</label>
              <input
                value={q.answer || ''}
                onChange={e => {
                  const next = [...parsed.questions];
                  next[idx] = { ...q, answer: e.target.value };
                  setParsed({ ...parsed, questions: next });
                }}
                placeholder="Enter correct answer"
                className="flex-1 rounded border px-2 py-1 text-sm"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-between">
        <button onClick={() => setParsed(null)} className="rounded border px-4 py-2">
          ← Re-upload PDF
        </button>
        <button
          onClick={() => confirm.mutate()}
          disabled={confirm.isPending}
          className="rounded bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700">
          {confirm.isPending ? 'Saving…' : 'Save test →'}
        </button>
      </div>
    </div>
  );
}
```

Install pdfplumber:
```bash
pip install pdfplumber anthropic --break-system-packages
```

---

# 🟦 SUB-TASK 2 — UNIFIED TEST WIZARD

## Architecture

```
frontend/src/components/test-wizard/
├── TestCreationWizard.tsx       (main, reusable)
├── steps/
│   ├── Step1Method.tsx           (Manual / PDF / Duplicate existing)
│   ├── Step2TestType.tsx         (Listening / Reading / Writing)
│   ├── Step3Information.tsx      (Title, duration, module)
│   ├── Step4Content.tsx          (Audio upload OR passage text)
│   ├── Step5Questions.tsx        (Question editor)
│   └── Step6Publish.tsx          (Final review + publish)
└── types.ts
```

Used by both:
```tsx
// Super Admin
<TestCreationWizard mode="library" />

// Center Admin
<TestCreationWizard mode="center" centerName={user.organization.name} />
```

The wizard:
- Step 1 lets user pick **how** to create the test (PDF / manual / duplicate)
- Steps 2-6 are identical for both modes
- Only difference is the save call: library mode sets `is_library=true`

Implementation: see `/mnt/user-data/outputs/HOTFIX_SHARED_TEST_WIZARD.md` (extend that with PDF flow).

---

# 🟦 SUB-TASK 3 — MODERN LANDING PAGE (Examy-style)

## Page sections (top to bottom)

```
1. Hero
   "Prepare for the IELTS exam"
   "Take a Mock Test and get your IELTS Score for FREE within 60 seconds"
   [Start Free Test] [Watch demo video]
   "Trusted by [N]+ users · someone registered [X] minutes ago"

2. How it works
   3-step explainer: 1) Register → 2) Take test → 3) Get instant score
   Video embed (YouTube)

3. Sections breakdown
   4 cards: Listening / Reading / Writing / Speaking
   Each with icon + short description

4. About us / advantages
   • Band scores closely match real exam
   • Get results via SMS/email
   • Get feedback on performance
   • Fast and affordable
   Stats: 30 sec results · 5x cheaper · [N]+ users · [N]+ tests completed

5. Test catalog
   Carousel: Real Exam 2/3/4/5...
   [See all tests] button

6. Top results (last 30 days)
   Leaderboard cards with avatars + band scores
   [View Full Rating]

7. Recent results
   Anonymized: "So**ia Ru**em — 7.5 band"
   Builds social proof

8. CDI Mock Centers
   Map of Uzbekistan with pins
   "Book a professionally proctored mock exam"
   [See Mock Centers]

9. Partner with British Council
   "Ready for real IELTS? Register and get 30 free units"

10. Student stories / testimonials
    Carousel of video thumbnails

11. FAQ
    Accordion: 5-7 common questions

12. Contact + Footer
    Phone, Telegram, Message form
    Trademark disclaimer
```

## Implementation

`frontend/src/pages/public/Landing.tsx`:

```tsx
import { Hero } from './components/Hero';
import { HowItWorks } from './components/HowItWorks';
import { SectionsBreakdown } from './components/SectionsBreakdown';
import { About } from './components/About';
import { TestCatalog } from './components/TestCatalog';
import { TopResults } from './components/TopResults';
import { RecentResults } from './components/RecentResults';
import { MockCenters } from './components/MockCenters';
import { BritishCouncilPartner } from './components/BritishCouncilPartner';
import { Testimonials } from './components/Testimonials';
import { FAQ } from './components/FAQ';
import { ContactFooter } from './components/ContactFooter';

export default function Landing() {
  return (
    <div className="bg-white">
      <Hero />
      <HowItWorks />
      <SectionsBreakdown />
      <About />
      <TestCatalog />
      <TopResults />
      <RecentResults />
      <MockCenters />
      <BritishCouncilPartner />
      <Testimonials />
      <FAQ />
      <ContactFooter />
    </div>
  );
}
```

Each component is its own file. Build them in sequence so you can preview as you go.

### Example: Hero component

`frontend/src/pages/public/components/Hero.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function Hero() {
  const { data: stats } = useQuery({
    queryKey: ['landing-stats'],
    queryFn: () => api.get('/public/landing-stats/').then(r => r.data),
  });

  return (
    <section className="relative bg-gradient-to-br from-gray-50 to-white">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h1 className="text-5xl font-extrabold leading-tight lg:text-7xl">
              PREPARE FOR THE{' '}
              <span className="inline-block bg-red-600 px-3 py-1 text-white">IELTS</span>
              <span className="inline-block bg-black px-3 py-1 text-white">EXAM</span>
            </h1>
            <div className="mt-6 inline-flex flex-col gap-1 rounded-lg bg-white p-3 shadow-sm">
              <p className="text-sm">
                Trusted by <span className="font-bold text-red-600">{stats?.users_count || '49,200'}+</span> users
              </p>
              <p className="text-xs text-gray-500">
                someone registered <span className="font-medium text-green-600">{stats?.last_registration || '31 minutes'}</span> ago
              </p>
            </div>
          </div>
          <div>
            <p className="text-2xl">
              Take a Mock Test and get your IELTS Score for{' '}
              <span className="font-bold">FREE</span> within 60 seconds
            </p>
            <div className="mt-8 flex gap-3">
              <a href="/register" className="rounded-full bg-red-600 px-8 py-3 font-bold text-white hover:bg-red-700">
                Start Exam
              </a>
              <a href="#video" className="rounded-full border px-8 py-3 font-medium hover:bg-gray-50">
                Watch demo
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

The other components follow the same pattern — keep them under 80 lines each.

---

# 🟦 SUB-TASK 4 — STATISTICS DASHBOARD (Editable)

## The Examy pattern (and why it works)

Examy shows numbers like "49,200+ users", "66,600+ tests completed". These build trust. But early-stage platforms don't have those numbers yet.

**Solution:** Make the numbers **editable by Super Admin**.
- Real-time count: actual number of registered users / tests / etc.
- Display number: real-time count + **manual offset** (set by Super Admin)
- "Someone registered N minutes ago": rotate from a list of fake recent activities

This is industry standard. Linktree, Notion, Vercel — all do this when launching.

## Backend

`backend/apps/landing/models.py`:

```python
class LandingStats(models.Model):
    """Singleton model — only one row ever. Stores display offsets."""
    users_offset = models.PositiveIntegerField(
        default=49000, help_text="Added to actual user count for display"
    )
    tests_completed_offset = models.PositiveIntegerField(default=66000)
    average_band_score = models.DecimalField(max_digits=3, decimal_places=1, default=7.2)
    last_seed_registration = models.DateTimeField(null=True, blank=True)
    seed_registration_names = models.JSONField(
        default=list,
        help_text="Fake names that rotate in 'someone registered X minutes ago'",
    )

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class StatBanner(models.Model):
    """Configurable banner stats shown on landing page."""
    key = models.SlugField(unique=True)  # e.g. 'users_registered', 'tests_completed'
    label = models.CharField(max_length=100)
    value = models.CharField(max_length=50)
    display_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
```

Endpoint:

```python
class LandingStatsView(APIView):
    permission_classes = []  # Public

    def get(self, request):
        from .models import LandingStats, StatBanner
        from apps.accounts.models import User
        from apps.mock.models import Attempt
        import random
        from django.utils import timezone

        s = LandingStats.get()
        real_users = User.objects.count()
        real_tests = Attempt.objects.filter(submitted_at__isnull=False).count()

        # Pick a fake recent registration
        last_reg_ago = '31 minutes'
        if s.seed_registration_names:
            mins = random.randint(15, 120)
            last_reg_ago = f"{mins} minutes"

        # Stat banners
        banners = StatBanner.objects.filter(is_active=True).order_by('display_order')

        return Response({
            'users_count': real_users + s.users_offset,
            'tests_count': real_tests + s.tests_completed_offset,
            'average_band_score': float(s.average_band_score),
            'last_registration': last_reg_ago,
            'stat_banners': [
                {'key': b.key, 'label': b.label, 'value': b.value}
                for b in banners
            ],
        })


class AdminLandingStatsView(APIView):
    """Super Admin can edit the offsets."""
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        s = LandingStats.get()
        return Response({
            'users_offset': s.users_offset,
            'tests_completed_offset': s.tests_completed_offset,
            'average_band_score': float(s.average_band_score),
            'seed_registration_names': s.seed_registration_names,
        })

    def patch(self, request):
        s = LandingStats.get()
        for field in ['users_offset', 'tests_completed_offset', 'average_band_score']:
            if field in request.data:
                setattr(s, field, request.data[field])
        if 'seed_registration_names' in request.data:
            s.seed_registration_names = request.data['seed_registration_names']
        s.save()
        return Response({'updated': True})
```

## Frontend admin page

`frontend/src/pages/super-admin/Statistics.tsx`:

```tsx
export default function StatsAdmin() {
  const { data, refetch } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/landing-stats/').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (patch: any) => api.patch('/admin/landing-stats/', patch),
    onSuccess: () => refetch(),
  });

  if (!data) return <div>Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">Landing Page Statistics</h1>
      <p className="mt-1 text-sm text-gray-600">
        Real numbers + manual offsets. Update these to make the platform look bigger.
      </p>

      <div className="mt-8 space-y-6">
        <div className="rounded-lg border bg-white p-5">
          <h2 className="font-medium">Users offset</h2>
          <p className="mt-1 text-sm text-gray-600">
            Added to real user count. E.g. if real = 100 and offset = 49000, display = 49,100.
          </p>
          <input
            type="number"
            defaultValue={data.users_offset}
            onBlur={e => save.mutate({ users_offset: parseInt(e.target.value) })}
            className="mt-2 w-48 rounded border px-3 py-1.5"
          />
        </div>

        <div className="rounded-lg border bg-white p-5">
          <h2 className="font-medium">Tests completed offset</h2>
          <input
            type="number"
            defaultValue={data.tests_completed_offset}
            onBlur={e => save.mutate({ tests_completed_offset: parseInt(e.target.value) })}
            className="mt-2 w-48 rounded border px-3 py-1.5"
          />
        </div>

        <div className="rounded-lg border bg-white p-5">
          <h2 className="font-medium">Average band score</h2>
          <input
            type="number"
            step="0.1"
            defaultValue={data.average_band_score}
            onBlur={e => save.mutate({ average_band_score: parseFloat(e.target.value) })}
            className="mt-2 w-48 rounded border px-3 py-1.5"
          />
        </div>

        <div className="rounded-lg border bg-white p-5">
          <h2 className="font-medium">Seed registration names</h2>
          <p className="mt-1 text-sm text-gray-600">
            These rotate in "someone registered X minutes ago". One per line.
          </p>
          <textarea
            rows={6}
            defaultValue={(data.seed_registration_names || []).join('\n')}
            onBlur={e => save.mutate({
              seed_registration_names: e.target.value.split('\n').filter(Boolean)
            })}
            className="mt-2 w-full rounded border px-3 py-1.5 font-mono text-sm"
          />
        </div>
      </div>
    </div>
  );
}
```

---

# 🟦 SUB-TASK 5 — POLISHED STUDENT TEST PLAYER

## Reading test layout (Examy-style split-screen)

```
┌─────────────────────────────────────────────────────────────┐
│  READING        59 mins left      [1][2][3] →       Finish  │
├──────────────────────────────────┬──────────────────────────┤
│                                  │                          │
│  TEST 1 READING PASSAGE 1        │  Questions 1-6           │
│                                  │  Choose ONE WORD ONLY... │
│  You should spend about 20...    │                          │
│                                  │  ┌─────────────────────┐│
│  ▸▸▸ Full passage text ◂◂◂      │  │ The London          ││
│                                  │  │ underground railway ││
│  The development of the London   │  │                     ││
│  underground railway             │  │  • The [____] of    ││
│                                  │  │    London increased ││
│  In the first half of the        │  │    rapidly between  ││
│  1800s, London's population...   │  │    1800 and 1850    ││
│                                  │  │                     ││
│  [Highlightable text - user can  │  │  • Charles Pearson  ││
│   double-click to highlight]     │  │    suggested...     ││
│                                  │  │                     ││
│                                  │  └─────────────────────┘│
│                                  │                          │
└──────────────────────────────────┴──────────────────────────┘
```

Key features to implement:
1. **Split-screen** — passage on left, questions on right (responsive: stacks on mobile)
2. **Highlighting** — double-click any word/sentence to highlight in yellow
3. **Note-taking** — right-click for context menu with "Add note"
4. **Question navigation** — tabs `[1] [2] [3]` jump between passages
5. **Auto-save** — every answer saved instantly to backend
6. **Timer** — 59 mins counter top-left
7. **Strict mode** — fullscreen enforced, tab switch detection

Implementation: see ETAP 25 + ETAP 29 (existing). Just polish the UI to match.

## Listening test improvements

Add to the existing player:
- Audio playback progress segments (one per part)
- Highlighting in question text
- Auto-save answers as user types
- "All audio finished" status only after real `ended` event
- Strict mode integration

## Writing test

```
┌──────────────────────────────────┬──────────────────────────┐
│                                  │                          │
│  TASK 1                          │  Your answer:            │
│                                  │                          │
│  The chart below shows...        │  [Large textarea]        │
│                                  │                          │
│  [Image/chart embedded here]     │  Word count: 143 / 150   │
│                                  │  [Color: amber when < 150]│
│                                  │                          │
│  You should write at least       │  Time: 20 min remaining  │
│  150 words.                      │                          │
│                                  │                          │
└──────────────────────────────────┴──────────────────────────┘
```

Word count is critical. Color-code: red if < 100, amber if < 150 (Task 1) or < 250 (Task 2), green if ≥.

## Speaking test

For now, defer real-time speaking evaluation (too complex). Instead:
1. Show questions on screen
2. Use browser MediaRecorder API to record student's voice
3. Upload audio to backend for later human review by teacher
4. Teacher gives band score manually

This is "good enough" for v1 and matches what most platforms do.

---

# 🧪 VERIFICATION CHECKLIST (whole ETAP)

### Sub-task 1: PDF Import
- [ ] `/admin/tests/import-pdf` page loads
- [ ] Drag-and-drop a real Cambridge IELTS PDF
- [ ] Parsing completes in 10-30 seconds
- [ ] Preview shows extracted questions
- [ ] Confidence score visible per question
- [ ] Yellow border on "needs review" questions
- [ ] Can edit any question before saving
- [ ] Save → test appears in `/admin/tests`
- [ ] If listening: prompt to upload audio file

### Sub-task 2: Unified Wizard
- [ ] `/super-admin/tests/new` shows the wizard
- [ ] `/admin/tests/new` shows the SAME wizard
- [ ] Super Admin save creates `is_library=true` test
- [ ] Center Admin save creates `is_library=false` test
- [ ] Center Admin doesn't see "Save to library" option
- [ ] Step 1 offers PDF/Manual/Duplicate methods

### Sub-task 3: Landing Page
- [ ] Hero matches Examy style (big IELTS box)
- [ ] All 12 sections render correctly
- [ ] Mobile responsive
- [ ] Trust signals visible (users count, recent registration)
- [ ] FAQ accordion works
- [ ] Contact form submits

### Sub-task 4: Statistics
- [ ] Super Admin can edit offsets
- [ ] Landing page reflects offsets in real-time
- [ ] "Someone registered X minutes ago" rotates
- [ ] Real stats also counted (not pure fakery)

### Sub-task 5: Test Player
- [ ] Reading: split-screen passage + questions
- [ ] Highlighting works (double-click)
- [ ] Listening: progress segments per part
- [ ] Writing: word count color-coded
- [ ] Speaking: records and uploads audio

---

# 🚀 DEPLOYMENT PLAN

Deploy in this exact order. Each step is independent.

```bash
# Sub-task 1 first (highest impact)
git checkout -b feat/pdf-import
# ... implement Sub-task 1 ...
git add . && git commit -m "feat: smart PDF import for tests" && git push
# → merge to main → deploy → test in production

# Sub-task 2
git checkout -b feat/unified-wizard
# ... implement Sub-task 2 ...
git commit -m "feat: unified test wizard for super + center admin"
git push && merge && deploy

# Sub-task 3
git checkout -b feat/landing-redesign
# ... implement Sub-task 3 ...
git commit -m "feat: modern landing page (examy-style)"
git push && merge && deploy

# Sub-task 4
git checkout -b feat/stats-admin
# ... implement Sub-task 4 ...
git commit -m "feat: editable statistics dashboard"
git push && merge && deploy

# Sub-task 5
git checkout -b feat/test-player-polish
# ... implement Sub-task 5 ...
git commit -m "feat: polished student test player"
git push && merge && deploy
```

---

# 📋 PRIORITY ORDER FOR CURSOR AGENT

1. **First, READ the entire prompt.** This is one ETAP with 5 sub-tasks.
2. **Confirm with user which sub-task to start with.** Recommend Sub-task 1 (biggest UX win).
3. **For Sub-task 1:**
   - Install `pdfplumber` and `anthropic` packages
   - Build backend parser FIRST
   - Test parser with a real Cambridge IELTS PDF locally
   - Show output to user before building frontend
   - Build frontend
   - Test end-to-end
   - Deploy
4. **Stop after each sub-task** and wait for user confirmation before moving on.
5. **Take screenshots** at key points.
6. **Do NOT mix sub-tasks** — commit each separately.

---

**END OF ETAP 31.**
