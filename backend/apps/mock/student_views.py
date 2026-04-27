"""Talaba uchun ochiq mock endpointlar — autentifikatsiyasiz."""

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .grading import grade_listening, grade_reading
from .models import MockParticipant, MockSession
from .serializers import (
    MockParticipantListSerializer,
    PublicParticipantSerializer,
    PublicSessionSerializer,
)
from .test_serializers import (
    StudentListeningPartSerializer,
    StudentPassageSerializer,
    StudentWritingTaskSerializer,
)


@api_view(['GET', 'POST'])
@permission_classes([permissions.AllowAny])
def join_view(request, access_code):
    """GET — sessiya info; POST {full_name} — yangi participant yaratadi."""
    session = get_object_or_404(MockSession, access_code=access_code)

    if request.method == 'GET':
        data = PublicSessionSerializer(session).data
        data['participants'] = PublicParticipantSerializer(
            session.participants.all(), many=True,
        ).data
        return Response(data)

    # POST — qo'shilish
    if session.status not in ('waiting',):
        return Response(
            {'detail': 'Sessiya allaqachon boshlangan, qo‘shilib bo‘lmaydi.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    full_name = (request.data.get('full_name') or '').strip()
    if len(full_name) < 2:
        return Response({'detail': 'Ism va familiya kiriting.'},
                        status=status.HTTP_400_BAD_REQUEST)

    if MockParticipant.objects.filter(session=session, full_name=full_name).exists():
        return Response({'detail': 'Bu ism bilan kimdir allaqachon qo‘shilgan.'},
                        status=status.HTTP_400_BAD_REQUEST)

    participant = MockParticipant.objects.create(
        session=session, full_name=full_name,
    )
    return Response({
        'browser_session_id': participant.browser_session_id,
        'participant': PublicParticipantSerializer(participant).data,
        'session': PublicSessionSerializer(session).data,
    }, status=status.HTTP_201_CREATED)


def _seconds_remaining(session: MockSession) -> int:
    if session.status not in ('listening', 'reading', 'writing'):
        return 0
    if not session.section_started_at:
        return session.current_duration_minutes * 60
    elapsed = (timezone.now() - session.section_started_at).total_seconds()
    total = session.current_duration_minutes * 60
    return max(0, int(total - elapsed))


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def state_view(request, browser_session_id):
    """Polling — talaba holatini va vaqtni qaytaradi."""
    participant = get_object_or_404(
        MockParticipant, browser_session_id=browser_session_id,
    )
    session = participant.session

    submitted_for_current = False
    if session.status == 'listening':
        submitted_for_current = bool(participant.listening_submitted_at)
    elif session.status == 'reading':
        submitted_for_current = bool(participant.reading_submitted_at)
    elif session.status == 'writing':
        submitted_for_current = bool(participant.writing_submitted_at)

    return Response({
        'session': {
            'id': session.id,
            'name': session.name,
            'status': session.status,
            'access_code': session.access_code,
        },
        'participant': {
            'id': participant.id,
            'full_name': participant.full_name,
        },
        'current_section': session.status if session.status in (
            'listening', 'reading', 'writing',
        ) else None,
        'seconds_remaining': _seconds_remaining(session),
        'submitted_for_current': submitted_for_current,
        'scores': {
            'listening': str(participant.listening_score)
            if participant.listening_score is not None else None,
            'reading': str(participant.reading_score)
            if participant.reading_score is not None else None,
            'writing': str(participant.writing_score)
            if participant.writing_score is not None else None,
            'speaking': str(participant.speaking_score)
            if participant.speaking_score is not None else None,
        },
    })


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def section_data_view(request, browser_session_id):
    """Joriy bo'limning test ma'lumotlari (savollar, audio, passagelar)."""
    participant = get_object_or_404(
        MockParticipant, browser_session_id=browser_session_id,
    )
    session = participant.session
    test = session.current_test
    if not test:
        return Response({'detail': 'Joriy bo‘lim test bilan bog‘lanmagan.'},
                        status=status.HTTP_400_BAD_REQUEST)

    payload = {
        'section': session.status,
        'test': {
            'id': str(test.id),
            'name': test.name,
            'module': test.module,
            'duration_minutes': session.current_duration_minutes,
        },
        'seconds_remaining': _seconds_remaining(session),
    }

    ctx = {'request': request}
    if session.status == 'listening':
        payload['listening_parts'] = StudentListeningPartSerializer(
            test.listening_parts.all(), many=True, context=ctx,
        ).data
    elif session.status == 'reading':
        payload['passages'] = StudentPassageSerializer(
            test.passages.all().order_by('order', 'part_number'),
            many=True, context=ctx,
        ).data
    elif session.status == 'writing':
        payload['writing_tasks'] = StudentWritingTaskSerializer(
            test.writing_tasks.all(), many=True, context=ctx,
        ).data
    else:
        return Response({'detail': 'Sessiya hali boshlanmagan.'},
                        status=status.HTTP_400_BAD_REQUEST)

    return Response(payload)


def _check_section(participant: MockParticipant, expected: str):
    if participant.session.status != expected:
        return Response(
            {'detail': f'Sessiya {expected} bosqichida emas.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return None


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def submit_listening(request, browser_session_id):
    participant = get_object_or_404(
        MockParticipant, browser_session_id=browser_session_id,
    )
    err = _check_section(participant, 'listening')
    if err:
        return err
    if participant.listening_submitted_at:
        return Response({'detail': 'Allaqachon yuborilgan.'},
                        status=status.HTTP_400_BAD_REQUEST)

    answers = request.data.get('answers') or {}
    test = participant.session.listening_test
    if not test:
        return Response({'detail': 'Listening test biriktirilmagan.'},
                        status=status.HTTP_400_BAD_REQUEST)

    correct, total, band = grade_listening(test, answers)
    participant.listening_answers = answers
    participant.listening_correct = correct
    participant.listening_total = total
    participant.listening_score = band
    participant.listening_submitted_at = timezone.now()
    participant.calculate_overall_band_score()
    participant.save()
    return Response({
        'correct': correct, 'total': total, 'band': str(band),
    })


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def submit_reading(request, browser_session_id):
    participant = get_object_or_404(
        MockParticipant, browser_session_id=browser_session_id,
    )
    err = _check_section(participant, 'reading')
    if err:
        return err
    if participant.reading_submitted_at:
        return Response({'detail': 'Allaqachon yuborilgan.'},
                        status=status.HTTP_400_BAD_REQUEST)

    answers = request.data.get('answers') or {}
    test = participant.session.reading_test
    if not test:
        return Response({'detail': 'Reading test biriktirilmagan.'},
                        status=status.HTTP_400_BAD_REQUEST)

    correct, total, band = grade_reading(test, answers)
    participant.reading_answers = answers
    participant.reading_correct = correct
    participant.reading_total = total
    participant.reading_score = band
    participant.reading_submitted_at = timezone.now()
    participant.calculate_overall_band_score()
    participant.save()
    return Response({
        'correct': correct, 'total': total, 'band': str(band),
    })


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def submit_writing(request, browser_session_id):
    participant = get_object_or_404(
        MockParticipant, browser_session_id=browser_session_id,
    )
    err = _check_section(participant, 'writing')
    if err:
        return err
    if participant.writing_submitted_at:
        return Response({'detail': 'Allaqachon yuborilgan.'},
                        status=status.HTTP_400_BAD_REQUEST)

    participant.writing_task1_text = (request.data.get('task1') or '').strip()
    participant.writing_task2_text = (request.data.get('task2') or '').strip()
    participant.writing_submitted_at = timezone.now()
    participant.save(update_fields=[
        'writing_task1_text', 'writing_task2_text', 'writing_submitted_at',
    ])
    return Response({'detail': 'Yozma ishlar saqlandi. Ustoz baholashni kutadi.'})


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def my_result(request, browser_session_id):
    """Sessiya yakunlanganidan keyin talaba o'z natijasini ko'radi."""
    participant = get_object_or_404(
        MockParticipant, browser_session_id=browser_session_id,
    )
    if participant.session.status != 'finished':
        return Response({'detail': 'Sessiya hali tugamagan.'},
                        status=status.HTTP_400_BAD_REQUEST)
    return Response(MockParticipantListSerializer(participant).data)
