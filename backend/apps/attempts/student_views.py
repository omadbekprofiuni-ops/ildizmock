"""ETAP 25 — `/student/...` namespaced views.

Thin wrappers over the existing `AttemptViewSet` actions so the URLs match
the spec without forking the underlying behaviour.
"""
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tests.models import Question, Test

from .grading import grade_attempt
from .models import Answer, Attempt
from .serializers import AttemptDetailSerializer, AttemptResultSerializer
from .views import _can_access_attempt


class StudentTestListView(APIView):
    """GET /student/tests/ → published tests visible to the student."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .serializers import AttemptListSerializer  # noqa: F401  (kept for parity)
        from apps.tests.serializers import TestListSerializer

        qs = Test.objects.filter(is_published=True, is_deleted=False)
        user = request.user
        if getattr(user, 'organization_id', None):
            qs = qs.filter(
                organization__isnull=True
            ) | qs.filter(organization=user.organization)
        else:
            qs = qs.filter(organization__isnull=True)
        module = request.query_params.get('module')
        if module:
            qs = qs.filter(module=module)
        return Response(TestListSerializer(qs, many=True, context={'request': request}).data)


class StudentTestDetailView(APIView):
    """GET /student/tests/<id>/ — start page details."""

    permission_classes = [AllowAny]

    def get(self, request, test_id):
        from apps.tests.serializers import TestDetailSerializer
        test = get_object_or_404(
            Test, pk=test_id, is_published=True, is_deleted=False,
        )
        return Response(TestDetailSerializer(test, context={'request': request}).data)


class StudentStartTestView(APIView):
    """POST /student/tests/<id>/start/ → create + return attempt."""

    permission_classes = [AllowAny]

    def post(self, request, test_id):
        test = get_object_or_404(
            Test, pk=test_id, is_published=True, is_deleted=False,
        )
        if test.module in ('writing', 'speaking') and not request.user.is_authenticated:
            return Response(
                {'detail': 'Registration is required for this test.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        import uuid as _uuid
        owner = request.user if request.user.is_authenticated else None
        guest_token = None if owner else _uuid.uuid4()
        attempt = Attempt.objects.create(
            user=owner, test=test, guest_token=guest_token,
        )
        data = AttemptDetailSerializer(attempt, context={'request': request}).data
        data['attempt_id'] = str(attempt.id)
        if guest_token:
            data['guest_token'] = str(guest_token)
        return Response(data, status=status.HTTP_201_CREATED)


class StudentAttemptDetailView(APIView):
    """GET /student/attempts/<id>/ — full attempt for the player."""

    permission_classes = [AllowAny]

    def get(self, request, attempt_id):
        attempt = get_object_or_404(Attempt, pk=attempt_id)
        if not _can_access_attempt(request, attempt):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return Response(
            AttemptDetailSerializer(attempt, context={'request': request}).data,
        )


class StudentSaveAnswerView(APIView):
    """POST /student/attempts/<id>/answer/ — save a single answer.

    Body: {"question_id": 123, "answer": <any>}
    """

    permission_classes = [AllowAny]

    def post(self, request, attempt_id):
        attempt = get_object_or_404(Attempt, pk=attempt_id)
        if not _can_access_attempt(request, attempt):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        if attempt.status != 'in_progress':
            return Response(
                {'detail': 'Attempt is not in progress.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        qid = request.data.get('question_id')
        answer = request.data.get('answer')
        if qid is None:
            return Response(
                {'detail': 'question_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        question = Question.objects.filter(
            pk=qid,
        ).filter(
            # Question must belong to this test (passage or listening_part).
        ).first()
        if not question or (
            question.passage_id and question.passage.test_id != attempt.test_id
        ) or (
            question.listening_part_id
            and question.listening_part.test_id != attempt.test_id
        ):
            return Response(
                {'detail': 'Question does not belong to this test.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        Answer.objects.update_or_create(
            attempt=attempt, question=question,
            defaults={'user_answer': answer},
        )
        return Response({'saved': True})


class StudentSubmitView(APIView):
    """POST /student/attempts/<id>/submit/ — finalise + auto-grade."""

    permission_classes = [AllowAny]

    def post(self, request, attempt_id):
        attempt = get_object_or_404(Attempt, pk=attempt_id)
        if not _can_access_attempt(request, attempt):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        if attempt.status in ('graded', 'submitted'):
            return Response(
                AttemptResultSerializer(attempt, context={'request': request}).data,
            )
        module = attempt.test.module
        if module in ('reading', 'listening'):
            grade_attempt(attempt)
        else:
            essay = request.data.get('essay_text')
            if essay is not None:
                attempt.essay_text = essay
                attempt.word_count = len([w for w in essay.split() if w])
            attempt.status = 'submitted'
            attempt.submitted_at = timezone.now()
            attempt.save()
        return Response(
            AttemptResultSerializer(attempt, context={'request': request}).data,
        )


class StudentUploadRecordingView(APIView):
    """POST /student/attempts/<id>/upload-recording/ — speaking audio."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, attempt_id):
        attempt = get_object_or_404(Attempt, pk=attempt_id)
        if not _can_access_attempt(request, attempt):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        question_key = request.data.get('question_id')
        recording = request.FILES.get('audio')
        if not (question_key and recording):
            return Response(
                {'detail': 'question_id and audio are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from django.core.files.storage import default_storage
        # Normalise filename — keep the speaking sub-index suffix if sent.
        safe = str(question_key).replace('/', '_').replace('..', '_')
        path = f'speaking/{attempt.id}/{safe}.webm'
        saved = default_storage.save(path, recording)
        url = default_storage.url(saved)
        recordings = dict(attempt.speaking_recordings or {})
        recordings[str(question_key)] = url
        attempt.speaking_recordings = recordings
        attempt.save(update_fields=['speaking_recordings'])
        return Response({'saved': True, 'url': url})
