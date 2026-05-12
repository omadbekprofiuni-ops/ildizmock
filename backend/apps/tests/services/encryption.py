"""ETAP 16.8 — API key encryption helpers.

API kalitlari DB'da shifrlangan holda (Fernet symmetric encryption) saqlanadi.
Master kalit `settings.AI_PROVIDER_ENCRYPTION_KEY` da yashaydi va faqat
provider'ni chaqirish vaqtida ochiladi.

Master kalitni generatsiya qilish (bir martagina, deploy'dan oldin):

    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

Natijasini `.env`'ga `AI_PROVIDER_ENCRYPTION_KEY=...` qilib qo'ying.

Kalit yo'qolsa, mavjud encrypted API kalitlar yana ochib bo'lmaydi —
superadmin paneldan yangi kalit kiritish lozim (30 soniyalik ish).
"""
from __future__ import annotations

from django.conf import settings


class EncryptionError(Exception):
    pass


def _get_fernet():
    from cryptography.fernet import Fernet

    key = getattr(settings, 'AI_PROVIDER_ENCRYPTION_KEY', '') or ''
    if not key:
        raise EncryptionError(
            "AI_PROVIDER_ENCRYPTION_KEY .env'da o'rnatilmagan. "
            "Yarating: "
            'python -c "from cryptography.fernet import Fernet; '
            'print(Fernet.generate_key().decode())"'
        )
    if isinstance(key, str):
        key = key.encode()
    return Fernet(key)


def encryption_available() -> bool:
    """`AI_PROVIDER_ENCRYPTION_KEY` o'rnatilganmi? Migration va factory uchun."""
    return bool(getattr(settings, 'AI_PROVIDER_ENCRYPTION_KEY', '') or '')


def encrypt_api_key(plaintext: str) -> str:
    """Plain API key'ni shifrlaydi. DB'ga shu encrypted matn yoziladi."""
    if not plaintext:
        return ''
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_api_key(ciphertext: str) -> str:
    """Encrypted key'ni ochib qaytaradi. Faqat provider chaqirayotganda ishlatiladi."""
    from cryptography.fernet import InvalidToken

    if not ciphertext:
        return ''
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise EncryptionError(
            "API key'ni ochib bo'lmadi. AI_PROVIDER_ENCRYPTION_KEY "
            "noto'g'ri yoki kalit o'zgartirilgan.",
        ) from exc


def mask_api_key(plaintext: str) -> str:
    """UI uchun: faqat oxirgi 4 belgini ko'rsatadi (`••••••••XyZ9`)."""
    if not plaintext:
        return ''
    if len(plaintext) <= 4:
        return '•' * len(plaintext)
    return '•' * 8 + plaintext[-4:]


def last4(plaintext: str) -> str:
    """Plain key'ning oxirgi 4 belgisi (DB'ga `api_key_last4` ga yoziladi)."""
    if not plaintext:
        return ''
    return plaintext[-4:] if len(plaintext) >= 4 else plaintext
