"""ETAP 31 — Smart PDF Import for IELTS test creation.

PDF → structured questions preview → admin reviews → save as Test rows.

3-layer hybrid:
  Layer 1: pdfplumber — extract raw text
  Layer 2: regex pattern matcher — IELTS question patterns (handles ~80%)
  Layer 3: AI fallback (Claude) — only fires for low-confidence questions

Returned `ParsedTest` is editable JSON sent to the frontend review screen.
The save step is a separate pass (`PDFImportConfirmView`) — this module
does NOT touch the database.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from typing import List, Optional

import pdfplumber


# ============================================
# Public dataclasses
# ============================================

@dataclass
class ParsedQuestion:
    order: int
    part_number: int
    stem: str                      # blanks shown as ____
    type: str                      # 'completion' | 'multiple_choice' | 'matching' | 'true_false'
    options: List[str] = field(default_factory=list)
    suggested_answer: Optional[str] = None
    confidence: float = 0.0        # 0..1
    raw_text: str = ''
    needs_review: bool = False


@dataclass
class ParsedTest:
    title: str
    test_type: str                 # 'listening' | 'reading' | 'writing'
    duration_minutes: int
    questions: List[ParsedQuestion]
    full_text: str
    audio_hint: Optional[str] = None
    confidence: float = 0.0
    warnings: List[str] = field(default_factory=list)


# ============================================
# Parser
# ============================================

class IELTSPDFParser:
    """Parse an IELTS test PDF into a structured `ParsedTest`."""

    SECTION_PATTERNS = {
        'listening': [r'\bLISTENING\b', r'\bPART\s+\d', r'\bSection\s+\d'],
        'reading':   [r'READING\s+PASSAGE', r'Reading\s+Section', r'\bPASSAGE\s+\d'],
        'writing':   [r'WRITING\s+TASK', r'\bTASK\s+[12]\b'],
    }

    QUESTION_TYPE_HINTS = {
        'completion':      [r'NO\s+MORE\s+THAN', r'ONE\s+WORD', r'Complete\s+the'],
        'multiple_choice': [r'Choose\s+the\s+correct\s+letter', r'\bA\b\s+\bB\b\s+\bC\b'],
        'matching':        [r'Match\s+the', r'Choose\s+from\s+the\s+list'],
        'true_false':      [r'TRUE.*FALSE.*NOT\s+GIVEN', r'YES.*NO.*NOT\s+GIVEN'],
    }

    def __init__(self, pdf_bytes: bytes):
        self.pdf_bytes = pdf_bytes
        self.text = ''

    # ---------- main ----------

    def parse(self) -> ParsedTest:
        self.text = self._extract_text()
        if not self.text.strip():
            return ParsedTest(
                title='Imported test (please rename)',
                test_type='reading',
                duration_minutes=60,
                questions=[],
                full_text='',
                warnings=['No text found in PDF (it may be a scanned image).'],
            )

        test_type = self._detect_test_type()
        title = self._extract_title()
        duration = self._guess_duration(test_type)
        questions = self._extract_questions(test_type)
        audio_hint = self._detect_audio_hint() if test_type == 'listening' else None
        confidence = self._calculate_confidence(questions)

        warnings: List[str] = []
        if test_type == 'listening' and not audio_hint:
            warnings.append(
                "No audio file mentioned in PDF — you'll need to upload it separately."
            )
        if test_type in ('listening', 'reading') and len(questions) != 40:
            warnings.append(
                f"Expected 40 questions, found {len(questions)}. Please review."
            )
        if not questions:
            warnings.append('No questions detected — please switch to manual entry.')

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

    # ---------- helpers ----------

    def _extract_text(self) -> str:
        try:
            with pdfplumber.open(io.BytesIO(self.pdf_bytes)) as pdf:
                return '\n'.join((p.extract_text() or '') for p in pdf.pages)
        except Exception:
            return ''

    def _detect_test_type(self) -> str:
        scores = {}
        for ttype, patterns in self.SECTION_PATTERNS.items():
            scores[ttype] = sum(
                len(re.findall(p, self.text, re.I)) for p in patterns
            )
        if not any(scores.values()):
            return 'reading'
        return max(scores, key=scores.get)

    def _extract_title(self) -> str:
        m = re.search(r'(Cambridge\s+IELTS\s+\d+\s+Test\s+\d+)', self.text, re.I)
        if m:
            return m.group(1)
        m = re.search(
            r'(Test\s+\d+\s+(?:Listening|Reading|Writing))', self.text, re.I,
        )
        if m:
            return m.group(1)
        return 'Imported test (please rename)'

    def _guess_duration(self, test_type: str) -> int:
        return {
            'listening': 30,
            'reading': 60,
            'writing': 60,
            'speaking': 11,
        }.get(test_type, 60)

    def _extract_questions(self, test_type: str) -> List[ParsedQuestion]:
        questions: List[ParsedQuestion] = []
        # Match "1. text..." / "1) text..." / "Question 1. text..."
        pattern = re.compile(
            r'(?:^|\n)\s*(?:Question\s+)?(\d{1,2})[.\)]\s+(.+?)'
            r'(?=(?:\n\s*(?:Question\s+)?\d{1,2}[.\)])|\Z)',
            re.DOTALL | re.MULTILINE,
        )

        last_q_num = 0
        for m in pattern.finditer(self.text):
            qnum = int(m.group(1))
            if qnum == last_q_num:
                continue
            if qnum < 1 or qnum > 40:
                continue
            last_q_num = qnum

            body = m.group(2).strip()
            current_part = self._part_for(test_type, qnum)
            qtype = self._detect_question_type(body)
            options = self._extract_options(body) if qtype == 'multiple_choice' else []

            questions.append(ParsedQuestion(
                order=qnum,
                part_number=current_part,
                stem=self._clean_stem(body, options),
                type=qtype,
                options=options,
                raw_text=m.group(0)[:1000],
                confidence=0.7,
                needs_review=(qtype == 'matching'),
            ))
        return questions

    @staticmethod
    def _part_for(test_type: str, qnum: int) -> int:
        if test_type == 'listening':
            if 1 <= qnum <= 10: return 1
            if 11 <= qnum <= 20: return 2
            if 21 <= qnum <= 30: return 3
            return 4
        if test_type == 'reading':
            if 1 <= qnum <= 13: return 1
            if 14 <= qnum <= 26: return 2
            return 3
        return 1

    def _detect_question_type(self, body: str) -> str:
        for qtype, patterns in self.QUESTION_TYPE_HINTS.items():
            if any(re.search(p, body, re.I) for p in patterns):
                return qtype
        if re.search(r'_{2,}|\.{3,}', body):
            return 'completion'
        # Cambridge MCQ on a single line: "stem A foo B bar C baz"
        if re.search(
            r'\sA\s+\S.+?\sB\s+\S.+?\sC\s+\S',
            body, re.DOTALL,
        ):
            return 'multiple_choice'
        return 'completion'

    @staticmethod
    def _extract_options(body: str) -> List[str]:
        opts = re.findall(
            r'\b([A-D])[\s\.\)]+([^A-D\n]+?)(?=\s+[A-D][\s\.\)]|\Z)',
            body, re.DOTALL,
        )
        return [f"{letter}. {text.strip()}" for letter, text in opts]

    @staticmethod
    def _clean_stem(text: str, options: List[str]) -> str:
        # If options were extracted, strip them out so they don't repeat in the stem.
        if options:
            text = re.sub(
                r'\b[A-D][\s\.\)]+[^A-D\n]+', '', text,
            )
        text = re.sub(r'\s+', ' ', text).strip()
        return text[:500]

    def _detect_audio_hint(self) -> Optional[str]:
        m = re.search(r'([\w\-\.]+\.(?:mp3|wav|m4a))', self.text, re.I)
        return m.group(1) if m else None

    @staticmethod
    def _calculate_confidence(questions: List[ParsedQuestion]) -> float:
        if not questions:
            return 0.0
        return sum(q.confidence for q in questions) / len(questions)


# ============================================
# AI fallback (optional — gated by ANTHROPIC_API_KEY)
# ============================================

def enhance_with_ai(parsed: ParsedTest) -> ParsedTest:
    """Send low-confidence / needs-review questions to Claude in one batch.

    No-op if `ANTHROPIC_API_KEY` is not configured. Always swallows errors
    (degrades gracefully — original parser results stay).
    """
    from django.conf import settings

    api_key = getattr(settings, 'ANTHROPIC_API_KEY', None)
    if not api_key:
        return parsed

    low_confidence = [
        q for q in parsed.questions
        if q.needs_review or q.confidence < 0.5
    ]
    if not low_confidence:
        return parsed

    try:
        import anthropic
        import json

        client = anthropic.Anthropic(api_key=api_key)
        prompt_parts = [
            "You are an IELTS test parser. The following question texts were "
            "extracted from a PDF but the parser was uncertain about them. For "
            "each one, return JSON with: order (int), type (one of "
            "'completion', 'multiple_choice', 'matching', 'true_false'), "
            "stem (cleaned question text with blanks as ____), and options "
            "(list of strings, empty for completion). Return ONLY a JSON "
            "array. No prose.\n\n",
        ]
        for q in low_confidence:
            prompt_parts.append(f"Q{q.order}: {q.raw_text}\n\n")
        prompt = ''.join(prompt_parts)

        resp = client.messages.create(
            model='claude-sonnet-4-6',
            max_tokens=2000,
            messages=[{'role': 'user', 'content': prompt}],
        )
        text = resp.content[0].text.strip()
        if text.startswith('```'):
            text = text.split('```', 2)[1].lstrip('json').strip()
        results = json.loads(text)
        for r in results:
            q = next((x for x in parsed.questions if x.order == r.get('order')), None)
            if q:
                q.type = r.get('type', q.type)
                q.stem = r.get('stem', q.stem)
                q.options = r.get('options', q.options) or []
                q.confidence = 0.9
                q.needs_review = False
    except Exception as exc:
        parsed.warnings.append(f'AI enhancement skipped: {exc}')

    return parsed
