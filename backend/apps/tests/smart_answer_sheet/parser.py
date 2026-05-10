"""ETAP 27 PART 3 — Smart Answer Sheet parser.

Faqat answer key matnidan savol turini avtomatik aniqlaydi:

  TRUE / FALSE / NOT GIVEN  → tfng
  YES / NO / NOT GIVEN      → ynng
  A, B, C (yagona harf)     → mcq_single
  A,C  yoki  A & C          → mcq_multi
  i, ii, iii, iv, v ...     → matching_headings
  '10:30' / '2500' / '14.5' → completion (numeric)
  bir-uch so'z              → completion
  uzun matn                 → short_answer

Hech qanday AI yo'q — sof regex va heuristik qoidalar.
"""
from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field


# ─────────────────────────────────────────────────────────────
# Token to'plamlari
# ─────────────────────────────────────────────────────────────

TFNG_TOKENS = {'TRUE', 'FALSE', 'NOT GIVEN', 'T', 'F', 'NG'}
YNNG_TOKENS_NON_OVERLAP = {'YES', 'NO'}
ROMAN_NUMERALS = {
    'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
    'xi', 'xii', 'xiii', 'xiv', 'xv',
}


def detect_type_for_single_answer(raw: str) -> str:
    """Bitta javob asosida turini qaytaradi.

    Mumkin bo'lgan qiymatlar:
      tfng | ynng | tfng_or_ynng | mcq_single | mcq_multi |
      matching_headings | completion | short_answer | unknown
    """
    if not raw or not raw.strip():
        return 'unknown'

    cleaned = raw.strip()
    upper = cleaned.upper()
    lower = cleaned.lower()

    # Y/N (NOT GIVEN bilan crash bo'lmasligi uchun TFNG'dan oldin tekshirish)
    if upper in YNNG_TOKENS_NON_OVERLAP:
        return 'ynng'

    # T/F (NOT GIVEN'dan tashqari)
    if upper in TFNG_TOKENS - {'NOT GIVEN', 'NG'}:
        return 'tfng'

    # NOT GIVEN — TFNG yoki YNNG bo'lishi mumkin → guruh qaror qiladi
    if upper in {'NOT GIVEN', 'NG'}:
        return 'tfng_or_ynng'

    # MCQ multi: A,C  /  A & C  /  A, B, C
    if re.match(r'^[A-J](\s*[,&]\s*[A-J]){1,4}$', upper):
        return 'mcq_multi'

    # MCQ single: yagona harf
    if re.match(r'^[A-J]$', upper):
        return 'mcq_single'

    # Matching headings: rim raqamlari
    if lower in ROMAN_NUMERALS:
        return 'matching_headings'

    # Vaqt / raqam / qisqa raqam (`10:30`, `2,500`, `14.5`)
    if re.match(r'^[\d.,/:\-]+$', cleaned):
        return 'completion'

    # 1–4 so'z → completion
    word_count = len(cleaned.split())
    if word_count <= 4:
        return 'completion'

    # Uzunroq → short_answer
    return 'short_answer'


def consolidate_group_type(detected_types: list[str]) -> str:
    """Guruhdagi javoblar ro'yxatidan dominant turini chiqaradi."""
    if not detected_types:
        return 'unknown'

    has_tfng = 'tfng' in detected_types
    has_ynng = 'ynng' in detected_types
    resolved: list[str] = []
    for t in detected_types:
        if t == 'tfng_or_ynng':
            if has_ynng and not has_tfng:
                resolved.append('ynng')
            else:
                resolved.append('tfng')
        else:
            resolved.append(t)

    most_common, count = Counter(resolved).most_common(1)[0]
    if count >= len(resolved) * 0.7:
        return most_common
    return 'mixed'


# ─────────────────────────────────────────────────────────────
# Javoblar matnini parsing
# ─────────────────────────────────────────────────────────────

ANSWER_LINE_RE = re.compile(
    r'^\s*(\d{1,3})[\.\)\:\s\t]+(.+?)\s*$',
    re.MULTILINE,
)


