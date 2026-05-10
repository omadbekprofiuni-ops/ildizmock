"""ETAP 24 — Question type detector for Smart Paste.

Two-pass strategy:
  Pass 1 — match standardized IELTS instruction phrases (high confidence).
  Pass 2 — fallback to answer-pattern recognition.

Returns (qtype, confidence, reason) so the frontend can show why a type was
chosen and let the admin override low-confidence picks.
"""

import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class DetectionResult:
    qtype: str
    confidence: float          # 0.0–1.0
    reason: str
    needs_confirm: bool = False


# ─────────────────────────────────────────────────────────────────
# PASS 1 — instruction patterns (ordered by specificity, most → least)
# ─────────────────────────────────────────────────────────────────

INSTRUCTION_PATTERNS: list[tuple[str, str, str]] = [
    # Matching Headings — must come before generic "matching"
    (r"choose the most suitable heading", "matching_headings",
     "instruction: 'most suitable heading'"),
    (r"list of headings", "matching_headings",
     "instruction mentions 'List of Headings'"),
    (r"match each .{1,30} (with|to) (a|the) heading", "matching_headings",
     "instruction: match → heading"),

    # Yes/No/Not Given (writer's claims)
    (r"do the following statements agree with the (claims|views|opinions) of the writer",
     "ynng", "instruction asks Y/N/NG"),
    (r"in boxes? .{1,15} write\s*[\r\n]+\s*YES", "ynng",
     "Y/N/NG box instructions"),

    # True/False/Not Given (information)
    (r"do the following statements agree with the information",
     "tfng", "instruction asks TF/NG"),
    (r"in boxes? .{1,15} write\s*[\r\n]+\s*TRUE", "tfng",
     "TF/NG box instructions"),

    # MCQ — multi
    (r"choose (TWO|THREE|FOUR|2|3|4) letters", "mcq_multi",
     "instruction asks multiple letters"),
    (r"which (TWO|THREE) (of the following|statements)", "mcq_multi",
     "instruction asks 2/3 statements"),

    # MCQ — single
    (r"choose THE correct letter,? [A-Z],?\s*[A-Z],?\s*[A-Z]\s*(or|and)\s*[A-Z]",
     "mcq_single", "instruction: single letter A/B/C/D"),
    (r"choose (the|one) correct (letter|answer)", "mcq_single",
     "instruction asks one correct letter"),

    # Matching information
    (r"which paragraph contains", "matching_info",
     "instruction: which paragraph"),
    (r"in which (section|paragraph) (is|are|does|can)", "matching_info",
     "instruction: which section"),

    # Matching features
    (r"match each .{1,40} with .{1,40}( listed)? (A|below)", "matching_features",
     "instruction: match A-? options"),
    (r"choose .{1,30} from the (list|box) (A|below)", "matching_features",
     "instruction: choose from list"),

    # Matching sentence endings
    (r"complete each sentence with the correct ending", "matching_endings",
     "instruction: sentence endings"),
    (r"match the (beginning|first part|first half) of each sentence",
     "matching_endings", "instruction: match sentence halves"),

    # Sentence completion
    (r"complete the sentences? below", "sentence_completion",
     "instruction: complete sentences"),
    (r"complete each sentence with .{1,20} from the (passage|text)",
     "sentence_completion", "instruction: complete with words from passage"),

    # Summary / Note / Table / Flow-chart completion
    (r"complete the summary below", "summary_completion",
     "instruction: complete summary"),
    (r"complete the notes below", "summary_completion",
     "instruction: complete notes"),
    (r"complete the table below", "summary_completion",
     "instruction: complete table"),
    (r"complete the flow.?chart below", "summary_completion",
     "instruction: complete flow-chart"),

    # Diagram / map labelling
    (r"label the diagram", "diagram_label", "instruction: label diagram"),
    (r"label the (map|plan)", "map_labelling", "instruction: label map/plan"),

    # Form completion (mostly Listening)
    (r"complete the form below", "form_completion",
     "instruction: complete form"),

    # Short answer
    (r"answer the questions below", "short_answer",
     "instruction: answer questions"),

    # Writing tasks
    (r"summari[sz]e the information by selecting and reporting", "writing_task1",
     "Writing Task 1 prompt"),
    (r"write at least 150 words", "writing_task1", "Writing Task 1: 150 words"),
    (r"write at least 250 words", "writing_task2", "Writing Task 2: 250 words"),
    (r"discuss both .{1,30} views and give your own opinion", "writing_task2",
     "Writing Task 2 prompt"),
    (r"to what extent do you agree", "writing_task2", "Writing Task 2 prompt"),
]


