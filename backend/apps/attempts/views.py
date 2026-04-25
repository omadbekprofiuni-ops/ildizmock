from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
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


def _can_access_attempt(request, attempt):
    """Anonymous attempt (user is None) → anyone with the UUID; otherwise the owner."""
    if attempt.user_id is None:
        return True
    return request.user.is_authenticated and attempt.user_id == request.user.id


class StartAttemptView(APIView):
    """POST /tests/:test_id/attempts → create new attempt.

    Public: guest can start reading/listening attempts (user=None).
    Writing requires authentication (essay routes to a teacher).
    """

    permission_classes = [AllowAny]

    def post(self, request, test_id):
        test = get_object_or_404(Test, pk=test_id, is_published=True)
        if test.module in ('writing', 'speaking') and not request.user.is_authenticated:
            return Response(
                {'detail': 'Bu test uchun ro‘yxatdan o‘tish kerak.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        owner = request.user if request.user.is_authenticated else None
        attempt = Attempt.objects.create(user=owner, test=test)
        return Response(AttemptStartSerializer(attempt).data, status=status.HTTP_201_CREATED)


class AttemptViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """List requires auth (own attempts). Retrieve/save/submit/result allow
    anonymous attempts (user=null) so guests can complete a test by UUID."""

    def get_permissions(self):
        if self.action == 'list':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_queryset(self):
        if self.action == 'list':
            if self.request.user.is_authenticated:
                return Attempt.objects.filter(user=self.request.user).select_related('test')
            return Attempt.objects.none()
        return Attempt.objects.all().select_related('test')

    def retrieve(self, request, *args, **kwargs):
        attempt = self.get_object()
        if not _can_access_attempt(request, attempt):
            return Response({'detail': 'Bu urinishga kirish huquqi yo‘q.'},
                            status=status.HTTP_403_FORBIDDEN)
        return Response(self.get_serializer(attempt).data)

    def get_serializer_class(self):
        if self.action == 'list':
            return AttemptListSerializer
        return AttemptDetailSerializer

    @action(detail=True, methods=['patch'], url_path='answers')
    def save_answers(self, request, pk=None):
        attempt = self.get_object()
        if not _can_access_attempt(request, attempt):
            return Response({'detail': 'Kirish huquqi yo‘q.'},
                            status=status.HTTP_403_FORBIDDEN)
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
        if not _can_access_attempt(request, attempt):
            return Response({'detail': 'Kirish huquqi yo‘q.'},
                            status=status.HTTP_403_FORBIDDEN)
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
        if not _can_access_attempt(request, attempt):
            return Response({'detail': 'Kirish huquqi yo‘q.'},
                            status=status.HTTP_403_FORBIDDEN)
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
        if not _can_access_attempt(request, attempt):
            return Response({'detail': 'Kirish huquqi yo‘q.'},
                            status=status.HTTP_403_FORBIDDEN)
        if attempt.status not in ('graded', 'submitted'):
            return Response({'detail': 'Natija hali hisoblanmagan'},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response(AttemptResultSerializer(attempt).data)
