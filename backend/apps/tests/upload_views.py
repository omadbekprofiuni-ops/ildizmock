import os
import uuid

from django.conf import settings
from django.core.files.storage import default_storage
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin


class AudioUploadView(APIView):
    permission_classes = [IsAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        f = request.FILES.get('file')
        if not f:
            return Response({'detail': 'Fayl yuborilmagan.'}, status=400)

        ext = os.path.splitext(f.name)[1].lower() or '.mp3'
        safe_name = f'audio/{uuid.uuid4().hex}{ext}'
        saved_path = default_storage.save(safe_name, f)
        url = settings.MEDIA_URL + saved_path

        # Optional: try to read duration via mutagen. If unavailable, leave null.
        duration = None
        try:
            from mutagen import File as MutagenFile  # type: ignore

            abs_path = default_storage.path(saved_path)
            audio = MutagenFile(abs_path)
            if audio is not None and audio.info is not None:
                duration = int(audio.info.length)
        except Exception:
            duration = None

        return Response({
            'url': url,
            'path': saved_path,
            'duration': duration,
        })
