"""Audio fayl uchun validator (MP3/WAV)."""

import os

from django.core.exceptions import ValidationError

VALID_EXTENSIONS = ('.mp3', '.wav', '.m4a', '.ogg')
MAX_AUDIO_SIZE = 50 * 1024 * 1024  # 50 MB
MIN_DURATION = 5         # soniya
MAX_DURATION = 60 * 60   # 60 daqiqa


def validate_audio_file(file):
    """File extension/size + audio davomiyligini tekshiradi."""
    name = getattr(file, 'name', '') or ''
    ext = os.path.splitext(name)[1].lower()
    if ext not in VALID_EXTENSIONS:
        raise ValidationError(
            f'Faqat MP3/WAV/M4A/OGG fayllar qabul qilinadi (siz: {ext or "?"}).'
        )

    size = getattr(file, 'size', 0) or 0
    if size > MAX_AUDIO_SIZE:
        raise ValidationError(
            f'Fayl 50MB dan oshmasligi kerak ({size / (1024 * 1024):.1f}MB).'
        )

    # Mutagen bilan davomiylik tekshirish (kutubxona bo'lmasa, jimgina o'tib ketamiz)
    try:
        from mutagen import File as MutagenFile
    except ImportError:
        return file

    pos = None
    try:
        pos = file.tell()
    except Exception:
        pass
    try:
        file.seek(0)
        info = MutagenFile(file)
        duration = getattr(getattr(info, 'info', None), 'length', None)
    except Exception:
        duration = None
    finally:
        try:
            file.seek(pos or 0)
        except Exception:
            pass

    if duration is not None:
        if duration < MIN_DURATION:
            raise ValidationError(
                f'Audio kamida {MIN_DURATION} soniya bo‘lishi kerak.'
            )
        if duration > MAX_DURATION:
            raise ValidationError(
                f'Audio {MAX_DURATION // 60} daqiqadan oshmasligi kerak '
                f'(siznikida: {duration / 60:.1f} daqiqa).'
            )
    return file
