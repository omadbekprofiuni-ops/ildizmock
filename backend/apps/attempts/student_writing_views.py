from django.db.models import Avg, Max
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Attempt, WritingSubmission


class _MyWritingSerializer(serializers.ModelSerializer):
    test_name = serializers.CharField(source='attempt.test.name', read_only=True)
    submitted_at = serializers.DateTimeField(read_only=True)
    teacher_name = serializers.SerializerMethodField()

    class Meta:
        model = WritingSubmission
        fields = [
            'id', 'attempt', 'test_name', 'essay_text', 'word_count',
            'status', 'teacher_band', 'teacher_feedback',
            'submitted_at', 'graded_at', 'teacher_name',
        ]

    def get_teacher_name(self, obj):
        if not obj.graded_by:
            return None
        u = obj.graded_by
        return f'{u.first_name} {u.last_name}'.strip() or u.phone


class SubmitWritingView(APIView):
    """POST /api/v1/attempts/:id/submit-writing/ — student submits essay."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        attempt = get_object_or_404(Attempt, pk=pk, user=request.user)
        if attempt.status not in ('in_progress',) and not hasattr(attempt, 'writing_submission'):
            return Response({'detail': 'Urinish allaqachon yopilgan.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if attempt.test.module not in ('writing', 'speaking'):
            return Response({'detail': 'Bu test writing/speaking emas.'},
                            status=status.HTTP_400_BAD_REQUEST)

        essay = (request.data.get('essay_text') or '').strip()
        if not essay:
            return Response({'detail': 'Essay matni bo‘sh.'},
                            status=status.HTTP_400_BAD_REQUEST)

        word_count = len([w for w in essay.split() if w])

        sub, _created = WritingSubmission.objects.update_or_create(
            attempt=attempt,
            defaults={
                'essay_text': essay,
                'word_count': word_count,
                'status': 'pending',
            },
        )
        # Sync attempt fields
        attempt.essay_text = essay
        attempt.word_count = word_count
        attempt.status = 'submitted'
        attempt.submitted_at = timezone.now()
        attempt.save()

        # Simple log notification (no email/Telegram yet)
        teacher = attempt.user.teacher
        if teacher:
            print(f'[notify] New writing for teacher {teacher.phone}: '
                  f'student={attempt.user.phone} attempt={attempt.id}')
        else:
            print(f'[notify] Student {attempt.user.phone} has no teacher assigned.')

        return Response(_MyWritingSerializer(sub).data, status=status.HTTP_201_CREATED)


class MyWritingsView(APIView):
    """GET /api/v1/me/writings/ — current student's writing submissions."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            WritingSubmission.objects
            .filter(attempt__user=request.user)
            .select_related('attempt__test', 'graded_by')
            .order_by('-submitted_at')
        )
        return Response(_MyWritingSerializer(qs, many=True).data)


class MyDashboardView(APIView):
    """GET /api/v1/me/dashboard/ — student personal cabinet summary."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        attempts = Attempt.objects.filter(user=user).select_related('test')
        graded = attempts.filter(status='graded')

        by_module = {}
        for module in ('reading', 'listening', 'writing', 'speaking'):
            mg = graded.filter(test__module=module)
            best = mg.aggregate(b=Max('band_score'))['b']
            avg = mg.aggregate(a=Avg('band_score'))['a']
            by_module[module] = {
                'attempts': attempts.filter(test__module=module).count(),
                'graded': mg.count(),
                'best_band': float(best) if best is not None else None,
                'avg_band': float(avg) if avg is not None else None,
            }

        recent = list(
            attempts.order_by('-started_at')[:5].values(
                'id', 'status', 'started_at', 'submitted_at',
                'band_score', 'raw_score', 'total_questions',
                'test__name', 'test__module',
            )
        )
        recent_attempts = [
            {
                'id': str(a['id']),
                'test_name': a['test__name'],
                'module': a['test__module'],
                'status': a['status'],
                'started_at': a['started_at'].isoformat(),
                'submitted_at': a['submitted_at'].isoformat() if a['submitted_at'] else None,
                'band_score': str(a['band_score']) if a['band_score'] is not None else None,
                'raw_score': a['raw_score'],
                'total_questions': a['total_questions'],
            }
            for a in recent
        ]

        best_overall = graded.aggregate(b=Max('band_score'))['b']
        avg_overall = graded.aggregate(a=Avg('band_score'))['a']

        teacher = user.teacher
        teacher_info = None
        if teacher:
            teacher_info = {
                'name': f'{teacher.first_name} {teacher.last_name}'.strip() or teacher.phone,
                'phone': teacher.phone,
            }

        writing_qs = WritingSubmission.objects.filter(attempt__user=user)
        return Response({
            'attempts_total': attempts.count(),
            'attempts_graded': graded.count(),
            'best_band': float(best_overall) if best_overall is not None else None,
            'avg_band': float(avg_overall) if avg_overall is not None else None,
            'by_module': by_module,
            'recent_attempts': recent_attempts,
            'writing_pending': writing_qs.filter(status='pending').count(),
            'writing_graded': writing_qs.filter(status='graded').count(),
            'teacher': teacher_info,
        })
