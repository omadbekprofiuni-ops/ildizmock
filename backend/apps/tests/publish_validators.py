"""ETAP 22 — pre-publish validators for Test.

Returns a list of error dicts. Empty list means the test is publishable.
Each error has at least `code` and `message`; `section_id` / `question_id`
are included where applicable so the admin UI can deep-link.
"""

from .models import Question, Test


# Question types whose answers are graded by a human/AI later, not auto-checked.
HUMAN_GRADED_TYPES = {
    'writing_task1', 'writing_task2',
    'speaking_p1', 'speaking_p2', 'speaking_p3',
}


def _has_answer_key(q: Question) -> bool:
    # Group-form (matching_headings, matching_info etc.) keep the real key
    # in answer_key JSON. Legacy types use correct_answer.
    if isinstance(q.answer_key, dict) and q.answer_key:
        return True
    legacy = q.correct_answer
    if isinstance(legacy, str):
        return bool(legacy.strip())
    if isinstance(legacy, (list, tuple, dict)):
        return bool(legacy)
    return legacy is not None


def _validate_matching_headings(q: Question):
    payload = q.payload if isinstance(q.payload, dict) else {}
    answer_key = q.answer_key if isinstance(q.answer_key, dict) else {}
    paragraphs = payload.get('paragraphs') or []
    headings = payload.get('headings') or []
    matches = answer_key.get('matches') or {}

    if not paragraphs:
        return {
            'code': 'MH_NO_PARAGRAPHS',
            'message': f'Q{q.order}: matching_headings has no paragraphs.',
        }
    if len(headings) < len(paragraphs):
        return {
            'code': 'MH_TOO_FEW_HEADINGS',
            'message': (
                f'Q{q.order}: needs at least {len(paragraphs)} headings '
                f'(has {len(headings)}).'
            ),
        }
    heading_ids = {h.get('id') for h in headings if isinstance(h, dict)}
    for p in paragraphs:
        chosen = matches.get(p)
        if not chosen:
            return {
                'code': 'MH_MISSING_MATCH',
                'message': f'Q{q.order}: paragraph {p} has no correct heading.',
            }
        if chosen not in heading_ids:
            return {
                'code': 'MH_INVALID_MATCH',
                'message': (
                    f'Q{q.order}: paragraph {p} → heading "{chosen}" is not '
                    f'in the headings list.'
                ),
            }
    return None


def validate_test_for_publish(test: Test) -> list[dict]:
    errors: list[dict] = []

    if not (test.name or '').strip():
        errors.append({'code': 'MISSING_TITLE',
                       'message': 'Test must have a name.'})

    passages = list(test.passages.all().prefetch_related('questions'))
    listening_parts = list(
        test.listening_parts.all().prefetch_related('questions'),
    )
    writing_tasks = list(test.writing_tasks.all())

    has_content = passages or listening_parts or writing_tasks
    if not has_content:
        errors.append({'code': 'NO_SECTIONS',
                       'message': 'Test has no parts/passages/tasks.'})

    # Listening parts must have audio.
    for lp in listening_parts:
        if not lp.audio_file:
            errors.append({
                'section_id': lp.id,
                'code': 'MISSING_AUDIO',
                'message': f'Listening Part {lp.part_number} has no audio.',
            })

    # Reading passages must have non-empty content.
    if test.module == 'reading':
        for p in passages:
            if not (p.content or '').strip():
                errors.append({
                    'section_id': p.id,
                    'code': 'MISSING_PASSAGE_TEXT',
                    'message': f'Passage {p.part_number} has no text.',
                })

    # Writing Task 1 (Academic) must have an image.
    if test.module == 'writing' and test.test_type == 'academic':
        for wt in writing_tasks:
            if wt.task_number == 1 and not wt.chart_image:
                errors.append({
                    'section_id': wt.id,
                    'code': 'MISSING_TASK1_IMAGE',
                    'message': 'Academic Writing Task 1 needs a chart/graph image.',
                })

    # Per-question checks.
    all_questions: list[Question] = []
    for p in passages:
        all_questions.extend(p.questions.all())
    for lp in listening_parts:
        all_questions.extend(lp.questions.all())

    for q in all_questions:
        if q.question_type in HUMAN_GRADED_TYPES:
            continue
        if q.question_type == 'matching_headings' \
                and isinstance(q.payload, dict) and q.payload.get('paragraphs'):
            err = _validate_matching_headings(q)
            if err:
                errors.append({**err, 'question_id': q.id})
            continue
        if not _has_answer_key(q):
            errors.append({
                'question_id': q.id,
                'code': 'MISSING_ANSWER_KEY',
                'message': f'Q{q.order} has no correct answer.',
            })

    return errors
