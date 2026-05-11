"""ETAP 31 — Smart PDF Import for IELTS test creation.

PDF → structured questions preview → admin reviews → save as Test rows.

3-layer hybrid:
  Layer 1: pdfplumber — extract raw text
  Layer 2: regex pattern matcher — IELTS question patterns (handles ~80%)
  Layer 3: AI fallback (Claude/Gemini) — provider abstraction in
           `ai_providers/`. `use_ai=True` bo'lsa, butun PDF AI'ga yuboriladi
           va schema'ga mos JSON qaytariladi (ETAP 16.7).

Returned `ParsedTest` is editable JSON sent to the frontend review screen.
The save step is a separate pass (`PDFImportConfirmView`) — this module
does NOT touch the database.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

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
# ETAP 16.7 — AI provider full-PDF parsing
# ============================================

# Schema'dagi question_type (Gemini/Claude) → mavjud parser type
_AI_QTYPE_TO_PARSER = {
    'multiple_choice': 'multiple_choice',
    'true_false_not_given': 'true_false',
    'yes_no_not_given': 'true_false',
    'fill_in_blank': 'completion',
    'matching': 'matching',
    'short_answer': 'completion',
    'sentence_completion': 'completion',
    'summary_completion': 'completion',
    'diagram_labeling': 'completion',
    'essay': 'completion',  # writing tasks — admin reviews
}

# Schema section_type → mavjud test_type
_AI_SECTION_TO_TEST_TYPE = {
    'listening': 'listening',
    'reading': 'reading',
    'writing': 'writing',
    'full': 'reading',  # multi-section PDF — Admin can change later
}


@dataclass
class AIParsedResult:
    """ETAP 16.7 — Provider'dan kelgan natija + ParsedTest formatiga
    aylantirilgan ko'rinish. View'da quota/log uchun token/cost ham ishlatiladi.
    """

    parsed: ParsedTest
    provider_name: str
    model_used: str
    tokens_used: int
    cost_usd: float


def _ai_data_to_parsed_test(data: Dict[str, Any]) -> ParsedTest:
    """AI schema (test_metadata + sections) → mavjud `ParsedTest`."""
    metadata = data.get('test_metadata') or {}
    section_type = (metadata.get('section_type') or '').lower()
    test_type = _AI_SECTION_TO_TEST_TYPE.get(section_type, 'reading')

    title = (
        metadata.get('title')
        or (
            f"{metadata.get('source_book', '')} {metadata.get('test_number', '')}".strip()
        )
        or 'Imported test (please rename)'
    )

    duration = metadata.get('duration_minutes')
    if not isinstance(duration, int) or duration <= 0:
        duration = {'listening': 30, 'reading': 60, 'writing': 60}.get(test_type, 60)

    questions: List[ParsedQuestion] = []
    full_text_parts: List[str] = []

    sections = data.get('sections') or []
    for section in sections:
        part_no = int(section.get('section_number') or 1)
        passage = (section.get('passage') or '').strip()
        if passage:
            full_text_parts.append(passage)

        for q in section.get('questions') or []:
            qnum_raw = q.get('question_number')
            try:
                order = int(qnum_raw)
            except (TypeError, ValueError):
                order = len(questions) + 1

            ai_type = (q.get('question_type') or '').lower()
            parser_type = _AI_QTYPE_TO_PARSER.get(ai_type, 'completion')
            options_in = q.get('options') or []
            options: List[str] = []
            for idx, opt in enumerate(options_in):
                opt_text = (opt or '').strip()
                if not opt_text:
                    continue
                # MCQ uchun "A. text" formatiga normalizatsiya — preview UI
                # shu shaklni kutadi.
                if (
                    parser_type == 'multiple_choice'
                    and len(opt_text) > 2
                    and not opt_text[1:3] in ('. ', ') ')
                ):
                    letter = chr(ord('A') + idx)
                    options.append(f'{letter}. {opt_text}')
                else:
                    options.append(opt_text)

            stem = (q.get('question_text') or '').strip()
            answer = (q.get('correct_answer') or '').strip()

            questions.append(
                ParsedQuestion(
                    order=order,
                    part_number=part_no,
                    stem=stem,
                    type=parser_type,
                    options=options,
                    suggested_answer=answer or None,
                    confidence=0.92,  # AI muvaffaqiyatli parse qildi
                    raw_text=stem[:1000],
                    needs_review=False,
                ),
            )

    questions.sort(key=lambda q: q.order)

    audio_refs = data.get('audio_references') or []
    audio_hint = audio_refs[0] if audio_refs else None

    warnings: List[str] = []
    if test_type == 'listening' and not audio_hint:
        warnings.append(
            "No audio file mentioned in PDF — you'll need to upload it separately.",
        )
    if test_type in ('listening', 'reading') and len(questions) not in (40,):
        warnings.append(
            f'Expected 40 questions, AI found {len(questions)}. Please review.',
        )
    if not questions:
        warnings.append('AI returned no questions — please switch to manual entry.')

    return ParsedTest(
        title=title,
        test_type=test_type,
        duration_minutes=duration,
        questions=questions,
        full_text='\n\n'.join(full_text_parts),
        audio_hint=audio_hint,
        confidence=0.92 if questions else 0.0,
        warnings=warnings,
    )


def parse_pdf_with_ai(
    pdf_bytes: bytes,
    *,
    hint_section_type: Optional[str] = None,
) -> Optional[AIParsedResult]:
    """Provider abstraction orqali PDF'ni AI'ga yuboradi.

    Muvaffaqiyatli bo'lsa `AIParsedResult` (parsed + token usage) qaytaradi.
    Provider xato bersa — `RuntimeError`. Provider yaratish ham xato bersa
    (API key yo'q va h.k.) yuqoriga qayta uloqtiradi.
    """
    from .ai_providers import get_ai_provider

    provider = get_ai_provider()
    result = provider.parse_ielts_pdf(
        pdf_bytes, hint_section_type=hint_section_type,
    )
    if not result.success:
        raise RuntimeError(result.error_message or 'AI parse failed')

    parsed = _ai_data_to_parsed_test(result.data or {})
    info = provider.info()
    return AIParsedResult(
        parsed=parsed,
        provider_name=info.name,
        model_used=result.model_used or info.model,
        tokens_used=result.tokens_used,
        cost_usd=result.cost_usd,
    )
