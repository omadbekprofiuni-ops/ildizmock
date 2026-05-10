"""Smart Answer Sheet — ETAP 27.

PDF + Audio + pasted answer key from a single textarea, auto-detecting
question type from the answer pattern alone (no AI, pure regex).

Differs from `smart_paste/`:
- Smart Paste needs passage + questions + answers (3 textareas)
- Smart Answer Sheet needs just answers + a PDF for the test paper
"""
from .parser import (
    ParseResult,
    QuestionGroup,
    QuestionInfo,
    build_answer_key,
    detect_type_for_single_answer,
    parse_answer_key_text,
)

__all__ = [
    'ParseResult',
    'QuestionGroup',
    'QuestionInfo',
    'build_answer_key',
    'detect_type_for_single_answer',
    'parse_answer_key_text',
]
