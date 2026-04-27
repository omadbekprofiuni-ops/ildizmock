"""ETAP 6 — Practice mode (mustaqil mashq) endpoint'lari.

Practice rejimida talaba o'zi xohlagan vaqtda mock-rejimsiz, sertifikat
bermasdan testlarni ishlaydi. Test'da `is_practice_enabled=True` bo'lsa,
talaba practice ro'yxatida ko'radi va attempt yaratib darhol natija oladi.
"""

from django.db.models import Avg, Count, Max
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Attempt


class PracticeHistoryView(APIView):
    """GET /api/v1/me/practice/history/ — practice attempt'lar + statistika."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        attempts = (
            Attempt.objects
            .filter(user=request.user, test__is_practice_enabled=True)
            .select_related('test')
            .order_by('-started_at')
        )

        rows = []
        for a in attempts[:200]:
            rows.append({
                'id': str(a.id),
                'test_id': str(a.test.id),
                'test_name': a.test.name,
                'module': a.test.module,
                'difficulty': a.test.difficulty,
                'status': a.status,
                'started_at': a.started_at.isoformat(),
                'submitted_at': a.submitted_at.isoformat() if a.submitted_at else None,
                'raw_score': a.raw_score,
                'total_questions': a.total_questions,
                'band_score': str(a.band_score) if a.band_score is not None else None,
                'time_spent_seconds': a.time_spent_seconds,
            })

        graded = attempts.filter(status__in=('graded', 'submitted'))

        by_module = {}
        for module in ('listening', 'reading', 'writing'):
            mg = graded.filter(test__module=module)
            best = mg.aggregate(b=Max('band_score'))['b']
            avg = mg.aggregate(a=Avg('band_score'))['a']
            by_module[module] = {
                'attempts': attempts.filter(test__module=module).count(),
                'completed': mg.count(),
                'best_band': float(best) if best is not None else None,
                'avg_band': round(float(avg), 2) if avg is not None else None,
            }

        return Response({
            'results': rows,
            'stats': {
                'total': attempts.count(),
                'completed': graded.count(),
                'by_module': by_module,
            },
        })
