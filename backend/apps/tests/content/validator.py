"""ETAP 30 — Content validator.

Manba matn va answer_key dict'idan kelishuvni tekshiradi:
- {N} markerlar uchun answer_key'da N raqami mavjudmi
- answer_key'da bo'lgan, lekin matnda yo'q raqamlar (extra)
- [mcq:N] / [tfng:N] / [matching:A-B] block'larda answer_key mosligi
- Question raqamlari ketma-ket (1, 2, 3, ...) bo'lishi
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

INPUT_MARKER_RE = re.compile(r'\{(\d{1,3})(?::[A-Z]+)?\}')
MCQ_OPEN_RE = re.compile(r'^\[mcq:(\d+)\]\s*$', re.MULTILINE)
TFNG_OPEN_RE = re.compile(r'^\[(?:tfng|ynng):(\d+)\]\s*$', re.MULTILINE)
MATCHING_OPEN_RE = re.compile(r'^\[matching:(\d+)-(\d+)\]\s*$', re.MULTILINE)


@dataclass
class ValidationResult:
    ok: bool = True
    declared_questions: list[int] = field(default_factory=list)
    answered_questions: list[int] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def extract_question_numbers(source: str) -> list[int]:
    """Manba matnidan barcha savol raqamlarini chiqaradi (sortlangan, unique)."""
    nums: set[int] = set()

    for m in INPUT_MARKER_RE.finditer(source):
        nums.add(int(m.group(1)))

    for m in MCQ_OPEN_RE.finditer(source):
        nums.add(int(m.group(1)))

    for m in TFNG_OPEN_RE.finditer(source):
        nums.add(int(m.group(1)))

    for m in MATCHING_OPEN_RE.finditer(source):
        first, last = int(m.group(1)), int(m.group(2))
        for n in range(first, last + 1):
            nums.add(n)

    return sorted(nums)


def validate_content(
    source: str,
    answer_key: dict | None = None,
) -> ValidationResult:
    """Manba va answer_key kelishuvini tekshiradi.

    answer_key dict shaklida bo'lishi kerak: `{1: 'answer', 2: 'TRUE', ...}`.
    String kalit ham qabul qilinadi (avtomatik int'ga aylantiriladi).
    """
    result = ValidationResult()

    if not source or not source.strip():
        result.ok = False
        result.errors.append('Content is empty.')
        return result

    declared = extract_question_numbers(source)
    result.declared_questions = declared

    if not declared:
        result.warnings.append(
            'No question markers detected (e.g. {1}, [mcq:N], [tfng:N]).',
        )

    answered: set[int] = set()
    if answer_key:
        for k in answer_key.keys():
            try:
                answered.add(int(k))
            except (ValueError, TypeError):
                continue
    result.answered_questions = sorted(answered)

    declared_set = set(declared)
    missing = sorted(declared_set - answered)
    extra = sorted(answered - declared_set)

    if missing:
        result.ok = False
        result.errors.append(
            f'Questions in content but missing answer keys: {missing}',
        )
    if extra:
        result.warnings.append(
            f'Answer keys with no matching question marker: {extra}',
        )

    if declared:
        # Ketma-ket emasligi (gaps) haqida ogohlantirish
        gaps = [
            n
            for n in range(declared[0], declared[-1] + 1)
            if n not in declared_set
        ]
        if gaps:
            result.warnings.append(f'Gaps in question numbering: {gaps}')

    return result
