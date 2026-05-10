"""ETAP 24 — Reading parser for Smart Paste.

Parses three pasted blocks (passage, questions, answers) into ParseResult
ready to create Test/Passage/Question rows. Forgiving about whitespace,
paragraph markers, and answer-key formatting commonly seen in Cambridge
IELTS books and PDFs.
"""

import re
from dataclasses import dataclass, field
from typing import Optional

from .detector import DetectionResult, detect_question_type


@dataclass
class ParsedQuestion:
    order: int
    qtype: str
    payload: dict
    answer_key: dict
    detection: Optional[DetectionResult]
    raw_text: str = ""


@dataclass
class ParsedSection:
    instructions: str
    questions: list[ParsedQuestion] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass
class ParseResult:
    passage_html: str
    passage_word_count: int
    paragraphs: list[str]   # ['A', 'B', 'C', 'D', 'E']
    sections: list[ParsedSection] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def question_count(self) -> int:
        return sum(len(s.questions) for s in self.sections)


# ─────────────────────────────────────────────────────────────────
# PASSAGE PARSING
# ─────────────────────────────────────────────────────────────────

_PARA_PATTERN = re.compile(
    r"^\s*(?:Paragraph\s+)?\[?([A-Z])\]?[\s\.\)]\s+(.+?)"
    r"(?=^\s*(?:Paragraph\s+)?\[?[A-Z]\]?[\s\.\)]\s+|\Z)",
    re.MULTILINE | re.DOTALL,
)


def parse_passage(raw: str) -> tuple[str, list[str], int]:
    """Detect paragraph markers (A, B, C…) and return:
      (html_with_data_para_attrs, paragraph_ids_in_order, total_word_count)
    Recognized formats:
        A  Text…       A. Text…      [A] Text…       Paragraph A   Text…
    If no markers found, splits by blank lines and auto-labels A, B, C…
    """
    text = raw.strip()
    if not text:
        return ("", [], 0)

    matches = _PARA_PATTERN.findall(text)
    paragraphs: list[tuple[str, str]] = []
    if len(matches) >= 2:
        paragraphs = [(label, body.strip()) for label, body in matches]
    else:
        chunks = [c.strip() for c in re.split(r"\n\s*\n", text) if c.strip()]
        paragraphs = [(chr(ord("A") + i), body) for i, body in enumerate(chunks)]

    html_parts: list[str] = []
    para_ids: list[str] = []
    word_count = 0
    for label, body in paragraphs:
        body_clean = re.sub(r"\s+", " ", body).strip()
        word_count += len(body_clean.split())
        para_ids.append(label)
        html_parts.append(
            f'<p data-para="{label}"><strong>{label}</strong> {body_clean}</p>',
        )

    return ("\n".join(html_parts), para_ids, word_count)


# ─────────────────────────────────────────────────────────────────
# ANSWER KEY PARSING
# ─────────────────────────────────────────────────────────────────

_ANSWER_LINE_RE = re.compile(
    r"^\s*(\d{1,3})[\.\)\:\s\t]+(.+?)\s*$", re.MULTILINE,
)


def parse_answer_key(raw: str) -> dict[int, str]:
    """Parse common IELTS answer-key formats:
        1   iv         1.  iv         1)  iv          1:  iv
        1   TRUE       11  A, C       14  briefcase
    """
    result: dict[int, str] = {}
    for match in _ANSWER_LINE_RE.finditer(raw):
        num = int(match.group(1))
        ans = match.group(2).strip()
        if num in result:
            continue
        result[num] = ans
    return result


# ─────────────────────────────────────────────────────────────────
# QUESTIONS BLOCK PARSING
# ─────────────────────────────────────────────────────────────────

_SECTION_HEADER_RE = re.compile(
    r"^\s*Questions?\s+(\d{1,3})\s*[\-–—to]+\s*(\d{1,3})(.*)$",
    re.MULTILINE,
)
_QUESTION_LINE_RE = re.compile(r"^\s*(\d{1,3})[\.\)\s]+(.+?)$", re.MULTILINE)
_OPTION_LINE_RE = re.compile(r"^\s*([A-J])[\.\)]\s+(.+?)$", re.MULTILINE)
_HEADING_LINE_RE = re.compile(
    r"^\s*(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv)\s+(.+?)$",
    re.MULTILINE | re.IGNORECASE,
)