# ─────────────────────────────────────────────────────────────────
# PASS 2 — answer pattern recognition
# ─────────────────────────────────────────────────────────────────

TFNG_TOKENS = {"TRUE", "FALSE", "NOT GIVEN", "T", "F", "NG"}
YNNG_TOKENS = {"YES", "NO", "NOT GIVEN", "Y", "N", "NG"}
ROMAN_NUMERALS = {
    "i", "ii", "iii", "iv", "v", "vi", "vii", "viii",
    "ix", "x", "xi", "xii", "xiii", "xiv", "xv",
}


def _all_match(answers: list[str], pred) -> bool:
    return bool(answers) and all(pred(a.strip()) for a in answers if a.strip())


def detect_from_answers(answers: list[str]) -> Optional[DetectionResult]:
    """Used when instructions don't disambiguate."""
    if not answers:
        return None

    cleaned = [a.strip() for a in answers if a and a.strip()]
    if not cleaned:
        return None

    # TF/NG vs Y/N/NG (TFNG_TOKENS bilan kesishadi, shuning uchun avval YES/NO tekshirib olamiz)
    if _all_match(cleaned, lambda a: a.upper() in TFNG_TOKENS):
        if any(a.upper() in {"YES", "NO"} for a in cleaned):
            return DetectionResult("ynng", 0.95,
                                   "answers contain YES/NO/NOT GIVEN")
        return DetectionResult("tfng", 0.95,
                               "answers contain TRUE/FALSE/NOT GIVEN")

    if _all_match(cleaned, lambda a: a.upper() in YNNG_TOKENS):
        return DetectionResult("ynng", 0.95,
                               "answers contain YES/NO/NOT GIVEN")

    # Matching Headings (lowercase roman numerals)
    if _all_match(cleaned, lambda a: a.lower() in ROMAN_NUMERALS):
        return DetectionResult("matching_headings", 0.95,
                               "answers are roman numerals (i, ii, iii…)")

    # Multi-letter answers (MCQ multi)
    if _all_match(
        cleaned,
        lambda a: bool(re.match(r"^[A-J](\s*[,&]\s*[A-J])+$", a.upper())),
    ):
        return DetectionResult("mcq_multi", 0.9,
                               "answers are multiple letters separated by , or &")

    # Single letter A-J — ambiguous
    if _all_match(cleaned, lambda a: bool(re.match(r"^[A-J]$", a.upper()))):
        return DetectionResult(
            "mcq_single", 0.5,
            "single letters — could also be Matching Information / Features",
            needs_confirm=True,
        )

    # Numbers only — usually completion
    if _all_match(cleaned, lambda a: bool(re.match(r"^[\d.,/:]+$", a))):
        return DetectionResult("sentence_completion", 0.7,
                               "numeric answers — completion")

    # Short text (1–3 words) — completion or short answer (ambiguous)
    if _all_match(cleaned, lambda a: 1 <= len(a.split()) <= 3):
        return DetectionResult(
            "sentence_completion", 0.6,
            "short text answers — completion or short-answer",
            needs_confirm=True,
        )

    # Longer text — short answer
    if _all_match(cleaned, lambda a: 1 <= len(a.split()) <= 6):
        return DetectionResult("short_answer", 0.7,
                               "answers up to 6 words")

    return DetectionResult("unknown", 0.0,
                           "could not infer type from answers",
                           needs_confirm=True)


def detect_question_type(instructions: str, answers: list[str]) -> DetectionResult:
    """Main entry point.

    PASS 1: instruction patterns. If a high-confidence match is found, sanity-
    check it against answer pattern; on conflict lower confidence and ask the
    admin to confirm.
    PASS 2: fallback — pure answer pattern recognition.
    """
    instr = instructions or ""

    for pattern, qtype, reason in INSTRUCTION_PATTERNS:
        if re.search(pattern, instr, re.IGNORECASE | re.DOTALL):
            ans_check = detect_from_answers(answers)
            if ans_check and ans_check.qtype != qtype and ans_check.confidence > 0.8:
                return DetectionResult(
                    qtype=qtype, confidence=0.6,
                    reason=f"{reason}; answers suggest {ans_check.qtype} — please confirm",
                    needs_confirm=True,
                )
            return DetectionResult(qtype, 0.95, reason)

    fallback = detect_from_answers(answers)
    return fallback or DetectionResult("unknown", 0.0,
                                       "no signals", needs_confirm=True)
