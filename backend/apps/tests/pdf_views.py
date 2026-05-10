from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from apps.organizations.models import Organization

from .models import PDFTest, PDFTestAttempt, Test


PDF_MAX_BYTES = 50 * 1024 * 1024
AUDIO_MAX_BYTES = 100 * 1024 * 1024
ALLOWED_AUDIO_MIME = {
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
    'audio/m4a', 'audio/x-m4a', 'audio/mp4',
}


class CanCreatePDFTest(BasePermission):
    """Faqat teacher / org_admin / superadmin PDF test yarata oladi."""

    message = 'Faqat o‘qituvchi yoki center admini test yarata oladi.'

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.role in ('teacher', 'org_admin', 'superadmin')


def parse_answer_key(text):
    """`1|C` formatdagi javoblar ro'yxatini dict ga aylantiradi.

    Returns:
        (answer_key dict, max_question int)

    Raises:
        ValueError: agar 1..max oraliqda javoblar yetishmasa.
    """
    answer_key = {}
    max_question = 0
    seen_duplicates = set()
    for line in (text or '').replace('\r', '').strip().split('\n'):
        line = line.strip()
        if not line or '|' not in line:
            continue
        parts = line.split('|', 1)
        if len(parts) != 2:
            continue
        q_raw = parts[0].strip()
        answer = parts[1].strip()
        if not q_raw or not answer:
            continue
        try:
            q_num = int(q_raw)
        except ValueError:
            raise ValueError(f"Invalid question number: '{q_raw}'")
        if q_num < 1:
            raise ValueError(f"Question numbers must be >= 1 (got {q_num})")
        key = str(q_num)
        if key in answer_key:
            seen_duplicates.add(q_num)
        answer_key[key] = answer
        if q_num > max_question:
            max_question = q_num

    if not answer_key:
        raise ValueError('Answer key is empty.')
    if seen_duplicates:
        dupes = sorted(seen_duplicates)
        raise ValueError(f'Duplicate question numbers: {dupes}')

    missing = [i for i in range(1, max_question + 1) if str(i) not in answer_key]
    if missing:
        raise ValueError(f'Missing answers for questions: {missing}')

    return answer_key, max_question


def _validate_pdf(file):
    if file.size > PDF_MAX_BYTES:
        raise ValueError('PDF file too large (max 50 MB).')
    ctype = (getattr(file, 'content_type', '') or '').lower()
    name = (file.name or '').lower()
    if ctype != 'application/pdf' and not name.endswith('.pdf'):
        raise ValueError('File must be a PDF.')


def _validate_audio(file):
    if file.size > AUDIO_MAX_BYTES:
        raise ValueError('Audio file too large (max 100 MB).')
    ctype = (getattr(file, 'content_type', '') or '').lower()
    name = (file.name or '').lower()
    if ctype not in ALLOWED_AUDIO_MIME and not name.endswith(('.mp3', '.wav', '.m4a')):
        raise ValueError('Audio must be MP3, WAV or M4A.')


def _audio_urls(request, test):
    urls = {}
    for i in (1, 2, 3, 4):
        f = getattr(test, f'audio_part{i}', None)
        if f:
            urls[f'part{i}'] = request.build_absolute_uri(f.url)
    return urls


def _user_org_id(user):
    return getattr(user, 'organization_id', None)


def _resolve_pdf_test(test_id):
    """UUID bo'yicha topadi (URL'da `<uuid:test_id>` ishlatamiz)."""
    from django.core.exceptions import ValidationError
    try:
        return PDFTest.objects.get(public_id=test_id)
    except (PDFTest.DoesNotExist, ValidationError, ValueError):
        return None


def _can_access(user, test):
    """Foydalanuvchi shu PDFTest bilan ishlay oladimi (org tekshirish)."""
    if not user.is_authenticated:
        return False
    if user.role == 'superadmin':
        return True
    return _user_org_id(user) == test.organization_id