def parse_answer_lines(raw_text: str) -> dict[int, str]:
    """`1. station` / `1) iv` / `1: TRUE` / `1<TAB>A` formatlarini qabul qiladi."""
    out: dict[int, str] = {}
    for m in ANSWER_LINE_RE.finditer(raw_text):
        n = int(m.group(1))
        if n in out:
            continue  # birinchi takrorga ustunlik beriladi
        out[n] = m.group(2).strip()
    return out


# ─────────────────────────────────────────────────────────────
# Guruh detektsiyasi
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
    """Tartiblangan javoblarni iteratsiya qiladi va tur o'zgarganda yangi
    guruh boshlaydi.
    """
    if not answers:
        return []

    sorted_nums = sorted(answers.keys())
    qinfos: list[QuestionInfo] = []
    for n in sorted_nums:
        ans = answers[n]
        t = detect_type_for_single_answer(ans)
        qinfos.append(QuestionInfo(
            order=n,
            raw_answer=ans,
            qtype=t,
            confidence=0.95 if t not in ('unknown', 'tfng_or_ynng') else 0.7,
            reason=f"detected from answer {ans[:30]!r}",
        ))

    groups: list[QuestionGroup] = []
    current = QuestionGroup(
        start=qinfos[0].order, end=qinfos[0].order, qtype=qinfos[0].qtype,
    )
    current.questions.append(qinfos[0])

    for q in qinfos[1:]:
        compatible = (
            q.qtype == current.qtype
            or (q.qtype == 'tfng_or_ynng' and current.qtype in ('tfng', 'ynng'))
            or (current.qtype == 'tfng_or_ynng' and q.qtype in ('tfng', 'ynng'))
        )
        if compatible:
            current.questions.append(q)
            current.end = q.order
        else:
            current.qtype = consolidate_group_type(
                [qi.qtype for qi in current.questions],
            )
            groups.append(current)
            current = QuestionGroup(start=q.order, end=q.order, qtype=q.qtype)
            current.questions.append(q)

    current.qtype = consolidate_group_type(
        [qi.qtype for qi in current.questions],
    )
    groups.append(current)
    return groups


# ─────────────────────────────────────────────────────────────
# JSON answer_key qurilishi
# ─────────────────────────────────────────────────────────────

def build_answer_key(qtype: str, raw_answer: str) -> dict:
    """Xom javob → strukturali JSON answer_key."""
    a = raw_answer.strip()

    if qtype in ('tfng', 'ynng'):
        return {'answer': a.upper()}
    if qtype == 'mcq_single':
        return {'answer': a.upper()}
    if qtype == 'mcq_multi':
        parts = re.split(r'[,&\s]+', a.upper())
        return {'answers': [p for p in parts if p]}
    if qtype == 'matching_headings':
        return {'answer': a.lower()}
    if qtype in ('completion', 'short_answer'):
        # `/` yoki ` OR ` orqali alternativlar
        alternates = [
            x.strip()
            for x in re.split(r'\s*(?:/| OR )\s*', a)
            if x.strip()
        ]
        return {'answers': alternates}
    return {'raw': a}


# ─────────────────────────────────────────────────────────────
# Asosiy entry point
# ─────────────────────────────────────────────────────────────

@dataclass
class ParseResult:
    total_questions: int
    groups: list[QuestionGroup] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def parse_answer_key_text(raw_text: str) -> ParseResult:
    """Top-level: javob kalit matnini ParseResult'ga aylantiradi."""
    if not raw_text or not raw_text.strip():
        return ParseResult(total_questions=0, errors=['Answer key is empty'])

    answers = parse_answer_lines(raw_text)
    if not answers:
        return ParseResult(
            total_questions=0,
            errors=[
                "No '1. answer' lines detected. Use format like "
                "'1   station' on each line.",
            ],
        )

    groups = group_questions_by_type(answers)
    result = ParseResult(total_questions=len(answers), groups=groups)

    nums = sorted(answers.keys())
    expected = list(range(min(nums), max(nums) + 1))
    missing = sorted(set(expected) - set(nums))
    if missing:
        result.warnings.append(f'Missing answers for questions: {missing}')

    if any(g.qtype in ('unknown', 'mixed') for g in groups):
        result.warnings.append(
            'Some groups have ambiguous types — review them in the preview.',
        )

    return result
