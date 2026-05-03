from decimal import Decimal

from django.utils import timezone

from .models import Answer, Attempt

# Academic Reading / Listening band conversion: raw /40 → band.
BAND_TABLE_40 = [
    (39, Decimal('9.0')), (37, Decimal('8.5')), (35, Decimal('8.0')),
    (33, Decimal('7.5')), (30, Decimal('7.0')), (27, Decimal('6.5')),
    (23, Decimal('6.0')), (19, Decimal('5.5')), (15, Decimal('5.0')),
    (13, Decimal('4.5')), (10, Decimal('4.0')), (8, Decimal('3.5')),
    (6, Decimal('3.0')), (4, Decimal('2.5')), (0, Decimal('0.0')),
]


def _normalise(value):
    if value is None:
        return ''
    if isinstance(value, (list, tuple)):
        return ' '.join(str(v) for v in value).strip().lower()
    return str(value).strip().lower()


def _matches(expected, acceptable, given):
    g = _normalise(given)
    if not g:
        return False
    candidates = [expected] + list(acceptable or [])
    return any(_normalise(c) == g for c in candidates)


def convert_raw_to_band(raw_score: int, total_questions: int) -> Decimal:
    if not total_questions:
        return Decimal('0.0')
    scaled = round(raw_score * 40 / total_questions)
    for threshold, band in BAND_TABLE_40:
        if scaled >= threshold:
            return band
    return Decimal('0.0')


def grade_answer(question, user_answer) -> bool:
    qtype = question.question_type
    if qtype in ('mcq', 'tfng', 'matching'):
        return _normalise(user_answer) == _normalise(question.correct_answer)
    if qtype == 'multi_choice':
        # IELTS "Choose TWO/THREE" — set equality on normalised values.
        # correct_answer must be a list; user submits a list of selected options.
        correct = question.correct_answer
        if not isinstance(correct, list):
            return False
        if not isinstance(user_answer, list):
            return False
        return {_normalise(x) for x in user_answer} == {_normalise(x) for x in correct}
    if qtype == 'fill':
        return _matches(question.correct_answer, question.acceptable_answers, user_answer)
    return False


def grade_attempt(attempt: Attempt) -> Attempt:
    questions = [q for p in attempt.test.passages.all() for q in p.questions.all()]
    questions += [
        q for lp in attempt.test.listening_parts.all() for q in lp.questions.all()
    ]
    total = len(questions)
    answers_by_q = {a.question_id: a for a in attempt.answers.all()}

    correct_count = 0
    for q in questions:
        a = answers_by_q.get(q.id) or Answer.objects.create(
            attempt=attempt, question=q, user_answer=None,
        )
        is_correct = grade_answer(q, a.user_answer)
        a.is_correct = is_correct
        a.points_earned = Decimal(q.points) if is_correct else Decimal('0')
        a.save(update_fields=['is_correct', 'points_earned'])
        if is_correct:
            correct_count += 1

    attempt.raw_score = correct_count
    attempt.total_questions = total
    attempt.band_score = convert_raw_to_band(correct_count, total)
    attempt.status = 'graded'
    attempt.submitted_at = timezone.now()
    attempt.save()
    return attempt