@api_view(['POST'])
@permission_classes([CanCreatePDFTest])
@parser_classes([MultiPartParser, FormParser])
def create_pdf_test(request):
    """Teacher PDF + audio + answer key yuklab test yaratadi."""
    organization = getattr(request.user, 'organization', None)
    if organization is None:
        return Response({'error': 'User has no organization.'}, status=400)

    name = request.data.get('name', '').strip()
    module = request.data.get('module', 'reading')
    if not name:
        return Response({'error': 'Test name is required.'}, status=400)
    if module not in ('reading', 'listening'):
        return Response({'error': 'Module must be reading or listening.'}, status=400)

    difficulty = request.data.get('difficulty', 'medium')
    if difficulty not in ('easy', 'medium', 'hard'):
        return Response({'error': 'Difficulty must be easy, medium or hard.'}, status=400)

    pdf_file = request.FILES.get('pdf_file')
    if not pdf_file:
        return Response({'error': 'PDF file is required.'}, status=400)

    try:
        _validate_pdf(pdf_file)
    except ValueError as e:
        return Response({'error': str(e)}, status=400)

    # Listening uchun kamida Part 1 audio shart.
    if module == 'listening':
        if 'audio_part1' not in request.FILES:
            return Response(
                {'error': 'Listening test requires at least Part 1 audio.'},
                status=400,
            )
        for i in (1, 2, 3, 4):
            key = f'audio_part{i}'
            if key in request.FILES:
                try:
                    _validate_audio(request.FILES[key])
                except ValueError as e:
                    return Response({'error': f'{key}: {e}'}, status=400)

    try:
        answer_key, total_questions = parse_answer_key(request.data.get('answer_key', ''))
    except ValueError as e:
        return Response({'error': str(e)}, status=400)

    try:
        duration = int(request.data.get('duration_minutes', 60))
    except (TypeError, ValueError):
        duration = 60
    if duration < 1:
        duration = 60

    with transaction.atomic():
        test = PDFTest.objects.create(
            organization=organization,
            name=name,
            module=module,
            difficulty=difficulty,
            pdf_file=pdf_file,
            answer_key=answer_key,
            total_questions=total_questions,
            duration_minutes=duration,
            status='published',
            is_published=True,
            created_by=request.user,
        )

        if module == 'listening':
            updated = False
            for i in (1, 2, 3, 4):
                key = f'audio_part{i}'
                if key in request.FILES:
                    setattr(test, key, request.FILES[key])
                    updated = True
            if updated:
                test.save()

    return Response({
        'success': True,
        'test_id': str(test.public_id),
        'message': f'Test created: {test.name}',
        'total_questions': total_questions,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_pdf_tests(request):
    """Tashkilotning PDF testlari ro'yxati (teacher/admin uchun)."""
    organization = getattr(request.user, 'organization', None)
    if organization is None:
        return Response({'success': True, 'tests': []})

    tests = PDFTest.objects.filter(organization=organization, status='published')
    data = [{
        'id': str(t.public_id),
        'name': t.name,
        'module': t.module,
        'difficulty': t.difficulty,
        'total_questions': t.total_questions,
        'duration_minutes': t.duration_minutes,
        'created_at': t.created_at.isoformat(),
    } for t in tests]
    return Response({'success': True, 'tests': data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_student_pdf_tests(request):
    """Talabaga ko'rinadigan PDF testlar — submit qilingani belgilanadi."""
    organization = getattr(request.user, 'organization', None)
    if organization is None:
        return Response({'success': True, 'tests': []})

    tests = PDFTest.objects.filter(
        organization=organization,
        status='published',
        is_published=True,
    )
    completed_ids = set(
        PDFTestAttempt.objects.filter(
            student=request.user, test__in=tests,
        ).values_list('test_id', flat=True)
    )
    data = [{
        'id': str(t.public_id),
        'name': t.name,
        'module': t.module,
        'difficulty': t.difficulty,
        'total_questions': t.total_questions,
        'duration_minutes': t.duration_minutes,
        'is_completed': t.id in completed_ids,
    } for t in tests]
    return Response({'success': True, 'tests': data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_all_tests_for_center(request, slug):
    """Center admin uchun: Test + PDFTest birgalikda ro'yxati."""
    org = get_object_or_404(Organization, slug=slug)
    user = request.user
    if user.role != 'superadmin' and getattr(user, 'organization_id', None) != org.id:
        return Response({'error': 'Forbidden'}, status=403)

    rows = []
    for t in Test.objects.filter(organization=org, is_deleted=False):
        rows.append({
            'id': str(t.id),
            'name': t.name,
            'module': t.module,
            'difficulty': t.difficulty,
            'status': t.status,
            'total_questions': sum(p.questions.count() for p in t.passages.all())
                              + sum(p.questions.count() for p in t.listening_parts.all()),
            'duration_minutes': t.duration_minutes,
            'created_at': t.created_at.isoformat(),
            'type': 'regular',
        })
    for t in PDFTest.objects.filter(organization=org):
        rows.append({
            'id': f'pdf:{t.public_id}',
            'name': t.name,
            'module': t.module,
            'difficulty': t.difficulty,
            'status': t.status,
            'total_questions': t.total_questions,
            'duration_minutes': t.duration_minutes,
            'created_at': t.created_at.isoformat(),
            'type': 'pdf',
        })
    rows.sort(key=lambda r: r['created_at'], reverse=True)
    return Response({'success': True, 'tests': rows})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_pdf_test(request, test_id):
    """PDF testni topshirish uchun ma'lumotlarni qaytaradi (PDF + audio URL)."""
    test = _resolve_pdf_test(test_id)
    if test is None:
        return Response({'error': 'Test not found'}, status=404)

    if not _can_access(request.user, test):
        return Response({'error': 'Access denied'}, status=403)

    return Response({
        'success': True,
        'test': {
            'id': str(test.public_id),
            'name': test.name,
            'module': test.module,
            'difficulty': test.difficulty,
            'total_questions': test.total_questions,
            'duration_minutes': test.duration_minutes,
            'pdf_url': request.build_absolute_uri(test.pdf_file.url),
            'audio_urls': _audio_urls(request, test),
            'answer_key_questions': sorted(
                (int(k) for k in test.answer_key.keys() if str(k).isdigit()),
            ),
        },
    })


def _can_manage(user, test):
    """Faqat yaratuvchi tashkilot admin/teacher yoki superadmin."""
    if not user.is_authenticated:
        return False
    if user.role == 'superadmin':
        return True
    if user.role not in ('teacher', 'org_admin'):
        return False
    return getattr(user, 'organization_id', None) == test.organization_id


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_pdf_test(request, test_id):
    """Teacher/admin PDF testni o'chiradi (CASCADE: barcha urinishlar ham)."""
    test = _resolve_pdf_test(test_id)
    if test is None:
        return Response({'error': 'Test not found'}, status=404)
    if not _can_manage(request.user, test):
        return Response({'error': 'Forbidden'}, status=403)
    test.delete()
    return Response({'success': True})


@api_view(['PATCH', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def update_pdf_test(request, test_id):
    """PDF test metadata + ixtiyoriy fayllarni yangilaydi."""
    test = _resolve_pdf_test(test_id)
    if test is None:
        return Response({'error': 'Test not found'}, status=404)
    if not _can_manage(request.user, test):
        return Response({'error': 'Forbidden'}, status=403)

    data = request.data
    if 'name' in data:
        name = (data.get('name') or '').strip()
        if not name:
            return Response({'error': 'Test name cannot be empty.'}, status=400)
        test.name = name
    if 'difficulty' in data:
        difficulty = data.get('difficulty')
        if difficulty not in ('easy', 'medium', 'hard'):
            return Response({'error': 'Invalid difficulty.'}, status=400)
        test.difficulty = difficulty
    if 'duration_minutes' in data:
        try:
            duration = int(data.get('duration_minutes'))
            if duration < 1:
                raise ValueError
            test.duration_minutes = duration
        except (TypeError, ValueError):
            return Response({'error': 'Invalid duration.'}, status=400)
    if 'answer_key' in data and data.get('answer_key'):
        try:
            answer_key, total_questions = parse_answer_key(data.get('answer_key'))
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        test.answer_key = answer_key
        test.total_questions = total_questions

    if 'pdf_file' in request.FILES:
        try:
            _validate_pdf(request.FILES['pdf_file'])
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        test.pdf_file = request.FILES['pdf_file']

    if test.module == 'listening':
        for i in (1, 2, 3, 4):
            key = f'audio_part{i}'
            if key in request.FILES:
                try:
                    _validate_audio(request.FILES[key])
                except ValueError as e:
                    return Response({'error': f'{key}: {e}'}, status=400)
                setattr(test, key, request.FILES[key])

    test.save()
    return Response({
        'success': True,
        'test_id': str(test.public_id),
        'message': f'Test updated: {test.name}',
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_pdf_test(request, test_id):
    """Talaba javoblarini saqlaydi va auto-grading qiladi."""
    test = _resolve_pdf_test(test_id)
    if test is None:
        return Response({'error': 'Test not found'}, status=404)

    if not _can_access(request.user, test):
        return Response({'error': 'Access denied'}, status=403)

    # Bir test — bir urinish.
    existing = PDFTestAttempt.objects.filter(test=test, student=request.user).first()
    if existing:
        return Response({
            'error': 'Test already submitted.',
            'score': existing.score,
            'percentage': existing.percentage,
            'submitted_at': existing.submitted_at.isoformat() if existing.submitted_at else None,
        }, status=400)

    answers = request.data.get('answers') or {}
    if not isinstance(answers, dict):
        return Response({'error': 'answers must be an object.'}, status=400)

    time_taken = request.data.get('time_taken_seconds')
    try:
        time_taken = int(time_taken) if time_taken is not None else None
    except (TypeError, ValueError):
        time_taken = None

    attempt = PDFTestAttempt.objects.create(
        test=test,
        student=request.user,
        answers=answers,
        total_questions=test.total_questions,
        time_taken_seconds=time_taken,
        submitted_at=timezone.now(),
    )
    attempt.auto_grade()

    return Response({
        'success': True,
        'attempt_id': attempt.id,
        'score': attempt.score,
        'total_questions': attempt.total_questions,
        'percentage': attempt.percentage,
        'results': attempt.results,
    })
