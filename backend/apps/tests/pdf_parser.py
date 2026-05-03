"""ETAP — Listening test PDF parsing (heuristic).

Cambridge IELTS, DiyorBek va shunga o'xshash PDF formatlardan
matnni ajratib, savollarni qismlarga (Part 1-4) ajratadi.

Diqqat: bu heuristic parser — PDF formati har xil bo'lishi mumkin.
Natijada talaba/teacher tahrirlash uchun review wizard bo'lishi shart.
"""

import re
from io import BytesIO


def parse_listening_pdf(pdf_bytes: bytes) -> dict:
    """PDF baytlardan listening test strukturasini chiqaradi.

    Returns:
        {
          'parts': [
            {
              'part_number': 1,
              'title': 'Questions 1-10',
              'raw_text': '...',  # original text (review uchun)
              'questions': [
                {
                  'number': 1,
                  'type': 'fill_blank' | 'multiple_choice' | 'matching' | 'short_answer',
                  'text': '...',
                  'options': [...],   # only for MCQ
                  'answer': '...',    # if extractable
                },
                ...
              ],
            },
            ...
          ],
          'warnings': ['...'],
        }
    """
    try:
        import pdfplumber
    except ImportError:
        return {
            'parts': [],
            'warnings': ['pdfplumber kutubxonasi o\'rnatilmagan'],
        }

    warnings: list[str] = []
    full_text = ''
    try:
        with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
            pages = []
            for page in pdf.pages:
                text = page.extract_text() or ''
                pages.append(text)
            full_text = '\n'.join(pages)
    except Exception as exc:  # pragma: no cover
        return {
            'parts': [],
            'warnings': [f'PDF o\'qib bo\'lmadi: {exc}'],
        }

    if not full_text.strip():
        return {
            'parts': [],
            'warnings': ['PDF da matn topilmadi (rasm sifatida skanlangan bo\'lishi mumkin)'],
        }

    parts = _split_into_parts(full_text)
    if not parts:
        warnings.append('Part ajratuvchilari topilmadi — butun PDF Part 1 sifatida qoldi')
        parts = [{
            'part_number': 1,
            'title': 'Questions 1-40',
            'raw_text': full_text,
            'questions': _extract_questions(full_text),
        }]
    else:
        for p in parts:
            p['questions'] = _extract_questions(p['raw_text'])

    return {'parts': parts, 'warnings': warnings}


# ============================================
# Heuristics
# ============================================

PART_HEADER_RE = re.compile(
    r'(?im)^\s*(?:section|part)\s+(\d+)\b.*?$',
)
QUESTIONS_RANGE_RE = re.compile(
    r'(?im)\bquestions?\s+(\d+)\s*[-–—]\s*(\d+)\b',
)
NUMBERED_LINE_RE = re.compile(
    r'^\s*(\d{1,2})[.\)]\s+(.+?)\s*$',
)
OPTION_LINE_RE = re.compile(
    r'^\s*([A-G])\s*[.\)]\s+(.+?)\s*$',
)
BLANK_RE = re.compile(r'_{3,}|\.{4,}|\s\s+')


def _split_into_parts(text: str) -> list[dict]:
    """PDF matnini Part 1-4 qismlarga ajratish."""
    matches = list(PART_HEADER_RE.finditer(text))
    if not matches:
        # Fallback: "Questions X-Y" patterni asosida
        matches = list(QUESTIONS_RANGE_RE.finditer(text))
        if not matches:
            return []

    parts = []
    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        section = text[start:end].strip()
        # Title = birinchi qator
        title_line = section.split('\n', 1)[0].strip()[:120]
        # Part number ni olish
        try:
            part_num = int(m.group(1))
        except (ValueError, IndexError):
            part_num = i + 1
        parts.append({
            'part_number': part_num,
            'title': title_line or f'Part {part_num}',
            'raw_text': section,
            'questions': [],
        })
    return parts


def _extract_questions(text: str) -> list[dict]:
    """Section matnidan savollarni ajratish (heuristic)."""
    questions: list[dict] = []
    lines = [ln.rstrip() for ln in text.split('\n')]

    current: dict | None = None
    options_buf: list[str] = []

    def flush_current():
        nonlocal current, options_buf
        if current is None:
            return
        q_text = current.get('text', '')
        if options_buf:
            current['type'] = 'multiple_choice'
            current['options'] = options_buf[:]
        elif _looks_like_blank(q_text):
            current['type'] = 'fill_blank'
        else:
            current['type'] = 'short_answer'
        questions.append(current)
        current = None
        options_buf = []

    for raw in lines:
        if not raw.strip():
            continue
        m_num = NUMBERED_LINE_RE.match(raw)
        m_opt = OPTION_LINE_RE.match(raw) if current else None
        if m_num:
            flush_current()
            try:
                num = int(m_num.group(1))
            except ValueError:
                continue
            if num < 1 or num > 40:
                continue
            current = {
                'number': num,
                'text': m_num.group(2).strip(),
                'options': [],
                'answer': '',
            }
        elif m_opt and current:
            options_buf.append(m_opt.group(2).strip())
        elif current:
            # davomi (multi-line question text)
            current['text'] = (current['text'] + ' ' + raw.strip()).strip()

    flush_current()
    return questions


def _looks_like_blank(s: str) -> bool:
    """`______` yoki `....` yoki `<gap>` belgilari bormi?"""
    return bool(BLANK_RE.search(s))