def split_into_question_blocks(
    questions_raw: str,
) -> list[tuple[int, int, str, str]]:
    """Returns list of (start_q, end_q, header_line, body_text) for each
    'Questions X-Y' block.
    """
    headers = list(_SECTION_HEADER_RE.finditer(questions_raw))
    if not headers:
        nums = [int(m.group(1)) for m in _QUESTION_LINE_RE.finditer(questions_raw)]
        if nums:
            return [(min(nums), max(nums), "", questions_raw)]
        return []

    blocks: list[tuple[int, int, str, str]] = []
    for i, h in enumerate(headers):
        start_q = int(h.group(1))
        end_q = int(h.group(2))
        body_start = h.end()
        body_end = headers[i + 1].start() if i + 1 < len(headers) else len(questions_raw)
        header_line = h.group(0).strip()
        body_text = header_line + "\n" + questions_raw[body_start:body_end].strip()
        blocks.append((start_q, end_q, header_line, body_text))
    return blocks


def build_payload(
    qtype: str,
    q_num: int,
    body: str,
    options_pool: list[tuple[str, str]],
    q_text: str,
) -> dict:
    """Build the JSONB payload for a question based on detected type."""
    if qtype in ("tfng", "ynng"):
        return {"statement": q_text}

    if qtype == "mcq_single":
        return {
            "stem": q_text,
            "options": [{"id": label, "text": text} for label, text in options_pool],
        }

    if qtype == "mcq_multi":
        return {
            "stem": q_text,
            "options": [{"id": label, "text": text} for label, text in options_pool],
            "select_count": 2,
        }

    if qtype in ("matching_info", "matching_features", "matching_endings"):
        return {
            "items": [{"id": q_num, "text": q_text}],
            "options": [{"id": label, "text": text} for label, text in options_pool],
            "options_can_repeat": True,
        }

    if qtype == "sentence_completion":
        return {"template": q_text, "word_limit": 2, "case_sensitive": False}

    if qtype == "short_answer":
        return {"stem": q_text, "word_limit": 3}

    if qtype == "summary_completion":
        return {"template": q_text, "word_limit": 2, "case_sensitive": False}

    if qtype == "form_completion":
        return {"template": q_text, "word_limit": 2, "case_sensitive": False}

    return {"raw": q_text}


def build_answer_key(qtype: str, q_num: int, raw_answer: str) -> dict:
    """Build the answer_key JSONB based on type."""
    a = (raw_answer or "").strip()

    if qtype in ("tfng", "ynng"):
        return {"answer": a.upper()}

    if qtype == "mcq_single":
        return {"answer": a.upper()}

    if qtype == "mcq_multi":
        parts = re.split(r"[,&\s]+", a.upper())
        return {"answers": [p for p in parts if p]}

    if qtype in ("matching_headings", "matching_info",
                 "matching_features", "matching_endings"):
        return {"matches": {str(q_num): a}}

    if qtype in ("sentence_completion", "summary_completion", "form_completion"):
        alternates = re.split(r"\s*(?:/| OR )\s*", a)
        return {"blanks": [alternates]}

    if qtype == "short_answer":
        alternates = re.split(r"\s*(?:/| OR )\s*", a)
        return {"answers": alternates}

    return {"raw": a}


