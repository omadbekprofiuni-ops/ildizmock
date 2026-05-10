"""ETAP 24 — Writing & Speaking parsers.

These don't use answer keys — they're prompt-only. Output shape is the same
ParseResult so the API view can serialise everything uniformly.
"""

import re

from .detector import detect_question_type
from .reading_parser import ParsedQuestion, ParsedSection, ParseResult


def parse_writing(
    task1_prompt: str,
    task2_prompt: str,
    task1_image_url: str = "",
) -> ParseResult:
    result = ParseResult(passage_html="", passage_word_count=0, paragraphs=[])

    if task1_prompt.strip():
        section = ParsedSection(
            instructions="Writing Task 1 — 20 minutes, at least 150 words",
        )
        section.questions.append(ParsedQuestion(
            order=1,
            qtype="writing_task1",
            payload={
                "prompt": task1_prompt.strip(),
                "min_words": 150,
                "time_minutes": 20,
                "image_url": task1_image_url,
            },
            answer_key={},
            detection=detect_question_type(task1_prompt, []),
            raw_text=task1_prompt,
        ))
        result.sections.append(section)

    if task2_prompt.strip():
        section = ParsedSection(
            instructions="Writing Task 2 — 40 minutes, at least 250 words",
        )
        section.questions.append(ParsedQuestion(
            order=2,
            qtype="writing_task2",
            payload={
                "prompt": task2_prompt.strip(),
                "min_words": 250,
                "time_minutes": 40,
            },
            answer_key={},
            detection=detect_question_type(task2_prompt, []),
            raw_text=task2_prompt,
        ))
        result.sections.append(section)

    if not result.sections:
        result.errors.append("Both Writing tasks are empty")
    return result


_CUE_CARD_BULLET_RE = re.compile(r"^\s*[\-•·]\s*(.+)$", re.MULTILINE)


def _extract_questions(raw: str) -> list[str]:
    """Lines starting with a number, dash, or bullet → question list."""
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    cleaned: list[str] = []
    for ln in lines:
        ln = re.sub(r"^\d+[\.\)]\s*", "", ln)
        ln = re.sub(r"^[\-•·]\s*", "", ln)
        if ln:
            cleaned.append(ln)
    return cleaned


def parse_speaking(part1: str, part2: str, part3: str) -> ParseResult:
    result = ParseResult(passage_html="", passage_word_count=0, paragraphs=[])

    if part1.strip():
        questions = _extract_questions(part1)
        section = ParsedSection(
            instructions="Speaking Part 1 — Introduction and interview, 4–5 minutes",
        )
        section.questions.append(ParsedQuestion(
            order=1,
            qtype="speaking_p1",
            payload={"questions": questions},
            answer_key={},
            detection=None,
            raw_text=part1,
        ))
        result.sections.append(section)

    if part2.strip():
        lines = [ln.strip() for ln in part2.splitlines() if ln.strip()]
        topic = lines[0] if lines else "Describe a memorable experience"
        bullets = _CUE_CARD_BULLET_RE.findall(part2)
        section = ParsedSection(
            instructions="Speaking Part 2 — Long turn, 1–2 minutes (1 minute prep)",
        )
        section.questions.append(ParsedQuestion(
            order=2,
            qtype="speaking_p2",
            payload={
                "topic": topic,
                "bullets": bullets,
                "prep_seconds": 60,
                "talk_seconds": 120,
            },
            answer_key={},
            detection=None,
            raw_text=part2,
        ))
        result.sections.append(section)

    if part3.strip():
        questions = _extract_questions(part3)
        section = ParsedSection(
            instructions="Speaking Part 3 — Discussion, 4–5 minutes",
        )
        section.questions.append(ParsedQuestion(
            order=3,
            qtype="speaking_p3",
            payload={"questions": questions},
            answer_key={},
            detection=None,
            raw_text=part3,
        ))
        result.sections.append(section)

    if not result.sections:
        result.errors.append("All Speaking parts are empty")
    return result
