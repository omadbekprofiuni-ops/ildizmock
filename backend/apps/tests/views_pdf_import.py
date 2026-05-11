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

from datetime import date as date_cls
from typing import Any, Dict, List

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ListeningPart, Passage, PDFImportLog, Question, Test
from .services.pdf_import import IELTSPDFParser, parse_pdf_with_ai


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

        pdf_bytes = pdf_file.read()
        use_ai = str(request.data.get('use_ai', '')).lower() == 'true'
        hint = (request.data.get('section_type') or '').strip().lower() or None

        # ETAP 16.7 — har bir urinishni audit + quota tracking uchun yozamiz.
        log = PDFImportLog.objects.create(
            user=request.user,
            organization=getattr(request.user, 'organization', None),
            file_name=pdf_file.name or 'untitled.pdf',
            file_size_bytes=len(pdf_bytes),
            use_ai=use_ai,
            section_type_hint=hint or '',
            status=PDFImportLog.Status.PROCESSING,
        )

        ai_provider_name = ''
        ai_model = ''
        ai_tokens = 0
        ai_cost = 0.0

        if use_ai:
            try:
                ai_result = parse_pdf_with_ai(pdf_bytes, hint_section_type=hint)
            except Exception as exc:
                # Provider yaratish yoki API xatosi — regex pipeline'ga tushamiz,
                # warning bilan. Log'ga xato xabarini ham saqlaymiz.
                log.status = PDFImportLog.Status.FAILED
                log.error_message = str(exc)[:1000]
                log.save(update_fields=['status', 'error_message'])
                try:
                    parsed = IELTSPDFParser(pdf_bytes).parse()
                except Exception as exc2:
                    return Response(
                        {'error': f'Failed to parse PDF: {exc2}'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                parsed.warnings.insert(0, f'AI ishlamadi, regex bilan parse: {exc}')
            else:
                parsed = ai_result.parsed
                ai_provider_name = ai_result.provider_name
                ai_model = ai_result.model_used
                ai_tokens = ai_result.tokens_used
                ai_cost = ai_result.cost_usd
                log.status = PDFImportLog.Status.AI_PARSED
                log.provider_name = ai_provider_name
                log.model_used = ai_model
                log.tokens_used = ai_tokens
                log.cost_usd = ai_cost
                log.save(update_fields=[
                    'status', 'provider_name', 'model_used',
                    'tokens_used', 'cost_usd',
                ])
        else:
            try:
                parsed = IELTSPDFParser(pdf_bytes).parse()
            except Exception as exc:
                log.status = PDFImportLog.Status.FAILED
                log.error_message = str(exc)[:1000]
                log.save(update_fields=['status', 'error_message'])
                return Response(
                    {'error': f'Failed to parse PDF: {exc}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            log.status = PDFImportLog.Status.COMPLETED_NO_AI
            log.save(update_fields=['status'])

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
            # ETAP 16.7 — AI metadata UI badge uchun
            'ai_used': use_ai and bool(ai_provider_name),
            'ai_provider': ai_provider_name,
            'ai_model': ai_model,
            'tokens_used': ai_tokens,
            'cost_usd': round(ai_cost, 6),
            'log_id': log.id,
        })


class PDFImportConfirmView(APIView):
    """Save the reviewed structured data as a draft Test."""

    permission_classes = [CanImportPDF]

    @transaction.atomic
    def post(self, request):
        data = request.data
        log_id = data.get('log_id')
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

        if log_id:
            try:
                PDFImportLog.objects.filter(pk=int(log_id)).update(
                    status=PDFImportLog.Status.SAVED,
                )
            except (TypeError, ValueError):
                pass

        return Response({
            'id': str(test.id),
            'next': f'/admin/tests/{test.id}/edit',
            'is_library': is_library,
            'questions_saved': sum(len(v) for v in parts_by_number.values()),
        }, status=status.HTTP_201_CREATED)


# ============================================
# ETAP 16.7 — AI usage / quota
# ============================================

class AIQuotaStatsView(APIView):
    """`GET /api/v1/admin/tests/ai-quota/` — bugungi AI ishlatish va limit.

    Foydalanuvchining markazga tegishli importlarini hisoblaymiz (superadmin
    bo'lsa — barchasini). Free-tier limit 250/kun (Gemini AI Studio 2.5 Flash).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        role = getattr(request.user, 'role', None)
        if role not in ('teacher', 'org_admin', 'superadmin'):
            return Response(
                {'error': 'forbidden'}, status=status.HTTP_403_FORBIDDEN,
            )

        today = timezone.localdate()
        qs = PDFImportLog.objects.filter(
            created_at__date=today, use_ai=True,
        )
        if role != 'superadmin':
            org_id = getattr(request.user, 'organization_id', None)
            qs = qs.filter(organization_id=org_id)

        today_requests = qs.count()
        agg = qs.aggregate(
            tokens=Sum('tokens_used'),
            cost=Sum('cost_usd'),
        )

        # Provider info ham qaytaramiz (UI badge'i uchun)
        provider_info: dict = {}
        try:
            from .services.ai_providers import get_ai_provider

            info = get_ai_provider().info()
            provider_info = {
                'name': info.name,
                'model': info.model,
                'supports_pdf_direct': info.supports_pdf_direct,
                'free_tier_available': info.free_tier_available,
                'daily_quota': info.daily_quota,
                'notes': info.notes,
            }
        except Exception as exc:
            provider_info = {'error': str(exc)}

        daily_limit = provider_info.get('daily_quota') or 250

        return Response({
            'today_requests': today_requests,
            'today_tokens': int(agg['tokens'] or 0),
            'today_cost_usd': float(agg['cost'] or 0),
            'daily_free_limit': daily_limit,
            'remaining': max(0, daily_limit - today_requests),
            'provider': provider_info,
            'date': today.isoformat(),
        })
