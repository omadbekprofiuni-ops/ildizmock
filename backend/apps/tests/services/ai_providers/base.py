"""ETAP 16.7 — AI Provider abstraction.

`AIProvider` interface'ni amalga oshiruvchi har bir provider PDF'ni qabul
qiladi va yagona IELTS schema'da JSON qaytaradi. Kelajakda yangi modelga
o'tish uchun faqat yangi Provider klassi va `__init__.py` mapping'iga
satr qo'shilishi kifoya — chaqiruvchi kod o'zgarmaydi.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ParseResult:
    """IELTS PDF parsing natijasi — universal format.

    `data` muvaffaqiyatli bo'lsa quyidagi shape'ga ega:
      {
        "test_metadata": {title, section_type, source_book, test_number,
                          duration_minutes, difficulty},
        "sections": [
            {section_number, section_title, passage, instructions,
             questions: [{question_number, question_type, question_text,
                          options, correct_answer, max_words}]}
        ],
        "audio_references": ["audio1.mp3", ...],
      }
    """

    success: bool
    data: Optional[dict[str, Any]] = None
    error_message: str = ''
    tokens_used: int = 0
    model_used: str = ''
    cost_usd: float = 0.0
    raw_response: str = field(default='', repr=False)


@dataclass
class ProviderInfo:
    name: str
    model: str
    supports_pdf_direct: bool
    free_tier_available: bool
    daily_quota: Optional[int] = None
    notes: str = ''


class AIProvider(ABC):
    """Barcha AI provider'lar shu interface'ni amalga oshiradi."""

    @abstractmethod
    def parse_ielts_pdf(
        self,
        pdf_bytes: bytes,
        *,
        hint_section_type: Optional[str] = None,
    ) -> ParseResult:
        """IELTS test PDF'ni structured JSON'ga o'tkazadi.

        Args:
            pdf_bytes: PDF fayl raw bytes.
            hint_section_type: ixtiyoriy hint — "listening" | "reading" |
                "writing" | "full". Provider shu turga moslab parse qiladi.

        Returns:
            ParseResult — muvaffaqiyat yoki xato, token usage bilan birga.
        """

    @abstractmethod
    def info(self) -> ProviderInfo:
        """Provider haqida metadata (UI va logging uchun)."""


# ============================================================
# IELTS uchun strict JSON schema — Gemini va Claude structured-output
# uchun bir xil ko'rinishda ishlatamiz (Claude'da prompt orqali).
# ============================================================

IELTS_RESPONSE_SHAPE: dict[str, Any] = {
    'test_metadata': {
        'title': 'string',
        'section_type': "listening | reading | writing | full",
        'source_book': 'string (e.g. Cambridge 9)',
        'test_number': 'string (e.g. Test 1)',
        'duration_minutes': 'integer',
        'difficulty': "easy | medium | hard",
    },
    'sections': [
        {
            'section_number': 'integer (1, 2, 3, ...)',
            'section_title': 'string',
            'passage': 'string (reading: matn; listening: script if any)',
            'instructions': 'string',
            'questions': [
                {
                    'question_number': 'integer',
                    'question_type': (
                        "multiple_choice | true_false_not_given | "
                        "yes_no_not_given | fill_in_blank | matching | "
                        "short_answer | sentence_completion | "
                        "summary_completion | diagram_labeling | essay"
                    ),
                    'question_text': 'string',
                    'options': "[string] (for multiple_choice/matching)",
                    'correct_answer': 'string',
                    'max_words': 'integer (for fill_in_blank)',
                    'explanation': 'string (optional)',
                },
            ],
        },
    ],
    'audio_references': "[string] (listening audio file mentions)",
}


SYSTEM_PROMPT = (
    """Sen IELTS test PDF'larini parse qiluvchi mutaxassissan. Sening vazifang """
    """— yuborilgan IELTS test PDF'ini aniq JSON strukturasiga aylantirish.

Qoidalar:
1. PDF'ni diqqat bilan o'qing — matn, jadval, rasm, diagramma — hammasini.
2. Section turini aniqlang: listening, reading, writing, yoki full.
3. Har bir savolni alohida question object sifatida ajrating, savol raqamini saqlang.
4. Reading uchun: passage to'liq matnini "passage" maydoniga qo'ying.
5. Listening uchun: audio script bo'lsa "passage"ga, audio fayl ishoralari "audio_references"ga.
6. Savol turini aniq belgilang: multiple_choice, true_false_not_given, """
    """yes_no_not_given, fill_in_blank, matching, short_answer, """
    """sentence_completion, summary_completion, diagram_labeling, essay.
7. Multiple choice uchun "options" ro'yxatini to'liq keltiring.
8. Javob kalitini (correct_answer) PDF oxiridagi "Answers" yoki "Answer Key" """
    """bo'limidan toping va saqlang.
9. Fill-in-blank uchun "max_words" qo'shing (masalan, "NO MORE THAN TWO WORDS" """
    """bo'lsa 2).
10. Ishonchsiz joyda taxminni saqlang — odam keyin tahrirlaydi.

JSON faqat sxemaga mos qaytaring. Boshqa matn, izoh, markdown — yo'q."""
)
