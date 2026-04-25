from decimal import Decimal, InvalidOperation

from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, Max
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsTeacher

from .models import WritingSubmission

User = get_user_model()


class IsTeacherOfStudent(permissions.BasePermission):
    """Object-level — submission's student must have request.user as their teacher."""

    message = 'Bu talaba sizning shogirdingiz emas.'

    def has_object_permission(self, request, view, obj):
        student = obj.attempt.user
        # Admins always allowed
        if request.user.role in ('admin', 'super_admin'):
            return True
        return student.teacher_id == request.user.id


# ============= Serializers =============

class _SubmissionListSerializer(serializers.ModelSerializer):
    test_name = serializers.CharField(source='attempt.test.name', read_only=True)
    student_name = serializers.SerializerMethodField()
    student_phone = serializers.CharField(source='attempt.user.phone', read_only=True)

    class Meta:
        model = WritingSubmission
        fields = [
            'id', 'test_name', 'student_name', 'student_phone',
            'status', 'word_count', 'teacher_band',
            'submitted_at', 'graded_at',
        ]

    def get_student_name(self, obj):
        u = obj.attempt.user
        return f'{u.first_name} {u.last_name}'.strip() or u.phone


class _SubmissionDetailSerializer(_SubmissionListSerializer):
    essay_text = serializers.CharField(read_only=True)
    teacher_feedback = serializers.CharField(read_only=True)
    task_prompt = serializers.SerializerMethodField()
    min_words = serializers.SerializerMethodField()
    duration_minutes = serializers.IntegerField(
        source='attempt.test.duration_minutes', read_only=True,
    )

    class Meta(_SubmissionListSerializer.Meta):
        fields = _SubmissionListSerializer.Meta.fields + [
            'essay_text', 'teacher_feedback', 'task_prompt',
            'min_words', 'duration_minutes',
        ]

    def get_task_prompt(self, obj):
        first = obj.attempt.test.passages.first()
        return first.content if first else ''

    def get_min_words(self, obj):
        first = obj.attempt.test.passages.first()
        return first.min_words if first else None


# ============= Views =============

class TeacherQueueView(APIView):
    """GET /api/v1/teacher/queue/ — pending submissions of my students."""

    permission_classes = [IsTeacher]

    def get(self, request):
        qs = (
            WritingSubmission.objects
            .filter(status='pending', attempt__user__teacher=request.user)
            .select_related('attempt__user', 'attempt__test')
            .order_by('submitted_at')
        )
        return Response(_SubmissionListSerializer(qs, many=True).data)


class TeacherStudentsView(APIView):
    """GET /api/v1/teacher/students/ — my assigned students."""

    permission_classes = [IsTeacher]

    def get(self, request):
        students = (
            User.objects.filter(teacher=request.user, role='student')
            .annotate(
                attempts_count=Count('attempts'),
                last_attempt=Max('attempts__started_at'),
                avg_band=Avg('attempts__band_score'),
            )
            .order_by('first_name', 'last_name')
        )
        data = [{
            'id': s.id,
            'phone': s.phone,
            'name': f'{s.first_name} {s.last_name}'.strip() or s.phone,
            'attempts_count': s.attempts_count,
            'last_attempt': s.last_attempt.isoformat() if s.last_attempt else None,
            'avg_band': float(s.avg_band) if s.avg_band is not None else None,
        } for s in students]
        return Response(data)


class TeacherSubmissionViewSet(viewsets.GenericViewSet):
    """GET /api/v1/teacher/submissions/:id/ + POST .../grade/."""

    permission_classes = [IsTeacher, IsTeacherOfStudent]

    def get_queryset(self):
        return (
            WritingSubmission.objects
            .select_related('attempt__user', 'attempt__test', 'graded_by')
        )

    def retrieve(self, request, pk=None):
        sub = get_object_or_404(self.get_queryset(), pk=pk)
        self.check_object_permissions(request, sub)
        return Response(_SubmissionDetailSerializer(sub).data)

    @action(detail=True, methods=['post'])
    def grade(self, request, pk=None):
        sub = get_object_or_404(self.get_queryset(), pk=pk)
        self.check_object_permissions(request, sub)

        band_raw = request.data.get('band')
        feedback = request.data.get('feedback', '')

        try:
            band = Decimal(str(band_raw))
        except (TypeError, ValueError, InvalidOperation):
            return Response(
                {'detail': 'band 0.0–9.0 oralig‘ida son bo‘lsin.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if band < Decimal('0') or band > Decimal('9'):
            return Response(
                {'detail': 'band 0.0–9.0 oralig‘ida bo‘lsin.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sub.teacher_band = band
        sub.teacher_feedback = feedback or ''
        sub.graded_by = request.user
        sub.graded_at = timezone.now()
        sub.status = 'graded'
        sub.save()

        # Sync band to attempt for ResultPage
        att = sub.attempt
        att.band_score = band
        att.teacher_feedback = feedback or ''
        att.graded_by = request.user
        att.graded_at = timezone.now()
        att.status = 'graded'
        att.save()

        return Response(_SubmissionDetailSerializer(sub).data)
