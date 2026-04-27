"""Super admin uchun listening audio kutubxonasi (ETAP 9.x)."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organizations.permissions import IsSuperAdmin

from .models import ListeningPart


class SuperAdminAudioListView(APIView):
    """GET /api/v1/super/audio/ — barcha listening audio fayllar."""

    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        parts = (
            ListeningPart.objects
            .select_related('test', 'test__organization')
            .exclude(audio_file='')
            .filter(audio_file__isnull=False)
            .order_by('-created_at')
        )

        rows = []
        total_size = 0
        total_duration = 0
        for p in parts:
            audio_url = None
            try:
                audio_url = p.audio_file.url if p.audio_file else None
            except Exception:
                audio_url = None
            size = p.audio_size_bytes or 0
            duration = p.audio_duration_seconds or 0
            total_size += size
            total_duration += duration
            rows.append({
                'id': p.id,
                'test_id': str(p.test.id),
                'test_name': p.test.name,
                'organization': (
                    p.test.organization.name if p.test.organization else 'Global'
                ),
                'is_global': p.test.organization_id is None,
                'part_number': p.part_number,
                'duration_seconds': duration,
                'size_bytes': size,
                'bitrate_kbps': p.audio_bitrate_kbps or 0,
                'audio_url': audio_url,
                'created_at': p.created_at.isoformat(),
            })

        return Response({
            'totals': {
                'count': len(rows),
                'total_size_bytes': total_size,
                'total_duration_seconds': total_duration,
            },
            'files': rows,
        })
