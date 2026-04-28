"""Teacher (ustoz) uchun mock baholash endpointlari.

URL prefiks: `/api/v1/teacher/mock/`
Permission: `IsTeacherInOrg` (teacher, org_admin yoki superadmin).
"""

from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.organizations.permissions import IsTeacherInOrg

from .models import MockParticipant


WRITING_FIELDS = [
    'writing_task1_task_achievement',
    'writing_task1_coherence',
    'writing_task1_lexical',
    'writing_task1_grammar',
    'writing_task2_task_response',
    'writing_task2_coherence',
    'writing_task2_lexical',
    'writing_task2_grammar',
]

SPEAKING_FIELDS = [
    'speaking_fluency',
    'speaking_lexical',
    'speaking_grammar',
    'speaking_pronunciation',
]


def _scope(user):
    """Teacher faqat o'z markazidagi natijalarni ko'radi."""
    if user.role == 'superadmin':
        return MockParticipant.objects.select_related('session').all()
    return MockParticipant.objects.select_related('session').filter(
        session__organization=user.organization,
    )


def _participant_payload(p: MockParticipant) -> dict:
    s = p.session
    return {
        'id': p.id,
        'full_name': p.full_name,
        'session': {
            'id': s.id,
            'name': s.name,
            'date': s.date.isoformat(),
            'status': s.status,
        },
        'listening_score': str(p.listening_score) if p.listening_score is not None else None,
        'reading_score': str(p.reading_score) if p.reading_score is not None else None,
        'writing_score': str(p.writing_score) if p.writing_score is not None else None,
        'speaking_score': str(p.speaking_score) if p.speaking_score is not None else None,
        'overall_band_score': str(p.overall_band_score) if p.overall_band_score is not None else None,
        'writing_status': p.writing_status,
        'speaking_status': p.speaking_status,
        'writing_submitted_at': p.writing_submitted_at,
        'writing_task1_text': p.writing_task1_text,
        'writing_task2_text': p.writing_task2_text,
        'writing_feedback': p.writing_feedback,
        'speaking_feedback': p.speaking_feedback,
        'criteria': {
            f: str(getattr(p, f)) if getattr(p, f) is not None else None
            for f in WRITING_FIELDS
        },
        'speaking_criteria': {
            f: str(getattr(p, f)) if getattr(p, f) is not None else None
            for f in SPEAKING_FIELDS
        },
    }


