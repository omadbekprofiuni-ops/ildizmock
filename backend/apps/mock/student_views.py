"""Student uchun ochiq mock endpointlar — autentifikatsiyasiz."""

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
    """ETAP 19 — Mock sessiyaga qo'shilish.

    GET — sessiya info + participant ro'yxati (oldindan qo'shilganlar).
    POST `{participant_id}` — pre-registered participantni "claim" qilish.
    POST `{full_name}` — guest sifatida ism kiritib qo'shilish (allow_guests bo'lsa).
    """
    session = get_object_or_404(MockSession, access_code=access_code)

    if request.method == 'GET':
        data = PublicSessionSerializer(session).data
        data['participants'] = PublicParticipantSerializer(
            session.participants.all(), many=True,
        ).data
        return Response(data)

    # POST — qo'shilish
    if not session.is_join_allowed():
        if session.status in ('finished', 'cancelled'):
            msg = 'Session tugagan, qo‘shilib bo‘lmaydi.'
        elif session.link_expires_at and timezone.now() > session.link_expires_at:
            msg = 'This link has expired.'
        else:
            msg = 'Session has already started, joining is no longer allowed.'
        return Response({'detail': msg}, status=status.HTTP_400_BAD_REQUEST)

    participant_id = request.data.get('participant_id')

    # ----- Variant 1: pre-registered participantni claim qilish -----
    if participant_id:
        participant = get_object_or_404(
            MockParticipant, pk=participant_id, session=session,
        )
        if participant.has_joined:
            return Response(
                {'detail': 'Someone has already joined under this name.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        participant.has_joined = True
        participant.claimed_at = timezone.now()
        participant.save(update_fields=['has_joined', 'claimed_at'])
        return Response({
            'browser_session_id': participant.browser_session_id,
            'participant': PublicParticipantSerializer(participant).data,
            'session': PublicSessionSerializer(session).data,
        }, status=status.HTTP_200_OK)

    # ----- Variant 2: guest sifatida ism kiritib qo'shilish -----
    if not session.allow_guests:
        return Response(
            {'detail': 'Pick your name from the list. New names cannot be added.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    full_name = (request.data.get('full_name') or '').strip()
    if len(full_name) < 2:
        return Response({'detail': 'Enter your first and last name.'},
                        status=status.HTTP_400_BAD_REQUEST)

    if MockParticipant.objects.filter(session=session, full_name=full_name).exists():
        return Response({'detail': 'Someone has already joined under this name.'},
                        status=status.HTTP_400_BAD_REQUEST)

    user = request.user if request.user.is_authenticated else None
    participant = MockParticipant.objects.create(
        session=session, full_name=full_name, user=user,
        has_joined=True, claimed_at=timezone.now(),
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
    elif session.status == 'speaking':
        submitted_for_current = bool(participant.speaking_audio)

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
            'listening', 'reading', 'writing', 'speaking',
        ) else None,
        'current_section_kind': session.current_test_kind,
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


def _pdf_audio_urls(request, pdf_test):
    urls = {}
    for i in (1, 2, 3, 4):
        f = getattr(pdf_test, f'audio_part{i}', None)
        if f:
            urls[f'part{i}'] = request.build_absolute_uri(f.url)
    return urls


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def section_data_view(request, browser_session_id):
    """Joriy bo'limning test ma'lumotlari (savollar, audio, passagelar).

    Listening/Reading uchun bo'limga PDFTest biriktirilgan bo'lsa, payload
    `kind: 'pdf'` bilan keladi va `pdf_url`, `audio_urls`,
    `answer_key_questions` qaytariladi (mavjud `PDFTestTaking` viewer
    iste'mol qiladigan formatda).
    """
    participant = get_object_or_404(
        MockParticipant, browser_session_id=browser_session_id,
    )
    session = participant.session

    if session.status not in ('listening', 'reading', 'writing', 'speaking'):
        return Response({'detail': 'The session has not started yet.'},
                        status=status.HTTP_400_BAD_REQUEST)

    kind = session.current_test_kind
    test = session.current_test
    if not test:
        return Response({'detail': 'No test attached to the current section.'},
                        status=status.HTTP_400_BAD_REQUEST)

    payload = {
        'section': session.status,
        'kind': kind,
        'test': {
            'id': f'pdf:{test.public_id}' if kind == 'pdf' else str(test.id),
            'name': test.name,
            'module': test.module,
            'duration_minutes': session.current_duration_minutes,
        },
        'seconds_remaining': _seconds_remaining(session),
    }

    if kind == 'pdf':
        # PDFTest payload — HOTFIX: PDF endi PNG sahifa rasmlari sifatida
        # ko'rsatiladi (Brave/Chrome shield iframe'ni bloklayapti edi).
        # Backfill qilinmagan eski testlar uchun pdf_url ham fallback bo'lib
        # turadi — frontend pdf_pages bo'sh bo'lsa unga qaytadi.
        pdf_pages = [request.build_absolute_uri(p) for p in (test.pdf_pages or [])]
        payload['pdf_pages'] = pdf_pages
        payload['pdf_page_count'] = test.pdf_page_count
        payload['pdf_url'] = (
            request.build_absolute_uri(test.pdf_file.url) if not pdf_pages else None
        )
        payload['audio_urls'] = _pdf_audio_urls(request, test)
        payload['answer_key_questions'] = sorted(
            int(k) for k in test.answer_key.keys() if str(k).isdigit()
        )
        payload['total_questions'] = test.total_questions
        return Response(payload)

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
    elif session.status == 'speaking':
        # Speaking test prompt'larini writing_tasks shablonida yuboramiz
        # (har task — bitta savol/cue card)
        payload['speaking_tasks'] = StudentWritingTaskSerializer(
            test.writing_tasks.all(), many=True, context=ctx,
        ).data

    return Response(payload)


def _check_section(participant: MockParticipant, expected: str):
    if participant.session.status != expected:
        return Response(
            {'detail': f'Session is not in the {expected} stage.'},
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
        return Response({'detail': 'Already submitted.'},
                        status=status.HTTP_400_BAD_REQUEST)

    answers = request.data.get('answers') or {}
    session = participant.session
    if session.listening_test_id:
        correct, total, band = grade_listening(session.listening_test, answers)
    else:
        return Response({'detail': 'No Listening test attached.'},
                        status=status.HTTP_400_BAD_REQUEST)

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
        return Response({'detail': 'Already submitted.'},
                        status=status.HTTP_400_BAD_REQUEST)

    answers = request.data.get('answers') or {}
    session = participant.session
    if session.reading_test_id:
        correct, total, band = grade_reading(session.reading_test, answers)
    else:
        return Response({'detail': 'No Reading test attached.'},
                        status=status.HTTP_400_BAD_REQUEST)

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
        return Response({'detail': 'Already submitted.'},
                        status=status.HTTP_400_BAD_REQUEST)

    participant.writing_task1_text = (request.data.get('task1') or '').strip()
    participant.writing_task2_text = (request.data.get('task2') or '').strip()
    participant.writing_submitted_at = timezone.now()
    participant.save(update_fields=[
        'writing_task1_text', 'writing_task2_text', 'writing_submitted_at',
    ])
    return Response({'detail': 'Your writing has been saved. Awaiting teacher review.'})


from rest_framework.decorators import throttle_classes  # noqa: E402
from rest_framework.throttling import ScopedRateThrottle  # noqa: E402


class _SpeakingUploadThrottle(ScopedRateThrottle):
    scope = 'speaking_upload'


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([_SpeakingUploadThrottle])
def submit_speaking(request, browser_session_id):
    """ETAP 14 BUG #11 — Student speaking audio yuklashi."""
    participant = get_object_or_404(
        MockParticipant, browser_session_id=browser_session_id,
    )
    err = _check_section(participant, 'speaking')
    if err:
        return err
    if participant.speaking_audio:
        return Response({'detail': 'Already submitted.'},
                        status=status.HTTP_400_BAD_REQUEST)

    audio = request.FILES.get('audio')
    if not audio:
        return Response({'detail': 'No audio file submitted.'},
                        status=status.HTTP_400_BAD_REQUEST)

    # Faqat audio formatlar
    allowed = (
        'audio/webm', 'audio/mpeg', 'audio/mp3', 'audio/wav',
        'audio/ogg', 'audio/m4a', 'audio/x-m4a',
    )
    if audio.content_type not in allowed:
        return Response(
            {'detail': f"Unsupported audio format: {audio.content_type}"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    # 50 MB limit
    if audio.size > 50 * 1024 * 1024:
        return Response(
            {'detail': 'File must not exceed 50 MB.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        duration = int(request.data.get('duration_seconds') or 0) or None
    except (TypeError, ValueError):
        duration = None

    participant.speaking_audio = audio
    participant.speaking_uploaded_at = timezone.now()
    if duration:
        participant.speaking_duration_seconds = duration
    participant.save(update_fields=[
        'speaking_audio', 'speaking_uploaded_at', 'speaking_duration_seconds',
    ])
    return Response({
        'detail': 'Audio received. Awaiting teacher review.',
        'uploaded_at': participant.speaking_uploaded_at,
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def my_result(request, browser_session_id):
    """Session yakunlanganidan keyin talaba o'z natijasini ko'radi."""
    participant = get_object_or_404(
        MockParticipant, browser_session_id=browser_session_id,
    )
    if participant.session.status != 'finished':
        return Response({'detail': 'Session has not finished yet.'},
                        status=status.HTTP_400_BAD_REQUEST)
    return Response(MockParticipantListSerializer(participant).data)