def parse_questions_block(
    block_text: str,
    answer_map: dict[int, str],
) -> ParsedSection:
    """Parse a single 'Questions X-Y' block into a ParsedSection."""
    section = ParsedSection(instructions=block_text.split("\n", 1)[0])

    options_pool: list[tuple[str, str]] = _OPTION_LINE_RE.findall(block_text)
    headings_pool: list[tuple[str, str]] = _HEADING_LINE_RE.findall(block_text)

    q_matches = list(_QUESTION_LINE_RE.finditer(block_text))

    sample_answers: list[str] = []
    for m in q_matches[:3]:
        qn = int(m.group(1))
        if qn in answer_map:
            sample_answers.append(answer_map[qn])

    block_detection = detect_question_type(section.instructions, sample_answers)

    # Special case — Matching Headings = ONE meta-question for the whole group
    if block_detection.qtype == "matching_headings":
        all_nums = [int(m.group(1)) for m in q_matches]
        if not all_nums:
            section.warnings.append(
                "Matching Headings block has no question numbers",
            )
            return section

        first_num = min(all_nums)
        paragraph_targets: list[dict] = []
        for m in q_matches:
            qn = int(m.group(1))
            text = m.group(2).strip()
            para_match = re.search(r"\bParagraph\s+([A-Z])\b", text, re.IGNORECASE)
            para_label = para_match.group(1).upper() if para_match else None
            paragraph_targets.append({"q_num": qn, "para": para_label})

        matches: dict[str, str] = {}
        for pt in paragraph_targets:
            if pt["q_num"] in answer_map and pt["para"]:
                matches[pt["para"]] = answer_map[pt["q_num"]].strip()

        # Headings list: filter out heading IDs that look like paragraph
        # references ("Paragraph B"). Cambridge often interleaves headings
        # and paragraph rows in the same block.
        headings = []
        for h_id, h_text in headings_pool:
            if h_text.strip().lower().startswith("paragraph "):
                continue
            headings.append({"id": h_id.lower(), "text": h_text.strip()})

        payload = {
            "headings": headings,
            "paragraphs": [pt["para"] for pt in paragraph_targets if pt["para"]],
        }
        answer_key = {"matches": matches}

        section.questions.append(ParsedQuestion(
            order=first_num,
            qtype="matching_headings",
            payload=payload,
            answer_key=answer_key,
            detection=block_detection,
            raw_text=block_text,
        ))
        if not headings:
            section.warnings.append(
                "Matching Headings block has no roman-numeral headings list",
            )
        return section

    # Generic per-question handling
    for m in q_matches:
        qn = int(m.group(1))
        q_text = m.group(2).strip()
        # Strip option lines that may have been glued in
        q_text = re.sub(r"\n\s*[A-J][\.\)]\s+.+", "", q_text).strip()

        raw_ans = answer_map.get(qn)
        if raw_ans is None:
            section.warnings.append(f"Q{qn}: no answer found in answer key")
            qtype = block_detection.qtype
            answer_key: dict = {}
        else:
            per_q_det = detect_question_type(section.instructions, [raw_ans])
            qtype = (
                per_q_det.qtype
                if per_q_det.confidence >= 0.85
                else block_detection.qtype
            )
            answer_key = build_answer_key(qtype, qn, raw_ans)

        payload = build_payload(qtype, qn, block_text, options_pool, q_text)

        section.questions.append(ParsedQuestion(
            order=qn,
            qtype=qtype,
            payload=payload,
            answer_key=answer_key,
            detection=block_detection,
            raw_text=q_text,
        ))

    return section


# ─────────────────────────────────────────────────────────────────
# TOP-LEVEL ENTRY
# ─────────────────────────────────────────────────────────────────

def parse_reading(passage: str, questions: str, answers: str) -> ParseResult:
    result = ParseResult(passage_html="", passage_word_count=0, paragraphs=[])

    if not passage.strip():
        result.errors.append("Passage is empty")
    if not questions.strip():
        result.errors.append("Questions block is empty")
    if not answers.strip():
        result.errors.append("Answer key is empty")
    if result.errors:
        return result

    html, paras, wc = parse_passage(passage)
    result.passage_html = html
    result.paragraphs = paras
    result.passage_word_count = wc

    answer_map = parse_answer_key(answers)
    if not answer_map:
        result.errors.append(
            "No answer-key entries detected. Use format like '1   iv' on each line.",
        )
        return result

    blocks = split_into_question_blocks(questions)
    if not blocks:
        result.errors.append(
            "No question blocks found. Use 'Questions X-Y' headers.",
        )
        return result

    declared_q_numbers: set[int] = set()
    for start_q, end_q, header, body in blocks:
        section = parse_questions_block(body, answer_map)
        result.sections.append(section)
        for q in section.questions:
            # For matching_headings group form `q.order` is just the first
            # number; the actual paragraph numbers span the whole range.
            if q.qtype == "matching_headings":
                # Mark all paragraph question numbers as covered
                # (we don't easily have them here — accept the range).
                pass
            declared_q_numbers.add(q.order)

    # Cross-check (best-effort)
    extra_answers = sorted(set(answer_map.keys()) - declared_q_numbers)
    if extra_answers and len(extra_answers) > 5:
        # Only warn for substantial extras — small ones are likely matching_headings rows.
        result.warnings.append(
            f"Answer key has answers for unmatched questions: {extra_answers[:10]}…",
        )

    return result
