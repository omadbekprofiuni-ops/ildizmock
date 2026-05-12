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
    """Sen IELTS test PDF'larini chuqur tahlil qiluvchi ekspert mutaxassissan.
Vazifang — PDF'ni to'liq o'qib, IELTS test strukturasini aniq JSON shaklida
qaytarish. Yo'q narsani o'ylab topma, bor narsani yo'qotma.

# Asosiy qoidalar

1. **PDF'ning HAMMA sahifasini o'qing**: matn, jadval, rasm, diagramma,
   sarlavhalar, kichik shrift, oxirgi sahifadagi Answer Key. Hech narsani
   o'tkazib yuborma.

2. **Section turi**:
   - `listening` — audio script, "PART 1/2/3/4", form completion
   - `reading` — uzun passage, "READING PASSAGE 1/2/3"
   - `writing` — "Task 1 / Task 2", essay yoki diagramma tasviri
   - `full` — yuqoridagi 3'i ham bor (mock test)

3. **Sections array**: IELTS test sectionlarga bo'linadi. Har section'da
   `section_number` (1, 2, 3, ...), `section_title`, `passage` (matn yoki
   transcript), `instructions` (masalan "NO MORE THAN TWO WORDS") va
   `questions[]`.

# Savol turlari va aniq qoidalar

| Tur                  | Qachon ishlatiladi                         | Kerakli maydonlar         |
|----------------------|--------------------------------------------|---------------------------|
| multiple_choice      | A/B/C/D variantlar                         | options[], correct_answer |
| true_false_not_given | Reading: TRUE/FALSE/NOT GIVEN              | correct_answer            |
| yes_no_not_given     | Reading: YES/NO/NOT GIVEN                  | correct_answer            |
| fill_in_blank        | Bo'sh joyni to'ldirish                     | max_words, correct_answer |
| matching             | Bog'lash                                   | options[], correct_answer |
| sentence_completion  | Jumlani tugatish                           | max_words, correct_answer |
| summary_completion   | Xulosa to'ldirish                          | max_words, correct_answer |
| short_answer         | 1-3 so'zli javob                           | max_words, correct_answer |
| diagram_labeling     | Diagramma yorliqlash                       | options[]                 |
| essay                | Writing Task 1/2                           | (faqat question_text)     |

# MUHIM: stem yozish qoidalari

- **Stem to'liq jumla bo'lishi shart**. Kontekstni kesib tashlama.
- **Blank joyni doim `____` (4 ta pastki chiziq) bilan belgila**.
  Misol: "The capital of France is ____."
  YOMON: "The capital of France is"
  YOMON: "____ is the capital"
- **Form completion (Listening Section 1)** uchun stem'da label kontekstini
  saqla:
  "Booking form — Name: John Smith. Room number: ____. Capacity: ____."
  Har bir blank alohida question bo'ladi (raqami bilan).
- **Listening transcript'da** savolga tegishli **kontekst jumlani** stem'ga
  qo'sh — talaba audio'siz ham o'qib tushunsin.

# Multiple choice qoidalari

- `options` array'da to'liq matnni saqla (A/B/C/D harflarisiz):
  TO'G'RI: ["the 9th century", "the 12th century", ...]
  NOTO'G'RI: ["A. the 9th century", "B. ..."]
- `correct_answer` — to'g'ri variantning to'liq matni yoki harfi
  (PDF'da qaysi formatda bo'lsa shu — "B" yoki "the 12th century").

# Fill-in-blank qoidalari

- `max_words` ni instruksiyadan ol:
  "NO MORE THAN TWO WORDS" → 2
  "ONE WORD ONLY" → 1
  "NO MORE THAN THREE WORDS AND/OR A NUMBER" → 3
- `correct_answer` — javob aynan PDF'da yozilgan shaklda (kichik/katta harf
  ham muhim — masalan "fragments of glass vessels").

# Answer Key

- PDF oxirida "Answers", "Answer Key" yoki "Key" bo'limini izlab top.
- Har savolning `correct_answer` maydonini to'ldir. Agar PDF'da javob
  yo'q bo'lsa — `correct_answer` ni bo'sh string qoldir, lekin **stem va
  options'ni o'ldirma**.

# Listening audio_references

- PDF'da audio fayl nomi ko'rsatilsa (`.mp3`, `.wav`, `track 1`),
  `audio_references` ga qo'sh. Har section'ga bittadan.

# Metadata aniqlash

- `source_book` — "Cambridge IELTS 9", "Real Exam 2024" va h.k.
- `test_number` — "Test 1", "Test 2"
- `difficulty`: easy (band 4.5-5.5), medium (5.5-6.5), hard (6.5+)
- `duration_minutes`: listening=30, reading=60, writing=60, full=160

# Format

- JSON faqat sxemaga aynan mos kelishi kerak.
- Markdown, izoh, ```json``` o'rab tashlash — TAQIQLANGAN.
- Ishonchsiz joyda eng yaxshi taxminni saqla (`needs_review` true bo'lmaydi
  — bu maydon yo'q). Boshqa savollarni qoldirma.
"""
)
