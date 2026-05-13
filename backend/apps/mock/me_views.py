"""Login qilingan talaba uchun mock natija API'lari.

Prefiks: `/api/v1/student/mock/`.
"""

from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .certificate import generate_certificate
from .models import Certificate, MockParticipant


def _student_qs(user):
    """Login qilingan student'ning natijalari (user FK orqali yoki ism mosi).

    ETAP 21 — Rasmiy mock imtihon (is_official_exam=True) sessiyalari
    bu yerga umuman tushmaydi. Talaba o'z imtihon natijasini
    platformada ko'ra olmaydi — markaz Excel orqali e'lon qiladi.
    """
    from django.db.models import Q

    full_name = (
        f'{(user.first_name or "").strip()} {(user.last_name or "").strip()}'
    ).strip()

    qs = MockParticipant.objects.select_related('session').filter(
        session__organization=user.organization,
        session__is_official_exam=False,
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
            {'detail': 'Certificate not ready yet — wait for all sections to be graded.'},
            status=400,
        )
    pdf = generate_certificate(p)
    response = HttpResponse(pdf.read(), content_type='application/pdf')
    safe_name = (p.full_name or 'Student').replace(' ', '_')
    filename = f'IELTS_Mock_{safe_name}_{p.session.date}.pdf'
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


# ===== ETAP 20 — Persistent sertifikatlar =====


def _student_certificates_qs(user):
    """Login qilgan talabaning sertifikatlari (revoked emas).

    ETAP 21 — Rasmiy mock imtihon sessiyalari uchun sertifikat
    talabaga ko'rinmaydi.
    """
    qs = Certificate.objects.select_related(
        'participant', 'participant__session', 'issued_by',
    ).filter(
        is_revoked=False,
        participant__session__is_official_exam=False,
    )
    # Student bilan bog'liqlik: participant.user yoki ism mosi
    from django.db.models import Q
    full_name = (
        f'{(user.first_name or "").strip()} {(user.last_name or "").strip()}'
    ).strip()
    cond = Q(participant__user=user)
    if full_name:
        cond |= Q(participant__user__isnull=True, participant__full_name__iexact=full_name)
    return qs.filter(cond).order_by('-issue_date', '-id')


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_certificates(request):
    """Talabaning barcha amaldagi sertifikatlari ro'yxati."""
    qs = _student_certificates_qs(request.user)
    rows = []
    for c in qs:
        rows.append({
            'id': c.id,
            'certificate_number': c.certificate_number,
            'verification_code': c.verification_code,
            'full_name': c.full_name,
            'organization_name': c.organization_name,
            'test_date': c.test_date.isoformat(),
            'issue_date': c.issue_date.isoformat(),
            'listening_score': str(c.listening_score),
            'reading_score': str(c.reading_score),
            'writing_score': str(c.writing_score),
            'speaking_score': str(c.speaking_score),
            'overall_band_score': str(c.overall_band_score),
            'issued_by': (
                c.issued_by.get_full_name() or c.issued_by.username
                if c.issued_by_id else ''
            ),
            'pdf_url': (
                request.build_absolute_uri(c.pdf_file.url)
                if c.pdf_file else None
            ),
            'session_name': c.participant.session.name if c.participant_id else '',
        })
    return Response({'certificates': rows})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_certificate_download(request, certificate_id):
    """Certificate PDF yuklab olish — egasi orqali."""
    qs = _student_certificates_qs(request.user)
    cert = get_object_or_404(qs, pk=certificate_id)
    if not cert.pdf_file:
        return Response({'detail': 'PDF file not found.'}, status=404)
    return FileResponse(
        cert.pdf_file.open('rb'),
        as_attachment=True,
        filename=f'certificate_{cert.certificate_number}.pdf',
        content_type='application/pdf',
    )


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def verify_certificate(request, verification_code):
    """Public — sertifikat haqiqiyligini tekshirish (QR/URL orqali)."""
    try:
        cert = Certificate.objects.select_related(
            'participant', 'participant__session',
        ).get(verification_code=verification_code)
    except Certificate.DoesNotExist:
        return Response({
            'valid': False,
            'detail': 'Certificate not found.',
        }, status=404)

    if cert.is_revoked:
        return Response({
            'valid': False,
            'revoked': True,
            'certificate_number': cert.certificate_number,
            'detail': 'This certificate has been revoked.',
            'revoked_at': cert.revoked_at.isoformat() if cert.revoked_at else None,
        })

    return Response({
        'valid': True,
        'certificate_number': cert.certificate_number,
        'full_name': cert.full_name,
        'organization_name': cert.organization_name,
        'test_date': cert.test_date.isoformat(),
        'issue_date': cert.issue_date.isoformat(),
        'listening_score': str(cert.listening_score),
        'reading_score': str(cert.reading_score),
        'writing_score': str(cert.writing_score),
        'speaking_score': str(cert.speaking_score),
        'overall_band_score': str(cert.overall_band_score),
    })
