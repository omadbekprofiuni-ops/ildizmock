"""Mock sessiya uchun avtomatik baholash (Listening / Reading)."""

from decimal import Decimal

from apps.attempts.grading import convert_raw_to_band, grade_answer
from apps.tests.models import Test


def _iter_listening_questions(test: Test):
    for part in test.listening_parts.all():
        for q in part.questions.all():
            yield q


def _iter_reading_questions(test: Test):
    for passage in test.passages.all():
        for q in passage.questions.all():
            yield q


def grade_listening(test: Test, answers: dict):
    """`answers` — {question_id (str): user_answer} formatda."""
    correct = 0
    total = 0
    for q in _iter_listening_questions(test):
        total += 1
        user = answers.get(str(q.id)) if answers else None
        if grade_answer(q, user):
            correct += 1
    band = convert_raw_to_band(correct, total) if total else Decimal('0.0')
    return correct, total, band


def grade_reading(test: Test, answers: dict):
    correct = 0
    total = 0
    for q in _iter_reading_questions(test):
        total += 1
        user = answers.get(str(q.id)) if answers else None
        if grade_answer(q, user):
            correct += 1
    band = convert_raw_to_band(correct, total) if total else Decimal('0.0')
    return correct, total, band
