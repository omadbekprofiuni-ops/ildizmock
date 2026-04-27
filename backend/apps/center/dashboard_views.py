"""ETAP 9 — Markaz admini uchun zamonaviy dashboard + sozlamalar.

`/dashboard/` markaz uchun statistik kartalar, haftalik mock aktivlik
chart va pending tasklar (writing/speaking baholash) ma'lumotlarini
qaytaradi. `/settings/` esa org admin tomonidan brending va aloqa
ma'lumotlarini tahrirlash uchun.
"""

from datetime import timedelta

from django.db.models import Avg, Count
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.mock.models import MockParticipant, MockSession
from apps.organizations.permissions import IsCenterAdmin
from apps.tests.models import Test

from .views import _OrgScopedViewSetMixin


class _BaseCenterAdminView(_OrgScopedViewSetMixin, APIView):
    permission_classes = [IsAuthenticated, IsCenterAdmin]

    def initial(self, request, *args, **kwargs):
        self.kwargs = kwargs
        super().initial(request, *args, **kwargs)


SCORE_BUCKETS = [
    (0.0, 4.5, '< 4.5'),
    (4.5, 5.5, '4.5 – 5.5'),
    (5.5, 6.5, '5.5 – 6.5'),
    (6.5, 7.5, '6.5 – 7.5'),
    (7.5, 9.5, '7.5+'),
]


class CenterDashboardView(_BaseCenterAdminView):
    """GET /api/v1/center/<slug>/dashboard/ — markaz admin dashboard."""

    def get(self, request, **kwargs):
        org = self.get_organization()

        sessions = MockSession.objects.filter(organization=org)
        participants = MockParticipant.objects.filter(session__organization=org)
        completed = participants.filter(overall_band_score__isnull=False)

        students_count = org.users.filter(role='student').count()
        teachers_count = org.users.filter(role='teacher').count()

        # Tests: own + cloned (organization=org)
        tests_count = Test.objects.filter(organization=org).count()

        avg_overall = completed.aggregate(a=Avg('overall_band_score'))['a']

        today = timezone.now().date()
        seven_days_ago = today - timedelta(days=6)

        recent_sessions_count = sessions.filter(date__gte=seven_days_ago).count()

        # Last 7 days bar chart
        weekly = []
        for offset in range(6, -1, -1):
            day = today - timedelta(days=offset)
            count = sessions.filter(date=day).count()
            participants_count = participants.filter(session__date=day).count()
            weekly.append({
                'date': day.isoformat(),
                'label': day.strftime('%a'),
                'sessions': count,
                'participants': participants_count,
            })

        # Score distribution
        score_distribution = []
        for low, high, label in SCORE_BUCKETS:
            score_distribution.append({
                'label': label,
                'count': completed.filter(
                    overall_band_score__gte=low,
                    overall_band_score__lt=high,
                ).count(),
            })

        # Recent sessions
        recent_sessions = list(
            sessions.order_by('-date')[:5]
            .annotate(participants_total=Count('participants'))
            .values('id', 'name', 'date', 'status', 'participants_total')
        )
        for s in recent_sessions:
            s['date'] = s['date'].isoformat()

        # Pending tasks (graders' queues)
        pending_writing = participants.filter(writing_status='pending').count()
        pending_speaking = participants.filter(speaking_status='pending').count()

        return Response({
            'organization': {
                'id': org.id,
                'name': org.name,
                'slug': org.slug,
                'logo': org.logo.url if org.logo else None,
                'primary_color': org.primary_color,
            },
            'totals': {
                'tests': tests_count,
                'sessions': sessions.count(),
                'completed_sessions': sessions.filter(status='finished').count(),
                'students': students_count,
                'teachers': teachers_count,
                'participants': participants.count(),
                'completed_tests': completed.count(),
                'avg_overall': round(float(avg_overall), 2) if avg_overall else None,
                'recent_sessions_7d': recent_sessions_count,
            },
            'weekly_activity': weekly,
            'score_distribution': score_distribution,
            'recent_sessions': recent_sessions,
            'pending': {
                'writing': pending_writing,
                'speaking': pending_speaking,
            },
        })


class _SettingsSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=False)
    primary_color = serializers.CharField(max_length=7, required=False)
    logo = serializers.FileField(required=False, allow_null=True)
    address = serializers.CharField(max_length=300, required=False, allow_blank=True)
    contact_phone = serializers.CharField(
        max_length=20, required=False, allow_blank=True,
    )
    contact_email = serializers.EmailField(required=False, allow_blank=True)


class CenterSettingsView(_BaseCenterAdminView):
    """GET/PATCH /api/v1/center/<slug>/settings/ — markaz brendi va aloqasi."""

    parser_classes = [MultiPartParser, FormParser]

    def _serialize(self, org) -> dict:
        return {
            'name': org.name,
            'slug': org.slug,
            'primary_color': org.primary_color,
            'logo': org.logo.url if org.logo else None,
            'address': org.address,
            'contact_phone': org.contact_phone,
            'contact_email': org.contact_email,
            'plan_status': org.status,
            'plan_expires_at': (
                org.plan_expires_at.isoformat() if org.plan_expires_at else None
            ),
        }

    def get(self, request, **kwargs):
        org = self.get_organization()
        return Response(self._serialize(org))

    def patch(self, request, **kwargs):
        org = self.get_organization()

        serializer = _SettingsSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        for field in ('name', 'primary_color', 'address',
                      'contact_phone', 'contact_email'):
            if field in data:
                setattr(org, field, data[field])

        if 'logo' in data:
            logo = data['logo']
            if logo is None:
                org.logo.delete(save=False)
                org.logo = None
            else:
                org.logo = logo

        org.save()
        return Response(self._serialize(org))
