"""ETAP 25 — auto-grader for all IELTS objective question types.

Grades a student `Attempt` and writes:
- raw_score, total_questions, band_score (overall)
- section_band_scores: per-skill {raw, max, band}
- per-Answer is_correct + points_earned

Question types supported (per ETAP 25 §2):
  TFNG / YNNG / MCQ-single / MCQ-multi
  Matching Headings / Information / Features / Sentence Endings
  Sentence / Summary / Form Completion
  Short Answer / Diagram Label / Map Labelling
  Writing & Speaking are skipped here (manual grading).
"""
from decimal import Decimal

from django.utils import timezone

from .models import Answer, Attempt

# Cambridge IELTS official band tables (Academic Reading + Listening).
BAND_TABLE_READING = [
    (39, Decimal('9.0')), (37, Decimal('8.5')), (35, Decimal('8.0')),
    (33, Decimal('7.5')), (30, Decimal('7.0')), (27, Decimal('6.5')),
    (23, Decimal('6.0')), (19, Decimal('5.5')), (15, Decimal('5.0')),
    (13, Decimal('4.5')), (10, Decimal('4.0')), (8, Decimal('3.5')),
    (6, Decimal('3.0')), (4, Decimal('2.5')), (0, Decimal('0.0')),
]

BAND_TABLE_LISTENING = [
    (39, Decimal('9.0')), (37, Decimal('8.5')), (35, Decimal('8.0')),
    (32, Decimal('7.5')), (30, Decimal('7.0')), (26, Decimal('6.5')),
    (23, Decimal('6.0')), (18, Decimal('5.5')), (16, Decimal('5.0')),
    (13, Decimal('4.5')), (10, Decimal('4.0')), (8, Decimal('3.5')),
    (6, Decimal('3.0')), (4, Decimal('2.5')), (0, Decimal('0.0')),
]

# Question-type families.
SINGLE_CHOICE = {'mcq', 'mcq_single', 'tfng', 'ynng'}
MULTI_CHOICE = {'multi_choice', 'mcq_multi'}
LEGACY_FILL = {'fill', 'gap_fill'}  # legacy single-blank fill-in
COMPLETION = {'sentence_completion', 'summary_completion', 'form_completion'}
MATCHING_PER_QUESTION = {
    'matching', 'matching_info', 'matching_features', 'matching_endings',
}
DIAGRAM_GROUP = {'map_labeling', 'map_labelling', 'diagram_label'}
SHORT_ANSWER = {'short_answer'}
SKIP_AUTO = {
    'writing_task1', 'writing_task2',
    'speaking_p1', 'speaking_p2', 'speaking_p3',
}


# ───────────────────────── helpers ─────────────────────────

def _normalise(value):
    if value is None:
        return ''
    if isinstance(value, (list, tuple)):
        return ' '.join(str(v) for v in value).strip().lower()
    return str(value).strip().lower().rstrip('.,!?;:')


def _accepted_for_completion_blank(blank):
    """A blank may be a list of accepted answers OR a single string."""
    if isinstance(blank, (list, tuple)):
        return [_normalise(x) for x in blank]
    return [_normalise(blank)]


def _split_alternates(raw):
    """ 'Spain / Andalusia' or 'Spain OR Andalusia' → ['spain', 'andalusia']"""
    import re
    parts = re.split(r'\s*(?:/| OR )\s*', str(raw or ''))
    return [_normalise(p) for p in parts if p.strip()]


# ─────────────────────── band conversion ───────────────────────

def convert_raw_to_band(
    raw_score: int, total_questions: int, kind: str = 'reading',
) -> Decimal:
    """Scale raw to /40 then look up in the official table."""
    if not total_questions:
        return Decimal('0.0')
    scaled = round(raw_score * 40 / total_questions)
    table = BAND_TABLE_LISTENING if kind == 'listening' else BAND_TABLE_READING
    for threshold, band in table:
        if scaled >= threshold:
            return band
    return Decimal('0.0')


# ─────────────────── per-question grading ───────────────────

