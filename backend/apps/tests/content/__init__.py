"""ETAP 30 — HTML Test Platform: content parser + validator.

Spec'ga muvofiq examy.me / IELTS Online Tests uslubidagi HTML test
platformasi uchun markdown-uslubidagi DSL.

Foydalanish:
    from apps.tests.content import parse_content, validate_content
    html = parse_content(source_text)
    result = validate_content(source_text, answer_key_dict)
"""
from .parser import parse_content
from .validator import ValidationResult, validate_content

__all__ = ['parse_content', 'validate_content', 'ValidationResult']
