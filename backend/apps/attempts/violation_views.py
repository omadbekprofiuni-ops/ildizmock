"""ETAP 29 — Strict Test Mode (anti-cheating) endpoint'lari.

POST /api/v1/student/attempts/<id>/violations/ — talaba clientidan violation
GET  /api/v1/admin/attempts/<id>/violations/   — teacher report
GET/PATCH /api/v1/admin/strict-mode-settings/  — markaz admin sozlamalari
"""
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status as drf_status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .grading import grade_attempt
from .models import Attempt, TestSecurityViolation
from .views import _can_access_attempt

VALID_TYPES = {choice[0] for choice in TestSecurityViolation.TYPE_CHOICES}

# Debounce ostonalari (ms). 300ms'dan kichik blur'lar OS notif / focus
# flicker bo'lib chiqishi mumkin — counted=False bilan yoziladi (auditda
# qoladi, lekin auto-submit'ga ta'sir qilmaydi).
DEBOUNCE_MS = 300


def _serialize_violation(v: TestSecurityViolation) -> dict:
    return {
        'id': v.id,
        'type': v.type,
        'occurred_at': v.occurred_at.isoformat(),
        'duration_ms': v.duration_ms,
        'metadata': v.metadata,
        'counted': v.counted,
    }


class RecordViolationView(APIView):
    """POST — talaba clientidan kelgan strict mode violation'ni yozadi.

    Body: {type: <string>, duration_ms: <int>, metadata: {...}}.
    Limit-tekshiruvi shu yerda: counted'lar soni org_limit'ga yetganda
    attempt avtomatik submit qilinadi va flagged_as_cheating=True bo'ladi.
    """

    permission_classes = [AllowAny]  # guest attempts ham strict mode'da bo'lishi mumkin

    def post(self, request, attempt_id):
        attempt = get_object_or_404(Attempt, pk=attempt_id)
        if not _can_access_attempt(request, attempt):
            return Response(
                {'detail': 'Forbidden.'},
                status=drf_status.HTTP_403_FORBIDDEN,
            )
        if attempt.status != 'in_progress':
            return Response(
                {'detail': 'Attempt is not in progress.'},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        vtype = request.data.get('type', 'other')
        if vtype not in VALID_TYPES:
            vtype = 'other'

        duration = request.data.get('duration_ms')
        try:
            duration = int(duration) if duration is not None else None
        except (ValueError, TypeError):
            duration = None

        # Debounce: kichik blur'lar counted=False
        counted = True
        if vtype in ('window_blurred', 'tab_switched') and duration is not None and duration < DEBOUNCE_MS:
            counted = False

        violation = TestSecurityViolation.objects.create(
            attempt=attempt,
            type=vtype,
            duration_ms=duration,
            metadata=request.data.get('metadata', {}) or {},
            counted=counted,
        )

        # Org sozlamasi (test.organization mavjud bo'lsa undan, aks holda
        # default 3) bo'yicha counted'lar limitini tekshiramiz.
        org = getattr(attempt.test, 'organization', None)
        limit = (
            getattr(org, 'test_violation_limit', 3) if org else 3
        )
        counted_total = attempt.violations.filter(counted=True).count()
        auto_submitted = False

        if limit > 0 and counted_total >= limit and attempt.status == 'in_progress':
            attempt.status = 'submitted'
            attempt.submitted_at = timezone.now()
            attempt.flagged_as_cheating = True
            attempt.auto_submitted = True
            attempt.auto_submit_reason = 'too_many_violations'
            attempt.save(update_fields=[
                'status', 'submitted_at', 'flagged_as_cheating',
                'auto_submitted', 'auto_submit_reason',
            ])
            # Reading / Listening — auto-grade. Writing/Speaking manual.
            module = attempt.test.module
            if module in ('reading', 'listening'):
                try:
                    grade_attempt(attempt)
                except Exception:
                    # Auto-submit bekor qilinmasin, lekin grade muvaffaqiyatsiz
                    # bo'lsa loglaymiz.
                    import logging
                    logging.getLogger(__name__).exception(
                        'auto-grade failed after violation auto-submit',
                    )
            auto_submitted = True

        return Response(
            {
                'id': violation.id,
                'counted': counted,
                'violations_total': counted_total,
                'violation_limit': limit,
                'auto_submitted': auto_submitted,
            },
            status=drf_status.HTTP_201_CREATED,
        )


class AttemptViolationsView(APIView):
    """GET — bitta attempt uchun violations list (teacher / admin uchun)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, attempt_id):
        attempt = get_object_or_404(Attempt, pk=attempt_id)
        # Faqat shu attempt egasi YOKI shu test markaz a'zosi ko'ra oladi
        user = request.user
        is_owner = attempt.user_id == user.id
        is_teacher = getattr(user, 'role', None) in (
            'teacher', 'org_admin', 'admin', 'superadmin',
        )
        same_org = (
            attempt.test.organization_id is not None
            and getattr(user, 'organization_id', None) == attempt.test.organization_id
        )
        if not (is_owner or (is_teacher and same_org) or user.is_superuser):
            return Response(
                {'detail': 'Forbidden.'},
                status=drf_status.HTTP_403_FORBIDDEN,
            )

        qs = attempt.violations.all().order_by('occurred_at')
        return Response([_serialize_violation(v) for v in qs])


class OrgStrictModeSettingsView(APIView):
    """GET / PATCH — markaz adminining strict mode org-level sozlamalari."""

    permission_classes = [IsAuthenticated]

    def _get_org(self, request):
        user = request.user
        org = getattr(user, 'organization', None)
        return org

    def get(self, request):
        org = self._get_org(request)
        if org is None:
            return Response(
                {'detail': 'No organization in context.'},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        return Response({
            'test_strict_mode_enabled': org.test_strict_mode_enabled,
            'test_violation_limit': org.test_violation_limit,
        })

    def patch(self, request):
        org = self._get_org(request)
        if org is None:
            return Response(
                {'detail': 'No organization in context.'},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        # Faqat admin/owner/superadmin sozlamalarni o'zgartira oladi
        user = request.user
        if not (user.is_superuser or getattr(user, 'role', None) in ('org_admin', 'admin', 'superadmin')):
            from apps.organizations.models import OrganizationMembership
            is_admin = OrganizationMembership.objects.filter(
                user=user, organization=org, role__in=['admin', 'owner'],
            ).exists()
            if not is_admin:
                return Response(
                    {'detail': 'Faqat markaz administratori sozlamalarni o\'zgartira oladi.'},
                    status=drf_status.HTTP_403_FORBIDDEN,
                )

        enabled = request.data.get('test_strict_mode_enabled')
        limit = request.data.get('test_violation_limit')

        if enabled is not None:
            org.test_strict_mode_enabled = bool(enabled)
        if limit is not None:
            try:
                limit_int = int(limit)
            except (ValueError, TypeError):
                return Response(
                    {'detail': 'test_violation_limit must be int.'},
                    status=drf_status.HTTP_400_BAD_REQUEST,
                )
            if limit_int < 0 or limit_int > 20:
                return Response(
                    {'detail': 'test_violation_limit must be between 0 and 20.'},
                    status=drf_status.HTTP_400_BAD_REQUEST,
                )
            org.test_violation_limit = limit_int

        org.save(update_fields=['test_strict_mode_enabled', 'test_violation_limit'])
        return Response({
            'test_strict_mode_enabled': org.test_strict_mode_enabled,
            'test_violation_limit': org.test_violation_limit,
        })