class TeacherMockViewSet(viewsets.ViewSet):
    """`/api/v1/teacher/mock/` — Writing/Speaking baholash."""

    permission_classes = [permissions.IsAuthenticated, IsTeacherInOrg]

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        scope = _scope(request.user)
        writing_pending = scope.filter(
            writing_status='pending',
        ).exclude(writing_task1_text='', writing_task2_text='').count()
        speaking_pending = scope.filter(speaking_status='pending').count()

        recent_window = timezone.now() - timedelta(days=7)
        my_writings_recent = scope.filter(
            writing_graded_by=request.user,
            writing_graded_at__gte=recent_window,
        ).count()
        my_speakings_recent = scope.filter(
            speaking_graded_by=request.user,
            speaking_graded_at__gte=recent_window,
        ).count()

        return Response({
            'writing_pending': writing_pending,
            'speaking_pending': speaking_pending,
            'my_writings_last_7d': my_writings_recent,
            'my_speakings_last_7d': my_speakings_recent,
        })

    @action(detail=False, methods=['get'], url_path='writing/queue')
    def writing_queue(self, request):
        qs = _scope(request.user).filter(
            writing_status='pending',
        ).exclude(writing_task1_text='', writing_task2_text='').order_by(
            'session__date', 'full_name',
        )
        return Response([
            {
                'id': p.id,
                'full_name': p.full_name,
                'session': p.session.name,
                'session_date': p.session.date.isoformat(),
                'listening_score': str(p.listening_score) if p.listening_score is not None else None,
                'reading_score': str(p.reading_score) if p.reading_score is not None else None,
                'speaking_score': str(p.speaking_score) if p.speaking_score is not None else None,
                'submitted_at': p.writing_submitted_at,
            }
            for p in qs
        ])

    @action(detail=False, methods=['get'], url_path=r'writing/(?P<participant_id>\d+)')
    def writing_detail(self, request, participant_id=None):
        p = get_object_or_404(_scope(request.user), pk=participant_id)
        s = p.session
        # Writing test prompt'larini ham yuboramiz
        tasks = []
        if s.writing_test:
            for t in s.writing_test.writing_tasks.all().order_by('task_number'):
                tasks.append({
                    'task_number': t.task_number,
                    'prompt': t.prompt,
                    'min_words': t.min_words,
                    'chart_image_url': (
                        request.build_absolute_uri(t.chart_image.url)
                        if t.chart_image else None
                    ),
                })
        data = _participant_payload(p)
        data['writing_tasks'] = tasks
        return Response(data)

    @action(
        detail=False, methods=['post'], url_path=r'writing/(?P<participant_id>\d+)/grade',
    )
    def writing_grade(self, request, participant_id=None):
        p = get_object_or_404(_scope(request.user), pk=participant_id)

        # Har 8 ta criteria 0–9 oralig'ida bo'lishi shart
        for f in WRITING_FIELDS:
            v = request.data.get(f)
            if v is None or v == '':
                return Response({'detail': f'{f} qiymati majburiy.'},
                                status=status.HTTP_400_BAD_REQUEST)
            try:
                num = Decimal(str(v))
            except (InvalidOperation, TypeError):
                return Response({'detail': f'{f} raqam bo‘lishi kerak.'},
                                status=status.HTTP_400_BAD_REQUEST)
            if num < 0 or num > 9:
                return Response({'detail': f'{f} 0–9 oralig‘ida.'},
                                status=status.HTTP_400_BAD_REQUEST)
            setattr(p, f, num)

        p.writing_feedback = request.data.get('feedback', '') or ''
        p.calculate_writing_score()
        p.writing_status = 'graded'
        p.writing_graded_by = request.user
        p.writing_graded_at = timezone.now()
        p.calculate_overall_band_score()
        p.save()

        # Keyingi navbatdagini ham qaytaramiz (auto-advance UX)
        next_p = _scope(request.user).filter(
            writing_status='pending', id__gt=p.id,
        ).exclude(writing_task1_text='', writing_task2_text='').order_by('id').first()

        return Response({
            'participant': _participant_payload(p),
            'next_id': next_p.id if next_p else None,
        })

    @action(detail=False, methods=['get'], url_path='speaking/queue')
    def speaking_queue(self, request):
        qs = _scope(request.user).filter(
            speaking_status='pending',
        ).order_by('session__date', 'full_name')
        return Response([
            {
                'id': p.id,
                'full_name': p.full_name,
                'session': p.session.name,
                'session_date': p.session.date.isoformat(),
                'listening_score': str(p.listening_score) if p.listening_score is not None else None,
                'reading_score': str(p.reading_score) if p.reading_score is not None else None,
                'writing_score': str(p.writing_score) if p.writing_score is not None else None,
            }
            for p in qs
        ])

    @action(detail=False, methods=['get'], url_path=r'speaking/(?P<participant_id>\d+)')
    def speaking_detail(self, request, participant_id=None):
        p = get_object_or_404(_scope(request.user), pk=participant_id)
        return Response(_participant_payload(p))

    @action(
        detail=False, methods=['post'],
        url_path=r'speaking/(?P<participant_id>\d+)/grade',
    )
    def speaking_grade(self, request, participant_id=None):
        p = get_object_or_404(_scope(request.user), pk=participant_id)

        # ETAP 13: 4 ta kriteriyani majburiy qabul qilamiz va o'rtachasini
        # speaking_score sifatida saqlaymiz. Backwards-compat: agar faqat
        # `score` yuborilsa, eski versiya kabi qabul qilamiz.
        criteria_values = []
        for f in SPEAKING_FIELDS:
            v = request.data.get(f)
            if v is None or v == '':
                criteria_values = []
                break
            try:
                num = Decimal(str(v))
            except (InvalidOperation, TypeError):
                return Response({'detail': f'{f} raqam bo‘lishi kerak.'},
                                status=status.HTTP_400_BAD_REQUEST)
            if num < 0 or num > 9:
                return Response({'detail': f'{f} 0–9 oralig‘ida bo‘lsin.'},
                                status=status.HTTP_400_BAD_REQUEST)
            criteria_values.append((f, num))

        if criteria_values:
            for f, num in criteria_values:
                setattr(p, f, num)
            avg = sum(num for _, num in criteria_values) / len(criteria_values)
            p.speaking_score = round(avg, 1)
        else:
            v = request.data.get('score')
            if v is None or v == '':
                return Response({'detail': 'Kriteriyalar yoki score majburiy.'},
                                status=status.HTTP_400_BAD_REQUEST)
            try:
                num = Decimal(str(v))
            except (InvalidOperation, TypeError):
                return Response({'detail': 'Score raqam bo‘lishi kerak.'},
                                status=status.HTTP_400_BAD_REQUEST)
            if num < 0 or num > 9:
                return Response({'detail': 'Score 0–9 oralig‘ida bo‘lishi kerak.'},
                                status=status.HTTP_400_BAD_REQUEST)
            p.speaking_score = num

        p.speaking_feedback = request.data.get('feedback', '') or ''
        p.speaking_status = 'graded'
        p.speaking_graded_by = request.user
        p.speaking_graded_at = timezone.now()
        p.calculate_overall_band_score()
        p.save()

        next_p = _scope(request.user).filter(
            speaking_status='pending', id__gt=p.id,
        ).order_by('id').first()
        return Response({
            'participant': _participant_payload(p),
            'next_id': next_p.id if next_p else None,
        })