def grade_answer(question, user_answer) -> bool:
    """Single boolean correct/incorrect — used for whole-row Answer.is_correct."""
    qtype = question.question_type
    key = question.answer_key if isinstance(question.answer_key, dict) else {}

    if qtype in SINGLE_CHOICE:
        # Smart-paste payload uses {"answer": "TRUE"}; legacy uses correct_answer.
        expected = key.get('answer') if 'answer' in key else question.correct_answer
        return _normalise(user_answer) == _normalise(expected)

    if qtype in MULTI_CHOICE:
        expected = key.get('answers') if 'answers' in key else question.correct_answer
        if not isinstance(expected, list):
            return False
        if not isinstance(user_answer, list):
            return False
        return (
            {_normalise(x) for x in user_answer}
            == {_normalise(x) for x in expected}
        )

    if qtype in LEGACY_FILL:
        return any(
            _normalise(c) == _normalise(user_answer)
            for c in [question.correct_answer, *(question.acceptable_answers or [])]
            if c is not None
        ) and bool(_normalise(user_answer))

    if qtype in SHORT_ANSWER:
        accepted = key.get('answers')
        if isinstance(accepted, list):
            normalised = [_normalise(a) for a in accepted]
            return _normalise(user_answer) in normalised and bool(_normalise(user_answer))
        # Fallback to legacy fields.
        return any(
            _normalise(c) == _normalise(user_answer)
            for c in [question.correct_answer, *(question.acceptable_answers or [])]
            if c is not None
        ) and bool(_normalise(user_answer))

    # Group types — partial scoring; "is_correct" means all-correct.
    if qtype == 'matching_headings':
        got, total = grade_matching_headings_partial(question, user_answer)
        return total > 0 and got == total

    if qtype in MATCHING_PER_QUESTION:
        # Smart-paste shape: answer_key.matches = {"1": "A", "2": "B", ...}
        # student answer: {"1": "A", "2": "B", ...} OR a single string for legacy.
        matches = key.get('matches') if isinstance(key, dict) else None
        if matches:
            got, total = _grade_match_dict(matches, user_answer)
            return total > 0 and got == total
        # Legacy single-row matching.
        return _normalise(user_answer) == _normalise(question.correct_answer)

    if qtype in DIAGRAM_GROUP:
        matches = key.get('matches') if isinstance(key, dict) else None
        if matches:
            got, total = _grade_match_dict(matches, user_answer)
            return total > 0 and got == total
        return _normalise(user_answer) == _normalise(question.correct_answer)

    if qtype in COMPLETION:
        got, total = grade_completion_partial(question, user_answer)
        return total > 0 and got == total

    return False


# ─────────────────── partial-credit graders ───────────────────

def grade_matching_headings_partial(question, user_answer):
    """Returns (correct_paragraphs, total_paragraphs).

    Each paragraph counts as 1 point — IELTS standard.
    """
    key = question.answer_key if isinstance(question.answer_key, dict) else {}
    matches = key.get('matches') if isinstance(key, dict) else None
    if not matches:
        return 0, 0
    return _grade_match_dict(matches, user_answer)


def grade_completion_partial(question, user_answer):
    """Returns (correct_blanks, total_blanks).

    `answer_key.blanks` is `[[acc1, acc2, ...], [acc1, ...], ...]` per blank.
    `user_answer` is a list of strings indexed by blank position. Legacy
    single-blank values (string) count as a 1-element list.
    """
    key = question.answer_key if isinstance(question.answer_key, dict) else {}
    blanks = key.get('blanks')
    if not isinstance(blanks, list):
        # Legacy fill: single blank from correct_answer + acceptable_answers.
        if question.correct_answer is None:
            return 0, 0
        accepted = [
            _normalise(question.correct_answer),
            *[_normalise(x) for x in (question.acceptable_answers or [])],
        ]
        student = user_answer
        if isinstance(student, list):
            student = student[0] if student else ''
        return (1 if _normalise(student) in accepted and _normalise(student) else 0), 1

    total = len(blanks)
    if not user_answer:
        return 0, total
    student = user_answer if isinstance(user_answer, list) else [user_answer]
    got = 0
    for i, accepted in enumerate(blanks):
        if i >= len(student):
            continue
        candidate = _normalise(student[i])
        if not candidate:
            continue
        accepted_normalised: list[str] = []
        for a in accepted if isinstance(accepted, list) else [accepted]:
            # Each item itself may use "Spain / Andalusia" alternates.
            accepted_normalised.extend(_split_alternates(a))
        if candidate in accepted_normalised:
            got += 1
    return got, total


def grade_match_dict_partial(question, user_answer):
    """Generic per-row matching (info/features/endings/diagram/map).

    Returns (correct_rows, total_rows).
    """
    key = question.answer_key if isinstance(question.answer_key, dict) else {}
    matches = key.get('matches') if isinstance(key, dict) else None
    if not matches:
        return 0, 0
    return _grade_match_dict(matches, user_answer)


