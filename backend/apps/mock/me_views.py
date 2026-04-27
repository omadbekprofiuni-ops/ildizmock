"""Login qilingan talaba uchun mock natija API'lari.

Prefiks: `/api/v1/student/mock/`.
"""

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .certificate import generate_certificate
from .models import MockParticipant


def _student_qs(user):
    """Login qilingan student'ning natijalari (user FK orqali yoki ism mosi)."""
    from django.db.models import Q

    full_name = (
        f'{(user.first_name or "").strip()} {(user.last_name or "").strip()}'
    ).strip()

    qs = MockParticipant.objects.select_related('session').filter(
        session__organization=user.organization,
    )
    cond = Q(user=user)
    if full_name:
        cond |= Q(user__isnull=True, full_name__iexact=full_name)
    return qs.filter(cond).order_by('-session__date', '-joined_at')


def _row(p: MockParticipant) -> dict:
    s = p.session
    return {
        'id': p.id,
        'session_id': s.id,
        'session_name': s.name,
        'session_date': s.date.isoformat(),
        'session_status': s.status,
        'listening_score': str(p.listening_score) if p.listening_score is not None else None,
        'reading_score': str(p.reading_score) if p.reading_score is not None else None,
        'writing_score': str(p.writing_score) if p.writing_score is not None else None,
        'speaking_score': str(p.speaking_score) if p.speaking_score is not None else None,
        'overall_band_score': str(p.overall_band_score) if p.overall_band_score is not None else None,
        'writing_status': p.writing_status,
        'speaking_status': p.speaking_status,
    }


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_mock_results(request):
    """Talabaning barcha mock natijalari + statistika."""
    qs = _student_qs(request.user)
    rows = [_row(p) for p in qs]

    # Statistika
    nums = lambda key: [float(r[key]) for r in rows if r.get(key)]
    overalls = nums('overall_band_score')
    listenings = nums('listening_score')
    readings = nums('reading_score')
    writings = nums('writing_score')
    speakings = nums('speaking_score')

    def avg(arr):
        return round(sum(arr) / len(arr), 2) if arr else None

    return Response({
        'results': rows,
        'stats': {
            'total': len(rows),
            'completed': len(overalls),
            'avg_overall': avg(overalls),
            'avg_listening': avg(listenings),
            'avg_reading': avg(readings),
            'avg_writing': avg(writings),
            'avg_speaking': avg(speakings),
            'latest_overall': overalls[0] if overalls else None,
        },
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_mock_detail(request, participant_id):
    qs = _student_qs(request.user)
    p = get_object_or_404(qs, pk=participant_id)
    s = p.session
    data = _row(p)
    data.update({
        'writing_feedback': p.writing_feedback,
        'speaking_feedback': p.speaking_feedback,
        'writing_task1_text': p.writing_task1_text,
        'writing_task2_text': p.writing_task2_text,
        'session': {
            'id': s.id,
            'name': s.name,
            'date': s.date.isoformat(),
            'status': s.status,
        },
    })
    return Response(data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_mock_certificate(request, participant_id):
    qs = _student_qs(request.user)
    p = get_object_or_404(qs, pk=participant_id)
    if p.overall_band_score is None:
        return Response(
            {'detail': 'Sertifikat tayyor emas — barcha sectionlar baholanishini kuting.'},
            status=400,
        )
    pdf = generate_certificate(p)
    response = HttpResponse(pdf.read(), content_type='application/pdf')
    safe_name = (p.full_name or 'Student').replace(' ', '_')
    filename = f'IELTS_Mock_{safe_name}_{p.session.date}.pdf'
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response
