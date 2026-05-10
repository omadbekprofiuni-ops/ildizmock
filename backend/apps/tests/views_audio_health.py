"""HOTFIX — Audio playback diagnostic endpoint.

GET /api/v1/admin/audio-health/

Admin uchun tashxis vositasi: barcha listening_parts uchun audio fayl
diskda mavjudligini, URL'ni va xato sabablarini bir qarashda ko'rsatadi.

Foydalanish:
  - 'Audio could not be played' xato chiqsa, admin bu sahifaga kirib
    qaysi fayl yo'qligini darrov ko'radi.
  - Yangi audio yuklash kerakligini admin biladi.

Foydalanish:
  curl -H "Authorization: Bearer <admin_token>" \\
       https://ildiz-testing.uz/api/v1/admin/audio-health/
"""
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ListeningPart


class AudioHealthCheckView(APIView):
    """Admin tashxis vositasi — barcha listening_parts audio holati."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        is_superadmin = (
            getattr(user, 'is_superuser', False)
            or getattr(user, 'role', None) == 'superadmin'
        )

        qs = ListeningPart.objects.select_related('test')
        if not is_superadmin:
            org = getattr(user, 'organization', None)
            if org is None:
                qs = qs.none()
            else:
                qs = qs.filter(test__organization=org)

        results = []
        broken_count = 0

        for lp in qs:
            entry: dict = {
                'listening_part_id': lp.id,
                'test_id': str(lp.test_id),
                'test_name': lp.test.name,
                'part_number': lp.part_number,
                'audio_filename': None,
                'audio_url': None,
                'exists_on_disk': False,
                'size_bytes': None,
                'status': 'ok',
            }

            if not lp.audio_file:
                entry['status'] = 'no_file_uploaded'
                broken_count += 1
                results.append(entry)
                continue

            entry['audio_filename'] = lp.audio_file.name
            try:
                entry['audio_url'] = request.build_absolute_uri(lp.audio_file.url)
            except Exception:
                entry['audio_url'] = None

            try:
                exists = lp.audio_file.storage.exists(lp.audio_file.name)
                entry['exists_on_disk'] = exists
                if not exists:
                    entry['status'] = 'file_missing_on_disk'
                    broken_count += 1
            except Exception as e:
                entry['status'] = f'storage_error: {e}'
                broken_count += 1

            # Hajmni ham olib ko'ramiz (file size ham xato sabablaridan biri
            # bo'lishi mumkin — 0 bayt yoki haddan tashqari katta).
            try:
                entry['size_bytes'] = lp.audio_file.size
                if entry['size_bytes'] == 0:
                    entry['status'] = 'file_zero_bytes'
                    broken_count += 1
            except Exception:
                pass

            results.append(entry)

        return Response({
            'total': len(results),
            'broken': broken_count,
            'ok': len(results) - broken_count,
            'results': results,
        })
