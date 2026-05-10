"""ETAP 24 — Listening parser. Reuses Reading parser's question machinery
but expects 4 sections (Q 1-10, 11-20, 21-30, 31-40). Transcript is
optional (used as `passage_html` placeholder for the response shape).
"""

from .reading_parser import (
    ParseResult,
    ParsedSection,
    parse_answer_key,
    parse_questions_block,
    split_into_question_blocks,
)


SECTION_RANGES = [(1, 10), (11, 20), (21, 30), (31, 40)]


def parse_listening(transcript: str, questions: str, answers: str) -> ParseResult:
    """Returns a ParseResult with up to 4 ParsedSections (one per Listening
    section). transcript is preserved on the result for the caller to attach
    to AudioBank/ListeningPart later.
    """
    result = ParseResult(passage_html=transcript or "",
                         passage_word_count=0, paragraphs=[])

    if not questions.strip():
        result.errors.append("Questions block is empty")
        return result
    if not answers.strip():
        result.errors.append("Answer key is empty")
        return result

    answer_map = parse_answer_key(answers)
    if not answer_map:
        result.errors.append("No answer-key entries detected.")
        return result

    blocks = split_into_question_blocks(questions)
    if not blocks:
        result.errors.append("No 'Questions X-Y' headers found.")
        return result

    sections: dict[int, ParsedSection] = {
        i: ParsedSection(instructions=f"Section {i + 1}") for i in range(4)
    }

    for start_q, end_q, header, body in blocks:
        for idx, (lo, hi) in enumerate(SECTION_RANGES):
            if lo <= start_q <= hi:
                parsed = parse_questions_block(body, answer_map)
                sections[idx].questions.extend(parsed.questions)
                sections[idx].warnings.extend(parsed.warnings)
                if (
                    not sections[idx].instructions
                    or sections[idx].instructions.startswith("Section ")
                ):
                    sections[idx].instructions = parsed.instructions
                break
        else:
            result.warnings.append(
                f"Block 'Questions {start_q}-{end_q}' is outside Listening 1–40 range.",
            )

    result.sections = [sections[i] for i in range(4) if sections[i].questions]
    return result
