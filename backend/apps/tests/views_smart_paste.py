"""ETAP 24 — Smart Paste API views.

Bu spec'dagi `Section/PassageBank/AudioBank` modellaridan farqli o'laroq,
hozirgi DB modellariga yozadi:
  Reading: Test → Passage(part_number=1, content=plain_text) → Question(payload, answer_key)
  Listening: Test → ListeningPart(part_number=1..4) → Question(payload, answer_key)
  Writing: Test → WritingTask
  Speaking: Test → WritingTask (existing reuse — speaking_tasks)

ParsedQuestion'lar payload + answer_key JSONField'larida saqlanadi (ETAP 22
da qo'shilgan), `correct_answer` ham backward-compat uchun to'ldiriladi.
"""

import os
import tempfile
from dataclasses import asdict
from typing import Any

from django.db import transaction
from django.http import FileResponse
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ListeningPart, Passage, Question, Test, WritingTask
from .smart_paste.excel_importer import generate_template_xlsx, parse_excel
from .smart_paste.listening_parser import parse_listening
from .smart_paste.reading_parser import ParseResult, parse_reading
from .smart_paste.writing_speaking_parser import parse_speaking, parse_writing


def _serialize_parse_result(pr: ParseResult) -> dict[str, Any]:
    """Convert dataclasses to JSON-serialisable dict for the live preview."""
    return {
        "passage_html": pr.passage_html,
        "passage_word_count": pr.passage_word_count,
        "paragraphs": pr.paragraphs,
        "question_count": pr.question_count,
        "warnings": pr.warnings,
        "errors": pr.errors,
        "sections": [
            {
                "instructions": s.instructions,
                "warnings": s.warnings,
                "questions": [
                    {
                        "order": q.order,
                        "qtype": q.qtype,
                        "payload": q.payload,
                        "answer_key": q.answer_key,
                        "raw_text": q.raw_text,
                        "detection": (
                            asdict(q.detection) if q.detection else None
                        ),
                    } for q in s.questions
                ],
            } for s in pr.sections
        ],
    }


def _run_parser(mode: str, data) -> ParseResult:
    if mode == "reading":
        return parse_reading(
            data.get("passage", "") or "",
            data.get("questions", "") or "",
            data.get("answers", "") or "",
        )
    if mode == "listening":
        return parse_listening(
            data.get("transcript", "") or "",
            data.get("questions", "") or "",
            data.get("answers", "") or "",
        )
    if mode == "writing":
        return parse_writing(
            data.get("task1_prompt", "") or "",
            data.get("task2_prompt", "") or "",
            data.get("task1_image_url", "") or "",
        )
    if mode == "speaking":
        return parse_speaking(
            data.get("part1", "") or "",
            data.get("part2", "") or "",
            data.get("part3", "") or "",
        )
    raise ValueError(f"Invalid mode: {mode!r}")


class SmartPastePreviewView(APIView):
    """Parses without saving — used for live preview in the UI."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        mode = request.data.get("mode")
        try:
            pr = _run_parser(mode, request.data)
        except ValueError as e:
            return Response({"error": str(e)},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response(_serialize_parse_result(pr))


def _question_text_for_legacy(qtype: str, payload: dict, raw_text: str) -> str:
    """Talaba ko'radigan asosiy savol matni (legacy `text` ustuni)."""
    if qtype in ("tfng", "ynng"):
        return payload.get("statement") or raw_text
    if qtype in ("mcq_single", "mcq_multi"):
        return payload.get("stem") or raw_text
    if qtype in ("sentence_completion", "summary_completion", "form_completion"):
        return payload.get("template") or raw_text
    if qtype == "short_answer":
        return payload.get("stem") or raw_text
    return raw_text or ""


def _correct_answer_for_legacy(qtype: str, answer_key: dict) -> Any:
    """Legacy `correct_answer` ustuni uchun qiymat (backward compat)."""
    if not isinstance(answer_key, dict):
        return ""
    if "answer" in answer_key:
        return answer_key["answer"]
    if "answers" in answer_key:
        return answer_key["answers"]
    if "blanks" in answer_key:
        # First blank, first acceptable
        try:
            return answer_key["blanks"][0][0]
        except (IndexError, TypeError):
            return ""
    if "matches" in answer_key:
        # group form — store full dict
        return answer_key["matches"]
    return ""


def _options_for_legacy(qtype: str, payload: dict) -> list:
    """Legacy `options` ustuni (mavjud renderer uchun)."""
    if qtype in ("mcq_single", "mcq_multi"):
        return [opt.get("text", "") for opt in payload.get("options", [])]
    return []


