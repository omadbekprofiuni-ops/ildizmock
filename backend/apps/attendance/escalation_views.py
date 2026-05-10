"""ETAP 28 — Escalation va Telegram binding endpoint'lari.

URL'lar `apps/center/urls.py` orqali markaz scope'ida ulanadi:
  GET   /api/v1/center/<slug>/attendance/escalations/
  POST  /api/v1/center/<slug>/attendance/escalations/<id>/resolve/
  POST  /api/v1/center/<slug>/attendance/telegram/bind/
"""
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AttendanceEscalation, TelegramBinding
from .views import _get_org_or_403, _is_admin


def _serialize_escalation(esc: AttendanceEscalation) -> dict:
    s = esc.student
    full_name = f'{s.first_name or ""} {s.last_name or ""}'.strip() or s.username
    return {
        'id': esc.id,
        'student_id': s.id,
        'student_name': full_name,
        'group_id': esc.group_id,
        'group_name': esc.group.name if esc.group_id else None,
        'tier': esc.tier,
        'absence_count': esc.absence_count,
        'triggered_at': esc.triggered_at.isoformat(),
        'resolved_at': esc.resolved_at.isoformat() if esc.resolved_at else None,
        'resolution_note': esc.resolution_note,
    }


class EscalationListView(APIView):
    """GET — markazning escalations ro'yxati.

    Query paramlar:
        ?resolved=0|1   — filterlash (default: faqat resolved emas)
        ?tier=warning|reprimand|removal
        ?student=<id>
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, org_slug=None):
        org = _get_org_or_403(request.user, org_slug)
        qs = AttendanceEscalation.objects.filter(
            group__organization=org,
        ).select_related('student', 'group').order_by('-triggered_at')

        resolved = request.query_params.get('resolved', '0')
        if resolved in ('1', 'true', 'yes'):
            qs = qs.exclude(resolved_at__isnull=True)
        elif resolved in ('0', 'false', 'no'):
            qs = qs.filter(resolved_at__isnull=True)

        tier = request.query_params.get('tier')
        if tier:
            qs = qs.filter(tier=tier)

        student_id = request.query_params.get('student')
        if student_id:
            qs = qs.filter(student_id=student_id)

        return Response([_serialize_escalation(e) for e in qs[:200]])


class EscalationResolveView(APIView):
    """POST — escalation'ni hal qilish (faqat admin)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, org_slug=None, escalation_id=None):
        org = _get_org_or_403(request.user, org_slug)
        if not _is_admin(request.user, org):
            return Response(
                {'detail': 'Faqat markaz administratori escalation\'ni hal qila oladi.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        esc = get_object_or_404(
            AttendanceEscalation,
            pk=escalation_id,
            group__organization=org,
        )
        if esc.resolved_at:
            return Response(
                {'detail': 'Escalation already resolved.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        esc.resolved_at = timezone.now()
        esc.resolved_by = request.user
        esc.resolution_note = request.data.get('note', '') or ''
        esc.save(update_fields=[
            'resolved_at', 'resolved_by', 'resolution_note',
        ])
        return Response(_serialize_escalation(esc))


class TelegramBindView(APIView):
    """POST — talaba uchun ota-ona Telegram chat_id'sini bog'laydi.

    Request body:
        student_id    (int)    — talaba ID
        chat_id       (string) — Telegram chat ID
        parent_name   (string) — ota-ona ismi (ixtiyoriy)
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, org_slug=None):
        org = _get_org_or_403(request.user, org_slug)
        if not _is_admin(request.user, org):
            return Response(
                {'detail': 'Faqat markaz administratori bog\'lash huquqiga ega.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        student_id = request.data.get('student_id')
        chat_id = (request.data.get('chat_id') or '').strip()
        parent_name = (request.data.get('parent_name') or '').strip()

        if not student_id or not chat_id:
            return Response(
                {'detail': 'student_id va chat_id majburiy.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.contrib.auth import get_user_model

        User = get_user_model()
        student = get_object_or_404(
            User,
            pk=student_id,
            role='student',
            organization=org,
        )

        binding, created = TelegramBinding.objects.update_or_create(
            student=student,
            chat_id=chat_id,
            defaults={
                'parent_name': parent_name,
                'is_active': True,
            },
        )

        return Response(
            {
                'id': binding.id,
                'student_id': binding.student_id,
                'chat_id': binding.chat_id,
                'parent_name': binding.parent_name,
                'is_active': binding.is_active,
                'created': created,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
