from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tests.models import Question, Test

from .grading import grade_attempt
from .models import Answer, Attempt
from .serializers import (
    AnswersBulkSerializer,
    AttemptDetailSerializer,
    AttemptListSerializer,
    AttemptResultSerializer,
    AttemptStartSerializer,
)


class StartAttemptView(APIView):
    """POST /tests/:test_id/attempts → create new attempt"""

    permission_classes = [IsAuthenticated]

    def post(self, request, test_id):
        test = get_object_or_404(Test, pk=test_id, is_published=True)
        attempt = Attempt.objects.create(user=request.user, test=test)
        return Response(AttemptStartSerializer(attempt).data, status=status.HTTP_201_CREATED)


class AttemptViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Attempt.objects.filter(user=self.request.user).select_related('test')

    def get_serializer_class(self):
        if self.action == 'list':
            return AttemptListSerializer
        return AttemptDetailSerializer

    @action(detail=True, methods=['patch'], url_path='answers')
    def save_answers(self, request, pk=None):
        attempt = self.get_object()
        if attempt.status != 'in_progress':
            return Response({'detail': 'Urinish yopilgan'},
                            status=status.HTTP_400_BAD_REQUEST)
        serializer = AnswersBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        saved = 0
        for item in serializer.validated_data['answers']:
            try:
                question = Question.objects.get(pk=item['question_id'],
                                                passage__test=attempt.test)
            except Question.DoesNotExist:
                continue
            Answer.objects.update_or_create(
                attempt=attempt, question=question,
                defaults={'user_answer': item['answer']},
            )
            saved += 1
        return Response({'saved': saved})

    @action(detail=True, methods=['patch'], url_path='essay')
    def save_essay(self, request, pk=None):
        """For writing module: auto-save essay draft."""
        attempt = self.get_object()
        if attempt.status != 'in_progress':
            return Response({'detail': 'Urinish yopilgan'},
                            status=status.HTTP_400_BAD_REQUEST)
        essay = request.data.get('essay_text', '')
        attempt.essay_text = essay
        attempt.word_count = len([w for w in essay.split() if w])
        attempt.save(update_fields=['essay_text', 'word_count'])
        return Response({'word_count': attempt.word_count})

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        attempt = self.get_object()
        if attempt.status == 'graded' or attempt.status == 'submitted':
            return Response(AttemptResultSerializer(attempt).data)

        module = attempt.test.module
        if module in ('reading', 'listening'):
            grade_attempt(attempt)
        else:
            # Writing/Speaking: accept essay, do not auto-grade (AI feedback Phase 2)
            essay = request.data.get('essay_text')
            if essay is not None:
                attempt.essay_text = essay
                attempt.word_count = len([w for w in essay.split() if w])
            attempt.status = 'submitted'
            attempt.submitted_at = timezone.now()
            attempt.save()
        return Response(AttemptResultSerializer(attempt).data)

    @action(detail=True, methods=['get'])
    def result(self, request, pk=None):
        attempt = self.get_object()
        if attempt.status not in ('graded', 'submitted'):
            return Response({'detail': 'Natija hali hisoblanmagan'},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response(AttemptResultSerializer(attempt).data)
