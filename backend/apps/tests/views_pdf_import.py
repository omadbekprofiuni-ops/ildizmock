"""ETAP 31 — Smart PDF Import API views.

Endpoints:
  POST /admin/tests/import-pdf/preview/   — parse PDF (no DB writes)
  POST /admin/tests/import-pdf/confirm/   — save the reviewed structure as a Test

The preview step returns editable JSON. The confirm step accepts that
JSON (after admin edits) and creates Test + Passage/ListeningPart + Question
rows as a draft. Audio for listening tests is uploaded separately via the
existing admin tests editor.
"""

from __future__ import annotations

from typing import Any, Dict, List

from django.db import transaction
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ListeningPart, Passage, Question, Test
from .services.pdf_import import IELTSPDFParser, enhance_with_ai


PDF_MAX_BYTES = 20 * 1024 * 1024  # 20 MB


# ============================================
# Permissions
# ============================================

class CanImportPDF(BasePermission):
    """teacher / org_admin / superadmin can import PDFs."""

    message = 'Only teacher, center admin or super admin can import tests.'

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return getattr(request.user, 'role', None) in (
            'teacher', 'org_admin', 'superadmin',
        )


# ============================================
# Type mapping (parser → existing Question.TYPE_CHOICES)
# ============================================

_QTYPE_MAP = {
    'completion':      'fill',
    'multiple_choice': 'mcq',
    'matching':        'matching',
    'true_false':      'tfng',
}


def _map_qtype(parser_type: str) -> str:
    return _QTYPE_MAP.get(parser_type, 'fill')


def _options_for(parser_type: str, options: List[str]) -> List[Dict[str, str]]:
    """Convert "A. text" strings → [{label, value}] for Question.options legacy field."""
    if parser_type != 'multiple_choice':
        return []
    out: List[Dict[str, str]] = []
    for opt in options:
        # Split "A. The London ..." or "A) The London..."
        parts = opt.split('.', 1) if '.' in opt[:3] else opt.split(')', 1)
        if len(parts) == 2:
            letter, text = parts[0].strip(), parts[1].strip()
        else:
            letter, text = '', opt.strip()
        out.append({'label': letter, 'value': text})
    return out


def _correct_answer_legacy(parser_type: str, answer: str) -> Any:
    """correct_answer is a JSONField — store either the string or a list."""
    answer = (answer or '').strip()
    if parser_type == 'true_false':
        return answer.upper()
    return answer


# ============================================
# Views
# ============================================

class PDFImportPreviewView(APIView):
    """Parse a PDF and return a structured preview.

    Saves nothing — admin reviews/edits the JSON in the UI, then sends it
    back to `PDFImportConfirmView` to create the Test.
    """

    permission_classes = [CanImportPDF]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        pdf_file = request.FILES.get('pdf')
        if not pdf_file:
            return Response(
                {'error': 'No PDF file uploaded.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if pdf_file.size > PDF_MAX_BYTES:
            return Response(
                {'error': 'PDF must be under 20 MB.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ctype = (getattr(pdf_file, 'content_type', '') or '').lower()
        name = (pdf_file.name or '').lower()
        if ctype != 'application/pdf' and not name.endswith('.pdf'):
            return Response(
                {'error': 'File must be a PDF.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            parser = IELTSPDFParser(pdf_file.read())
            parsed = parser.parse()
        except Exception as exc:
            return Response(
                {'error': f'Failed to parse PDF: {exc}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if str(request.data.get('use_ai', '')).lower() == 'true':
            parsed = enhance_with_ai(parsed)

        return Response({
            'title': parsed.title,
            'test_type': parsed.test_type,
            'duration_minutes': parsed.duration_minutes,
            'confidence': round(parsed.confidence, 3),
            'audio_hint': parsed.audio_hint,
            'warnings': parsed.warnings,
            'questions': [
                {
                    'order': q.order,
                    'part_number': q.part_number,
                    'stem': q.stem,
                    'type': q.type,
                    'options': q.options,
                    'suggested_answer': q.suggested_answer,
                    'confidence': round(q.confidence, 3),
                    'needs_review': q.needs_review,
                }
                for q in parsed.questions
            ],
        })


class PDFImportConfirmView(APIView):
    """Save the reviewed structured data as a draft Test."""

    permission_classes = [CanImportPDF]

    @transaction.atomic
    def post(self, request):
        data = request.data
        title = (data.get('title') or 'Imported Test').strip()
        test_type = data.get('test_type', 'reading')
        if test_type not in ('listening', 'reading', 'writing'):
            return Response(
                {'error': 'Invalid test_type.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            duration = int(data.get('duration_minutes') or 60)
        except (TypeError, ValueError):
            duration = 60

        questions = data.get('questions') or []
        if not isinstance(questions, list):
            return Response(
                {'error': 'questions must be an array.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        is_super = getattr(user, 'role', None) == 'superadmin'
        # `is_library` (spec name) → `is_global` (existing model field).
        is_library = bool(data.get('is_library', is_super))
        organization = None if is_library else getattr(user, 'organization', None)

        if not is_library and organization is None:
            return Response(
                {'error': 'User has no organization for a center test.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        test = Test.objects.create(
            organization=organization,
            is_global=is_library,
            name=title,
            module=test_type,
            test_type='academic',
            difficulty='medium',
            duration_minutes=duration,
            description='',
            is_published=False,
            status='draft',
            created_by=user,
        )

        # Group questions by part.
        parts_by_number: Dict[int, list] = {}
        for q in questions:
            part_no = int(q.get('part_number') or 1)
            parts_by_number.setdefault(part_no, []).append(q)

        for part_no in sorted(parts_by_number.keys()):
            qs = parts_by_number[part_no]
            if test_type == 'listening':
                container = ListeningPart.objects.create(
                    test=test,
                    part_number=part_no,
                    instructions='',
                )
                container_kwargs = {'listening_part': container}
            else:
                container = Passage.objects.create(
                    test=test,
                    part_number=part_no,
                    title=f'{title} — Part {part_no}',
                    content='',
                    instructions='',
                    order=part_no,
                )
                container_kwargs = {'passage': container}

            for q in qs:
                qtype_legacy = _map_qtype(q.get('type', 'completion'))
                stem = (q.get('stem') or '').strip()
                opts = q.get('options') or []
                ans = q.get('answer') or q.get('suggested_answer') or ''
                Question.objects.create(
                    order=int(q.get('order') or 0),
                    question_number=int(q.get('order') or 0),
                    question_type=qtype_legacy,
                    text=stem,
                    prompt=stem,
                    options=_options_for(q.get('type', ''), opts),
                    correct_answer=_correct_answer_legacy(
                        q.get('type', ''), ans,
                    ),
                    instruction='',
                    payload={'options': opts} if opts else {},
                    answer_key={'correct': ans} if ans else {},
                    **container_kwargs,
                )

        return Response({
            'id': str(test.id),
            'next': f'/admin/tests/{test.id}/edit',
            'is_library': is_library,
            'questions_saved': sum(len(v) for v in parts_by_number.values()),
        }, status=status.HTTP_201_CREATED)
