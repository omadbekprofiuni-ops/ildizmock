from django.db.models import Avg, Max
from rest_framework import mixins, permissions, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Test
from .serializers import TestDetailSerializer, TestListSerializer


class TestViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Public read access — guests can browse tests."""

    permission_classes = [AllowAny]
    queryset = Test.objects.filter(is_published=True, is_deleted=False)

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return TestDetailSerializer
        return TestListSerializer

    def get_queryset(self):
        qs = super().get_queryset().filter(organization__isnull=True)
        module = self.request.query_params.get('module')
        difficulty = self.request.query_params.get('difficulty')
        practice = self.request.query_params.get('practice')
        if module:
            qs = qs.filter(module=module)
        if difficulty:
            qs = qs.filter(difficulty=difficulty)
        if practice in ('1', 'true', 'yes'):
            qs = qs.filter(is_practice_enabled=True)
        return qs


class TestCountsView(APIView):
    """Public counts of published tests by module — used on HomePage cards."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            module: Test.objects.filter(
                is_published=True, is_deleted=False,
                module=module, organization__isnull=True,
            ).count()
            for module, _ in Test.MODULE_CHOICES
        })


class PracticeStatsView(APIView):
    """ETAP 12 — Practice home uchun foydalanuvchi statistikasi.

    Har modul uchun: mavjud testlar soni + foydalanuvchining urinishlari soni
    + eng yaxshi band score + so'nggi 5 ta urinish.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.attempts.models import Attempt

        out = {}
        modules = ['listening', 'reading', 'writing']
        user = request.user

        for module in modules:
            tests_qs = Test.objects.filter(
                is_published=True,
                module=module,
                is_practice_enabled=True,
            )
            attempts_qs = Attempt.objects.filter(
                user=user, test__module=module,
                status__in=['submitted', 'graded'],
            )
            stats = attempts_qs.aggregate(
                best=Max('band_score'),
                avg=Avg('band_score'),
            )
            out[module] = {
                'tests_count': tests_qs.count(),
                'attempts_count': attempts_qs.count(),
                'best_band': float(stats['best']) if stats['best'] else None,
                'avg_band': (
                    round(float(stats['avg']), 1) if stats['avg'] else None
                ),
            }

        # Recent 5 attempts across all modules
        recent = (
            Attempt.objects
            .filter(user=user, status__in=['submitted', 'graded'])
            .select_related('test')
            .order_by('-submitted_at')[:5]
        )
        out['recent'] = [
            {
                'id': str(a.id),
                'test_id': str(a.test_id),
                'test_name': a.test.name,
                'module': a.test.module,
                'band_score': float(a.band_score) if a.band_score else None,
                'submitted_at': a.submitted_at.isoformat() if a.submitted_at else None,
            }
            for a in recent
        ]
        return Response(out)
