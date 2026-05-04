from django.contrib.auth import get_user_model
from django.db.models import Avg
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin
from apps.attempts.models import Attempt

from .admin_serializers import (
    AdminPassageSerializer,
    AdminQuestionSerializer,
    AdminTestSerializer,
)
from .models import Passage, Question, Test

User = get_user_model()


class AdminDashboardView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        graded = Attempt.objects.filter(status='graded')
        avg_band = graded.aggregate(avg=Avg('band_score'))['avg']

        recent = (
            Attempt.objects.select_related('user', 'test')
            .filter(started_at__isnull=False)
            .order_by('-started_at')[:10]
        )
        recent_attempts = [
            {
                'id': str(a.id),
                'user_username': a.user.username,
                'user_name': f'{a.user.first_name} {a.user.last_name}'.strip() or a.user.username,
                'test_name': a.test.name,
                'module': a.test.module,
                'status': a.status,
                'band_score': str(a.band_score) if a.band_score is not None else None,
                'raw_score': a.raw_score,
                'total_questions': a.total_questions,
                'started_at': a.started_at.isoformat() if a.started_at else None,
            }
            for a in recent
        ]
        return Response({
            'students': User.objects.filter(role='student').count(),
            'users': User.objects.count(),
            'tests_total': Test.objects.count(),
            'tests_published': Test.objects.filter(is_published=True).count(),
            'attempts_total': Attempt.objects.count(),
            'attempts_graded': graded.count(),
            'avg_band': float(avg_band) if avg_band is not None else None,
            'by_module': {
                module: Test.objects.filter(module=module).count()
                for module, _ in Test.MODULE_CHOICES
            },
            'recent_attempts': recent_attempts,
        })


class AdminTestViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = AdminTestSerializer
    queryset = (
        Test.objects.all()
        .prefetch_related('passages__questions')
        .order_by('-created_at')
    )

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        test = self.get_object()
        test.is_published = not test.is_published
        test.save(update_fields=['is_published'])
        return Response(self.get_serializer(test).data)


class AdminPassageViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = AdminPassageSerializer
    queryset = Passage.objects.all().prefetch_related('questions')


class AdminQuestionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = AdminQuestionSerializer
    queryset = Question.objects.all()