def _grade_match_dict(matches: dict, user_answer):
    """Helper: count keys whose user-supplied value matches the expected one."""
    total = len(matches)
    if not isinstance(user_answer, dict):
        return 0, total
    got = sum(
        1 for k, expected in matches.items()
        if _normalise(user_answer.get(k)) == _normalise(expected)
    )
    return got, total


def is_group_question(question) -> bool:
    """True if this Question represents a group of points (Matching Headings,
    Matching Info group, Diagram Label group, Completion with multiple
    blanks). Group questions contribute N points instead of 1.
    """
    qtype = question.question_type
    key = question.answer_key if isinstance(question.answer_key, dict) else {}
    if qtype == 'matching_headings':
        return isinstance(key.get('matches'), dict) and bool(key.get('matches'))
    if qtype in MATCHING_PER_QUESTION or qtype in DIAGRAM_GROUP:
        m = key.get('matches')
        # A single-row entry (1-key match) is best treated as a normal question.
        return isinstance(m, dict) and len(m) > 1
    if qtype in COMPLETION:
        b = key.get('blanks')
        return isinstance(b, list) and len(b) > 1
    return False


def is_matching_headings_group(question) -> bool:
    """Backwards-compat alias used by older callers."""
    if question.question_type != 'matching_headings':
        return False
    ak = question.answer_key or {}
    return isinstance(ak, dict) and isinstance(ak.get('matches'), dict)


def points_for_group(question, user_answer) -> tuple[int, int]:
    """(got, total) for a group question."""
    qtype = question.question_type
    if qtype == 'matching_headings':
        return grade_matching_headings_partial(question, user_answer)
    if qtype in COMPLETION:
        return grade_completion_partial(question, user_answer)
    if qtype in MATCHING_PER_QUESTION or qtype in DIAGRAM_GROUP:
        return grade_match_dict_partial(question, user_answer)
    return (0, 0)


# ─────────────────── attempt-level grader ───────────────────

def _section_kind(question) -> str:
    """Map a Question to its section kind ('reading' | 'listening' | other)."""
    if question.passage_id:
        return 'reading'
    if question.listening_part_id:
        return 'listening'
    return 'other'


def grade_attempt(attempt: Attempt) -> Attempt:
    questions = [q for p in attempt.test.passages.all() for q in p.questions.all()]
    questions += [
        q for lp in attempt.test.listening_parts.all() for q in lp.questions.all()
    ]
    answers_by_q = {a.question_id: a for a in attempt.answers.all()}

    correct_count = 0
    total = 0
    section_stats: dict[str, dict[str, int]] = {}

    for q in questions:
        if q.question_type in SKIP_AUTO:
            continue
        a = answers_by_q.get(q.id) or Answer.objects.create(
            attempt=attempt, question=q, user_answer=None,
        )
        if is_group_question(q):
            got, group_total = points_for_group(q, a.user_answer)
            total += group_total
            correct_count += got
            a.is_correct = (got == group_total and group_total > 0)
            a.points_earned = Decimal(got)
            section_kind = _section_kind(q)
            stats = section_stats.setdefault(section_kind, {'raw': 0, 'max': 0})
            stats['raw'] += got
            stats['max'] += group_total
        else:
            total += 1
            is_correct = grade_answer(q, a.user_answer)
            a.is_correct = is_correct
            a.points_earned = Decimal(q.points) if is_correct else Decimal('0')
            if is_correct:
                correct_count += 1
            section_kind = _section_kind(q)
            stats = section_stats.setdefault(section_kind, {'raw': 0, 'max': 0})
            stats['raw'] += 1 if is_correct else 0
            stats['max'] += 1
        a.save(update_fields=['is_correct', 'points_earned'])

    # Compute per-section bands.
    test_module = (attempt.test.module or '').lower()
    band_per_section: dict[str, dict] = {}
    for kind, stats in section_stats.items():
        if stats['max'] == 0:
            continue
        band_kind = 'listening' if kind == 'listening' else 'reading'
        band = float(convert_raw_to_band(stats['raw'], stats['max'], band_kind))
        band_per_section[kind] = {
            'raw': stats['raw'],
            'max': stats['max'],
            'band': band,
        }

    attempt.raw_score = correct_count
    attempt.total_questions = total
    attempt.section_band_scores = band_per_section
    overall_kind = 'listening' if test_module == 'listening' else 'reading'
    attempt.band_score = convert_raw_to_band(correct_count, total, overall_kind)
    attempt.status = 'graded'
    attempt.submitted_at = timezone.now()
    attempt.save()
    return attempt
