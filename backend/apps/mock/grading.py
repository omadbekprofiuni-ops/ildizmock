"""Mock sessiya uchun avtomatik baholash (Listening / Reading)."""

import re
from decimal import Decimal

from apps.attempts.grading import convert_raw_to_band, grade_answer
from apps.tests.models import PDFTest, Test


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


def _normalize_pdf_answer(value):
    """`PDFTestAttempt._normalize_answer` bilan bir xil — uppercase + trim."""
    if value is None:
        return ''
    s = str(value).strip().upper()
    s = re.sub(r'\s+', ' ', s)
    return s


def grade_pdf(pdf_test: PDFTest, answers: dict):
    """PDFTest answer_key dict'iga qarshi javoblarni baholaydi.

    `answers` — {question_number (str): user_answer} formatda. PDFTest'ning
    o'zining `auto_grade` mantig'i bilan bir xil ishlaydi, lekin transient —
    DB'ga yozmaydi, faqat (correct, total, band) qaytaradi.
    """
    correct = 0
    norm = _normalize_pdf_answer
    for q_num, correct_answer in pdf_test.answer_key.items():
        student_answer = (answers or {}).get(str(q_num), '')
        if isinstance(correct_answer, list):
            acceptable = {norm(a) for a in correct_answer}
        else:
            acceptable = {norm(p) for p in str(correct_answer).split('/')}
        if norm(student_answer) in acceptable:
            correct += 1
    total = len(pdf_test.answer_key)
    band = convert_raw_to_band(correct, total) if total else Decimal('0.0')
    return correct, total, band