class SmartPasteCreateView(APIView):
    """Parses AND creates the Test/Passage/ListeningPart/Question records as a draft."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @transaction.atomic
    def post(self, request):
        title = (request.data.get("title") or "Untitled Test").strip()
        mode = request.data.get("mode")
        module_field = request.data.get("module", "academic")  # 'academic' | 'general'

        try:
            pr = _run_parser(mode, request.data)
        except ValueError as e:
            return Response({"error": str(e)},
                            status=status.HTTP_400_BAD_REQUEST)

        if pr.errors:
            return Response(
                {"errors": pr.errors, "preview": _serialize_parse_result(pr)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        organization = getattr(request.user, "organization", None)

        # MODULE_CHOICES on Test: 'listening', 'reading', 'writing', 'speaking', 'full_mock'
        # TYPE_CHOICES: 'academic' | 'general'
        test = Test.objects.create(
            organization=organization,
            name=title,
            module=mode,
            test_type=module_field if module_field in ("academic", "general") else "academic",
            difficulty=request.data.get("difficulty", "medium"),
            duration_minutes=int(request.data.get("duration_minutes", 60)),
            description=request.data.get("description", ""),
            is_published=False,
            status="draft",
            created_by=request.user,
        )

        # Reading — single passage holds the body; one Section per parsed block.
        if mode == "reading":
            # Convert HTML body to plain text for the legacy `Passage.content` field.
            # Frontend renderer expects plain text + optional HTML support.
            for sec_idx, parsed_section in enumerate(pr.sections, start=1):
                passage = Passage.objects.create(
                    test=test,
                    part_number=sec_idx,
                    title=title if sec_idx == 1 else f"{title} — Part {sec_idx}",
                    content=pr.passage_html,
                    instructions=parsed_section.instructions,
                    order=sec_idx,
                )
                for pq in parsed_section.questions:
                    Question.objects.create(
                        passage=passage,
                        order=pq.order,
                        question_number=pq.order,
                        question_type=pq.qtype,
                        text=_question_text_for_legacy(pq.qtype, pq.payload, pq.raw_text),
                        prompt=_question_text_for_legacy(pq.qtype, pq.payload, pq.raw_text),
                        options=_options_for_legacy(pq.qtype, pq.payload),
                        correct_answer=_correct_answer_for_legacy(pq.qtype, pq.answer_key),
                        instruction=parsed_section.instructions,
                        payload=pq.payload,
                        answer_key=pq.answer_key,
                    )

        elif mode == "listening":
            # Single AudioBank o'rniga audio_file ListeningPart 1 ga biriktiriladi
            audio_file = request.FILES.get("audio_file")
            for sec_idx, parsed_section in enumerate(pr.sections, start=1):
                lp = ListeningPart.objects.create(
                    test=test,
                    part_number=sec_idx,
                    transcript=request.data.get("transcript", "") if sec_idx == 1 else "",
                    instructions=parsed_section.instructions,
                )
                if sec_idx == 1 and audio_file:
                    lp.audio_file = audio_file
                    lp.save(update_fields=["audio_file"])
                for pq in parsed_section.questions:
                    Question.objects.create(
                        listening_part=lp,
                        order=pq.order,
                        question_number=pq.order,
                        question_type=pq.qtype,
                        text=_question_text_for_legacy(pq.qtype, pq.payload, pq.raw_text),
                        prompt=_question_text_for_legacy(pq.qtype, pq.payload, pq.raw_text),
                        options=_options_for_legacy(pq.qtype, pq.payload),
                        correct_answer=_correct_answer_for_legacy(pq.qtype, pq.answer_key),
                        instruction=parsed_section.instructions,
                        payload=pq.payload,
                        answer_key=pq.answer_key,
                    )

        elif mode == "writing":
            for parsed_section in pr.sections:
                for pq in parsed_section.questions:
                    task_number = 1 if pq.qtype == "writing_task1" else 2
                    WritingTask.objects.create(
                        test=test,
                        task_number=task_number,
                        prompt=pq.payload.get("prompt", ""),
                        min_words=pq.payload.get("min_words", 150),
                        suggested_minutes=pq.payload.get("time_minutes", 20),
                    )

        elif mode == "speaking":
            for parsed_section in pr.sections:
                for pq in parsed_section.questions:
                    task_number = {
                        "speaking_p1": 1,
                        "speaking_p2": 2,
                        "speaking_p3": 3,
                    }.get(pq.qtype, 1)
                    # Speaking uchun WritingTask reuse'lash — frontend
                    # `speaking_tasks` ostida o'qiydi. Prompt'da qo'shimcha
                    # JSON ma'lumotlar.
                    payload_str = (
                        pq.payload.get("topic", "") if pq.qtype == "speaking_p2"
                        else "\n".join(pq.payload.get("questions", []))
                    )
                    WritingTask.objects.create(
                        test=test,
                        task_number=task_number,
                        prompt=payload_str,
                        requirements=str(pq.payload),
                        min_words=0,
                        suggested_minutes=4,
                    )

        return Response({
            "test_id": str(test.id),
            "warnings": pr.warnings,
            "edit_url": f"/admin/tests/{test.id}/edit",
            "preview_url": f"/admin/tests/{test.id}/preview",
        }, status=status.HTTP_201_CREATED)


class SmartPasteExcelImportView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return Response({"error": "No file uploaded"}, status=400)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
            for chunk in upload.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name

        try:
            pr = parse_excel(tmp_path)
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

        return Response(_serialize_parse_result(pr))


class SmartPasteExcelTemplateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
        tmp.close()
        generate_template_xlsx(tmp.name)
        return FileResponse(
            open(tmp.name, "rb"),
            as_attachment=True,
            filename="ildiz-mock-test-template.xlsx",
        )
